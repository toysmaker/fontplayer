/**
 * 字符渲染器
 * 负责渲染字符预览到Canvas
 */

import type { ICharacterFileLite, IFontSettings } from '../types'
import { ContourConverter } from './converter'
import { RenderEngine } from './renderer'
import { CanvasManager } from '../canvas/CanvasManager'
import { indexedDBManager, IndexedDBManager } from '../storage/IndexedDBManager'
import { useProjectStore } from '@/stores/project'
import type { IContours } from './types'

/**
 * 渲染算法版本号：渲染逻辑（如彩色模式填充分组）变化时 +1，
 * 使旧的像素缓存（CanvasManager）与 IndexedDB 预览缓存失效并重新渲染
 */
const RENDERER_VERSION = 2

/**
 * 计算字符内容的版本号（用于判断是否需要重新渲染）
 */
function getContentVersion(characterFile: ICharacterFileLite): number {
  // 使用字符的UUID和文本内容作为版本号
  // 如果字符数据变化，版本号会变化
  let hash = RENDERER_VERSION + characterFile.uuid.charCodeAt(0)
  if (characterFile.character?.text) {
    hash += characterFile.character.text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  }
  // 如果有组件列表，也加入版本号计算
  if (characterFile.components && Array.isArray(characterFile.components)) {
    hash += characterFile.components.length
  }
  return hash
}

/**
 * 字符渲染器类
 */
export class CharacterRenderer {
  /**
   * 渲染字符预览
   * 使用 async 的原因：与 IndexedDB 相关的读/写均显式 `await`，保证 `previewRef` 与持久化一致后再继续绘制/返回。
   * @param characterFile 字符文件
   * @param canvas Canvas元素（可选，如果不提供则从DOM获取）
   * @param fontSettings 字体设置
   */
  static async renderPreview(
    characterFile: ICharacterFileLite,
    canvas?: HTMLCanvasElement,
    fontSettings?: IFontSettings
  ): Promise<boolean> {
    try {
      // 获取Canvas（优先使用传入的canvas，否则从管理器获取）
      if (!canvas) {
        canvas = CanvasManager.getCanvasFromDOM(characterFile.uuid)
      }
      if (!canvas) {
        console.error(`Failed to get canvas for character ${characterFile.uuid}`)
        return false
      }
      
      // 检查是否需要重新渲染
      const contentVersion = getContentVersion(characterFile)
      if (!CanvasManager.needsRerender(characterFile.uuid, contentVersion)) {
        // 尝试从缓存恢复
        if (CanvasManager.restoreFromCache(canvas, characterFile.uuid)) {
          return true
        }
      }

      // 优先从 IndexedDB 加载预览数据（如果已计算过）
      let nonzeroContours: IContours | null = null
      let solidContours: IContours = []
      let fillColorsOut: string[] = []
      let solidFlagsOut: boolean[] = []
      let solidFillColorsOut: string[] = []
      let fillUnitsOut: string[] = []
      // 旧缓存缺少 fillUnits（修复镂空前持久化）时需重新计算并覆盖缓存
      let shouldRepersist = false

      if (characterFile.previewRef) {
        try {
          const stored = await indexedDBManager.get<IContours | { nonzero: IContours; solid: IContours; fillColors?: string[]; solidFillColors?: string[]; fillUnits?: string[] }>(characterFile.previewRef)
          if (stored) {
            if ('nonzero' in (stored as any)) {
              // 新格式
              const grouped = stored as { nonzero: IContours; solid: IContours; fillColors?: string[]; solidFillColors?: string[]; fillUnits?: string[] }
              nonzeroContours = grouped.nonzero
              solidContours = grouped.solid || []
              // 从缓存恢复 fillColors（仅彩色模式需要）
              if (grouped.fillColors) {
                fillColorsOut = grouped.fillColors
                // 重建 solidFlagsOut：fillColors 长度即 nonzero 数量
                solidFlagsOut = Array.from({ length: fillColorsOut.length }, () => false)
              }
              // 从缓存恢复实心轮廓颜色（彩色模式下与编辑界面一致着色）
              solidFillColorsOut = grouped.solidFillColors || []
              // 从缓存恢复填充单元；旧缓存缺少该字段时强制重新计算（否则无法还原组件级合并填充）
              if (Array.isArray(grouped.fillUnits) && grouped.fillUnits.length === (nonzeroContours?.length ?? 0)) {
                fillUnitsOut = grouped.fillUnits
              } else {
                if (import.meta.env.DEV) {
                  console.log(`[CharacterRenderer] Stale preview cache (no fillUnits) for ${characterFile.uuid}, recomputing`)
                }
                nonzeroContours = null
                solidContours = []
                fillColorsOut = []
                solidFlagsOut = []
                solidFillColorsOut = []
                shouldRepersist = true
              }
            } else {
              // 旧格式：全部视为 nonzero 且无填充单元信息，强制重新计算并覆盖缓存
              nonzeroContours = null
              solidContours = []
              shouldRepersist = true
            }
            if (import.meta.env.DEV) {
              console.log(`[CharacterRenderer] Loaded preview from IndexedDB for ${characterFile.uuid}`)
            }
          }
        } catch (error) {
          console.warn(`[CharacterRenderer] Failed to load preview from IndexedDB for ${characterFile.uuid}:`, error)
          nonzeroContours = null
        }
      }

      // 如果没有预览数据，需要计算
      if (!nonzeroContours) {
        const components = ContourConverter.getComponentsForCharacter(characterFile)

        if (import.meta.env.DEV) {
          console.warn(
            `[CharacterRenderer] DEBUG components for "${characterFile.character?.text || '?'}": ` +
            `count=${components.length}, ` +
            `fills=[${components.map((c: any) => `${c.name}=${c.fillColor || (c.value as any)?.fillColor || 'none'}`).join(', ')}]`
          )
        }
        if (components.length === 0) {
          if (import.meta.env.DEV) {
            console.log('[CharacterRenderer] renderPreview EMPTY: no components for char "' + (characterFile.character?.text || '?') + '" uuid=' + (characterFile.uuid?.slice(0, 8) || '?'))
          }
          RenderEngine.clearCanvas(canvas)
          return true
        }

        const unitsPerEm = fontSettings?.unitsPerEm || 1000
        const descender = fontSettings?.descender || -200

        const gs = characterFile.info?.gridSettings
        const layoutGrid =
          gs?.initialGrid && gs?.currentGrid
            ? {
                initialGrid: gs.initialGrid,
                currentGrid: gs.currentGrid,
                gridEditTarget: 'currentGrid' as const,
              }
            : undefined

        solidFlagsOut = []
        fillColorsOut = []
        fillUnitsOut = []
        const allContours = ContourConverter.componentsToContours(
          components,
          {
            unitsPerEm,
            descender,
            advanceWidth: unitsPerEm,
            preview: true,
            grid: layoutGrid,
            useSkeletonGrid: characterFile.info?.useSkeletonGrid ?? false,
          },
          { x: 0, y: 0 },
          solidFlagsOut,
          fillColorsOut,
          fillUnitsOut,
        )

        nonzeroContours = allContours.filter((_, i) => !solidFlagsOut[i])
        solidContours = allContours.filter((_, i) => solidFlagsOut[i])
        // 实心轮廓（矩形/椭圆）的颜色与 solidContours 索引对齐，供彩色模式着色
        solidFillColorsOut = fillColorsOut.filter((_, i) => solidFlagsOut[i])
        // 填充单元只对非实心轮廓有意义，过滤后与 nonzeroContours 索引对齐
        fillUnitsOut = fillUnitsOut.filter((_, i) => !solidFlagsOut[i])

        // 持久化预览：必须 await，成功后才写入 previewRef，避免「未落库却持 ref」的竞态
        // 与 GlyphRenderer 一致：先 JSON 深拷贝为纯数据。组件在 Vue 响应式树中时，
        // contour 数组可能是 Proxy，IndexedDB structured clone 会报 DataCloneError。
        // 同时保存 fillColors / solidFillColors / fillUnits 以便彩色模式从缓存加载时也能正确着色与合并填充
        if (allContours.length > 0 && (!characterFile.previewRef || shouldRepersist)) {
          const previewKey = characterFile.previewRef || IndexedDBManager.generatePreviewKey(characterFile.uuid)
          try {
            const previewFillColors = fillColorsOut.filter((_, i) => !solidFlagsOut[i])
            const previewSolidFillColors = fillColorsOut.filter((_, i) => solidFlagsOut[i])
            const payload = JSON.parse(
              JSON.stringify({ nonzero: nonzeroContours, solid: solidContours, fillColors: previewFillColors, solidFillColors: previewSolidFillColors, fillUnits: fillUnitsOut }),
            ) as { nonzero: IContours; solid: IContours; fillColors?: string[]; solidFillColors?: string[]; fillUnits?: string[] }
            await indexedDBManager.set(previewKey, payload)
            characterFile.previewRef = previewKey
            if (import.meta.env.DEV) {
              console.log(`[CharacterRenderer] Saved preview to IndexedDB for ${characterFile.uuid}`)
            }
          } catch (error) {
            console.error(`[CharacterRenderer] Failed to save preview to IndexedDB for ${characterFile.uuid}:`, error)
          }
        }
      }

      const allContoursCombined = [...(nonzeroContours || []), ...solidContours]
      if (allContoursCombined.length === 0) {
        RenderEngine.clearCanvas(canvas)
        return true
      }

      if (import.meta.env.DEV) {
        console.log(`[CharacterRenderer] nonzero=${nonzeroContours?.length}, solid=${solidContours.length} for ${characterFile.uuid}`)
      }

      // 获取预览样式（从全局 store）
      const projectStore = useProjectStore()
      const previewStyle = projectStore.fontPreviewStyle

      // 获取填充颜色（从 componentsToContours 输出的 fillColorsOut 获取，
      // 已按轮廓索引对齐，解决了 glyph 组件产生多轮廓时 getFillColors 颜色数量不匹配的问题）
      let fillColors: string[] = []
      if (previewStyle === 'color') {
        if (fillColorsOut.length > 0) {
          // 优先使用 componentsToContours 输出的轮廓对齐颜色
          fillColors = fillColorsOut.filter((_, i) => !solidFlagsOut[i])
        } else {
          // 从 IndexedDB 缓存加载时没有 fillColorsOut，回退到 getFillColors
          const comps = ContourConverter.getComponentsForCharacter(characterFile)
          fillColors = ContourConverter.getFillColors(comps)
        }
        if (import.meta.env.DEV) {
          console.warn(
            `[CharacterRenderer] COLOR MODE "${characterFile.character?.text || '?'}" ` +
            `uuid=${characterFile.uuid?.slice(0, 8)} ` +
            `fromCache=${!!characterFile.previewRef} ` +
            `fillColorsOut.len=${fillColorsOut.length} ` +
            `nonzero.len=${nonzeroContours?.length} ` +
            `finalColors.len=${fillColors.length} ` +
            `colors=[${fillColors.slice(0, 8).join(',')}${fillColors.length > 8 ? '...' : ''}]`
          )
        }
      }

      // 使用实际字体坐标空间渲染，保持与编辑界面一致的位置关系
      // preview_points 已按 100/unitsPerEm 缩放，坐标范围与 canvas（100×100）对齐
      // offsetX = offsetY = 0 时，组件出现在 em-square 中的真实位置
      // 纯文本预览模式下 canvas 尺寸随字号变化，按 canvas 实际边长缩放（默认 100×100 时 scale=1）
      const previewScale = canvas.width / 100
      RenderEngine.renderPreview(canvas, nonzeroContours || [], {
        fillColors,
        fillUnits: fillUnitsOut,
        previewStyle,
        scale: previewScale,
        offset: { x: 0, y: 0 },
        solidContours,
        solidFillColors: solidFillColorsOut,
      })
      
      // 标记 Canvas 已渲染（用于检测 Canvas 复用）
      CanvasManager.markCanvasRendered(canvas, characterFile.uuid)
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        try {
          await CanvasManager.setRenderCache(characterFile.uuid, imageData)
        } catch (error) {
          console.error(`Failed to cache render result for ${characterFile.uuid}:`, error)
        }
      }

      return true
    } catch (error) {
      console.error(
        `Error rendering character ${characterFile.uuid}:`,
        error
      )
      return false
    }
  }

  /**
   * 批量渲染字符预览
   * @param characterFiles 字符文件列表
   * @param fontSettings 字体设置
   * @param onProgress 进度回调
   */
  static async renderBatch(
    characterFiles: ICharacterFileLite[],
    fontSettings?: IFontSettings,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    const total = characterFiles.length
    let loaded = 0

    for (const characterFile of characterFiles) {
      await this.renderPreview(characterFile, undefined, fontSettings)
      loaded++
      
      if (onProgress) {
        onProgress(loaded, total)
      }

      // 每渲染5个字符就让出主线程
      if (loaded % 5 === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
    }
  }
}
