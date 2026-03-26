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
 * 计算字符内容的版本号（用于判断是否需要重新渲染）
 */
function getContentVersion(characterFile: ICharacterFileLite): number {
  // 使用字符的UUID和文本内容作为版本号
  // 如果字符数据变化，版本号会变化
  let hash = characterFile.uuid.charCodeAt(0)
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

      if (characterFile.previewRef) {
        try {
          const stored = await indexedDBManager.get<IContours | { nonzero: IContours; solid: IContours }>(characterFile.previewRef)
          if (stored) {
            if ('nonzero' in (stored as any)) {
              // 新格式
              const grouped = stored as { nonzero: IContours; solid: IContours }
              nonzeroContours = grouped.nonzero
              solidContours = grouped.solid || []
            } else {
              // 旧格式，全部视为 nonzero
              nonzeroContours = stored as IContours
              solidContours = []
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

        if (components.length === 0) {
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

        const solidFlagsOut: boolean[] = []
        const allContours = ContourConverter.componentsToContours(
          components,
          {
            unitsPerEm,
            descender,
            advanceWidth: unitsPerEm,
            preview: true,
            grid: layoutGrid,
          },
          { x: 0, y: 0 },
          solidFlagsOut
        )

        nonzeroContours = allContours.filter((_, i) => !solidFlagsOut[i])
        solidContours = allContours.filter((_, i) => solidFlagsOut[i])

        // 持久化预览：必须 await，成功后才写入 previewRef，避免「未落库却持 ref」的竞态
        // 与 GlyphRenderer 一致：先 JSON 深拷贝为纯数据。组件在 Vue 响应式树中时，
        // contour 数组可能是 Proxy，IndexedDB structured clone 会报 DataCloneError。
        if (allContours.length > 0 && !characterFile.previewRef) {
          const previewKey = IndexedDBManager.generatePreviewKey(characterFile.uuid)
          try {
            const payload = JSON.parse(
              JSON.stringify({ nonzero: nonzeroContours, solid: solidContours }),
            ) as { nonzero: IContours; solid: IContours }
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

      // 获取填充颜色（仅彩色模式需要）
      let fillColors: string[] = []
      if (previewStyle === 'color') {
        const components = ContourConverter.getComponentsForCharacter(characterFile)
        fillColors = ContourConverter.getFillColors(components)
      }

      // 使用实际字体坐标空间渲染，保持与编辑界面一致的位置关系
      // preview_points 已按 100/unitsPerEm 缩放，坐标范围与 canvas（100×100）对齐
      // offsetX = offsetY = 0 时，组件出现在 em-square 中的真实位置
      RenderEngine.renderPreview(canvas, nonzeroContours || [], {
        fillColors,
        previewStyle,
        scale: 1,
        offset: { x: 0, y: 0 },
        solidContours,
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
