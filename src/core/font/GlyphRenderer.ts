/**
 * 字形渲染器
 * 负责渲染字形预览到Canvas
 */

import type { ICustomGlyph, IFontSettings } from '../types'
import { ContourConverter } from './converter'
import { RenderEngine } from './renderer'
import { CanvasManager } from '../canvas/CanvasManager'
import { indexedDBManager } from '../storage/IndexedDBManager'
import type { IContours } from './types'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { instanceManager } from '../instance/InstanceManager'
import { executeGlyphScript } from '../script/ScriptExecutor'
import { CustomGlyph } from '../instance/CustomGlyph'

/**
 * 可安全 console 的实例快照（避免整对象展开循环引用、也便于看 Pen 是否进 _components）
 */
function summarizeGlyphInstanceForSel(
  glyphInstance: { uuid: string; components: unknown[] },
  glyph: ICustomGlyph,
  instanceKey: string,
  poolGet: unknown,
): Record<string, unknown> {
  const raw = glyphInstance as unknown as {
    uuid: string
    _glyph?: ICustomGlyph
    _components?: unknown[]
    _joints?: unknown[]
    _reflines?: unknown[]
    tempData?: Record<string, unknown>
  }
  let componentsGetterLen: number | null = null
  let componentsGetterError: string | undefined
  try {
    componentsGetterLen = glyphInstance.components?.length ?? 0
  } catch (err) {
    componentsGetterError = err instanceof Error ? err.message : String(err)
  }
  let orderedLen = -1
  let orderedErr: string | undefined
  try {
    orderedLen = orderedListWithItemsForGlyph(glyph).length
  } catch (err) {
    orderedErr = err instanceof Error ? err.message : String(err)
  }
  const comps = raw._components || []
  return {
    instanceKey,
    sameReferenceAsPoolGet: poolGet === glyphInstance,
    instanceUuid: raw.uuid,
    boundGlyphUuid: raw._glyph?.uuid,
    boundGlyphMatchesInput: raw._glyph?.uuid === glyph.uuid,
    _componentsLen: comps.length,
    _componentsDetail: comps.map((c: any, i: number) => ({
      i,
      type: c?.type,
      pointsLen: Array.isArray(c?.points) ? c.points.length : null,
      hasRender: typeof c?.render === 'function',
    })),
    orderedListFromGlyphLen: orderedLen,
    orderedListError: orderedErr,
    componentsGetterLen,
    componentsGetterError,
    _jointsLen: raw._joints?.length ?? 0,
    _reflinesLen: raw._reflines?.length ?? 0,
    tempDataPresent: !!raw.tempData,
    tempDataKeys: raw.tempData ? Object.keys(raw.tempData) : [],
  }
}

/**
 * 计算字形内容的版本号（用于判断是否需要重新渲染）
 */
function getContentVersion(glyph: ICustomGlyph): number {
  let hash = glyph.uuid.charCodeAt(0)
  if (glyph.name) {
    hash += glyph.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  }
  if (glyph.components && Array.isArray(glyph.components)) {
    hash += glyph.components.length
  }
  return hash
}

/** 仅字形选择弹窗（bypassImageDataCache）且 DEV 时输出，便于在控制台筛 `[GlyphSel]` */
function logGlyphSel(
  phase: string,
  glyph: ICustomGlyph,
  devOnly: boolean,
  extra?: Record<string, unknown>,
): void {
  if (!devOnly) return
  console.log(`[GlyphSel] ${phase}`, { uuid: glyph.uuid, name: glyph.name, ...(extra ?? {}) })
}

function sampleCanvasCenterAlpha(canvas: HTMLCanvasElement): number | null {
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx || canvas.width < 1 || canvas.height < 1) return null
    const x = Math.floor(canvas.width / 2)
    const y = Math.floor(canvas.height / 2)
    return ctx.getImageData(x, y, 1, 1).data[3] ?? 0
  } catch {
    return null
  }
}

/**
 * 字形渲染器类
 */
export class GlyphRenderer {
  /**
   * 渲染字形预览
   * @param canvas Canvas元素
   * @param glyph 字形数据
   * @param fontSettings 字体设置
   */
  static async renderPreview(
    canvas: HTMLCanvasElement,
    glyph: ICustomGlyph,
    fontSettings?: IFontSettings,
    options?: {
      /** 跳过内存 ImageData 快路径（putImageData）；字形选择弹窗等虚拟列表在 Tauri/WK 上走恢复常合成失败仍空白 */
      bypassImageDataCache?: boolean
      /** DEV：为 true 时打印 [GlyphSel] 调试链；由列表按「仅最后一格 / 全部」传入 */
      glyphSelVerbose?: boolean
    }
  ): Promise<boolean> {
    const devSel = import.meta.env.DEV && options?.bypassImageDataCache === true
    const devSelLog = devSel && options?.glyphSelVerbose === true
    try {
      if (!canvas || !glyph) {
        console.error('Invalid canvas or glyph')
        return false
      }

      const contentVersion = getContentVersion(glyph)

      logGlyphSel('entry', glyph, devSelLog, {
        bypassImageDataCache: !!options?.bypassImageDataCache,
        contentVersion,
        canvas: { w: canvas.width, h: canvas.height, isConnected: canvas.isConnected },
      })

      // bypass：必须走 RenderEngine 真绘制，避免 restoreFromCache 在 WK 父级 transform 下不显示却仍 return true
      if (!options?.bypassImageDataCache) {
        if (!CanvasManager.needsRerender(glyph.uuid, contentVersion)) {
          if (CanvasManager.restoreFromCache(canvas, glyph.uuid)) {
            return true
          }
        }
      } else {
        logGlyphSel('cacheFastPath_skipped', glyph, devSelLog, {
          reason: 'bypassImageDataCache',
          contentVersion,
          note: 'needsRerender/restoreFromCache 未执行',
        })
      }

      // 优先从 IndexedDB 加载预览数据（如果已计算过）
      let nonzeroContours: IContours | null = null
      let solidContours: IContours = []
      let idbHadRecord = false

      if (glyph.previewRef) {
        try {
          const stored = await indexedDBManager.get<IContours | { nonzero: IContours; solid: IContours }>(glyph.previewRef)
          if (stored) {
            idbHadRecord = true
            if ('nonzero' in (stored as any)) {
              const grouped = stored as { nonzero: IContours; solid: IContours }
              nonzeroContours = grouped.nonzero
              solidContours = grouped.solid || []
            } else {
              nonzeroContours = stored as IContours
              solidContours = []
            }
            if (import.meta.env.DEV) {
              console.log(`[GlyphRenderer] Loaded preview from IndexedDB for ${glyph.uuid}`)
            }
          }
        } catch (error) {
          console.warn(`[GlyphRenderer] Failed to load preview from IndexedDB for ${glyph.uuid}:`, error)
          nonzeroContours = null
        }
      }

      logGlyphSel('afterPreviewRef', glyph, devSelLog, {
        previewRef: glyph.previewRef ?? null,
        idbHadRecord,
        nonzeroFromIdb: nonzeroContours != null,
        nonzeroSegs: nonzeroContours?.length ?? 0,
        solidSegs: solidContours.length,
      })

      // 如果没有预览数据，需要计算
      if (!nonzeroContours) {
        let components = glyph.components || []

        logGlyphSel('computeContours', glyph, devSelLog, {
          componentsInGlyph: components.length,
          hasScriptOrSkeleton: !!(glyph.script || glyph.script_reference || glyph.skeleton),
        })

        // 字形有脚本或骨架时，必须执行脚本/骨架分支才能获得完整组件列表（骨架绑定字形也走此处）
        if (glyph.script || glyph.script_reference || glyph.skeleton) {
          try {
            const instanceKey = glyph.uuid
            const glyphInstance = instanceManager.acquireTemporaryInstance(
              instanceKey,
              () => new CustomGlyph(glyph),
              'glyph'
            )

            try {
              // 与笔画模板 tempData 守卫冲突时否则 executeGlyphScript 会直接 return，组件恒为 0 → clearCanvas 空白
              executeGlyphScript(glyph, instanceKey, {
                ignoreTempDataGuard: true,
                glyphSelVerbose: devSelLog,
              })
              // 必须与 ScriptExecutor 使用同一 instanceManager 模块单例；动态 import 可能产生第二份副本导致脚本写入池 A、此处仍持池 B 的旧引用
              const instanceForContours = (instanceManager.getPooledInstance(instanceKey) ??
                glyphInstance) as CustomGlyph
              const poolGet = instanceManager.getPooledInstance(instanceKey)
              if (devSelLog) {
                logGlyphSel('instanceAfterScript', glyph, true, {
                  ...summarizeGlyphInstanceForSel(instanceForContours, glyph, instanceKey, poolGet),
                  note: '优先使用 getPooledInstance(key)；与 acquire 时变量应为同一引用（否则曾存在双单例）',
                })
                console.log('[GlyphSel] instanceAfterScript_rawObject', instanceForContours)
              }
              components = instanceForContours.components || []
            } finally {
              instanceManager.releaseTemporaryInstance(instanceKey)
            }
          } catch (error) {
            console.warn(`[GlyphRenderer] Failed to execute script for ${glyph.uuid}:`, error)
          }
        }

        logGlyphSel('afterScript', glyph, devSelLog, { componentsAfterScript: components.length })

        if (components.length === 0) {
          logGlyphSel('earlyReturn', glyph, devSelLog, { reason: 'components.length===0', action: 'clearCanvas' })
          RenderEngine.clearCanvas(canvas)
          return true
        }

        const unitsPerEm = fontSettings?.unitsPerEm || 1000
        const descender = fontSettings?.descender || -200

        const solidFlagsOut: boolean[] = []
        const allContours = await ContourConverter.componentsToContours(
          components as any,
          { unitsPerEm, descender, advanceWidth: unitsPerEm, preview: true },
          { x: 0, y: 0 },
          solidFlagsOut
        )

        nonzeroContours = allContours.filter((_, i) => !solidFlagsOut[i])
        solidContours = allContours.filter((_, i) => solidFlagsOut[i])

        logGlyphSel('afterComponentsToContours', glyph, devSelLog, {
          allContours: allContours.length,
          nonzeroSegs: nonzeroContours.length,
          solidSegs: solidContours.length,
        })

        // 持久化预览到 IndexedDB（await 确保 previewRef 在返回前已设置，避免竞态）
        if (allContours.length > 0 && !glyph.previewRef) {
          const { IndexedDBManager } = await import('../storage/IndexedDBManager')
          const previewKey = IndexedDBManager.generatePreviewKey(glyph.uuid)
          try {
            const payload = JSON.parse(JSON.stringify({ nonzero: nonzeroContours, solid: solidContours }))
            await indexedDBManager.set(previewKey, payload)
            glyph.previewRef = previewKey
            if (import.meta.env.DEV) {
              console.log(`[GlyphRenderer] Saved preview to IndexedDB for ${glyph.uuid}`)
            }
          } catch (error) {
            console.error(`[GlyphRenderer] Failed to save preview to IndexedDB for ${glyph.uuid}:`, error)
          }
        }
      }

      const allContoursCombined = [...(nonzeroContours || []), ...solidContours]
      if (allContoursCombined.length === 0) {
        logGlyphSel('earlyReturn', glyph, devSelLog, { reason: 'allContoursCombined.length===0', action: 'clearCanvas' })
        RenderEngine.clearCanvas(canvas)
        return true
      }

      logGlyphSel('beforeRenderEngine', glyph, devSelLog, {
        totalSegs: allContoursCombined.length,
        centerAlphaBefore: sampleCanvasCenterAlpha(canvas),
      })

      // 获取预览样式（从全局 store）
      const { useProjectStore } = await import('@/stores/project')
      const projectStore = useProjectStore()
      const previewStyle = projectStore.fontPreviewStyle

      // 使用实际字体坐标空间渲染，保持与编辑界面一致的位置关系
      // preview_points 已按 100/unitsPerEm 缩放，坐标范围与 canvas（100×100）对齐
      // offsetX = offsetY = 0 时，组件出现在 em-square 中的真实位置
      RenderEngine.renderPreview(canvas, nonzeroContours || [], {
        fillColors: [],
        previewStyle,
        scale: 1,
        offset: { x: 0, y: 0 },
        solidContours,
      })

      const centerAlphaAfterDraw = sampleCanvasCenterAlpha(canvas)
      const hasContentFlag = CanvasManager.hasContent(canvas)
      logGlyphSel('afterRenderEngine', glyph, devSelLog, {
        centerAlphaAfter: centerAlphaAfterDraw,
        CanvasManager_hasContent: hasContentFlag,
      })

      // 标记 Canvas 已渲染
      CanvasManager.markCanvasRendered(canvas, glyph.uuid)

      // 缓存渲染结果
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        await CanvasManager.setRenderCache(glyph.uuid, imageData)
      }

      logGlyphSel('done', glyph, devSelLog, {
        setRenderCache: !!ctx,
        centerAlphaFinal: sampleCanvasCenterAlpha(canvas),
        CanvasManager_hasContent: CanvasManager.hasContent(canvas),
      })

      return true
    } catch (error) {
      if (glyph) {
        logGlyphSel('throw', glyph, devSelLog, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      console.error(`Failed to render glyph ${glyph?.uuid ?? '(null)'}:`, error)
      return false
    }
  }
}
