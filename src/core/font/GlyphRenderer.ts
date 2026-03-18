/**
 * 字形渲染器
 * 负责渲染字形预览到Canvas
 */

import type { ICustomGlyph, IFontSettings } from '../types'
import { ContourConverter } from './converter'
import { RenderEngine } from './renderer'
import { CanvasManager } from '../canvas/CanvasManager'
import { PathType } from './types'
import { indexedDBManager } from '../storage/IndexedDBManager'
import type { IContours } from './types'

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
    fontSettings?: IFontSettings
  ): Promise<boolean> {
    try {
      if (!canvas || !glyph) {
        console.error('Invalid canvas or glyph')
        return false
      }

      // 检查是否需要重新渲染
      const contentVersion = getContentVersion(glyph)
      if (!CanvasManager.needsRerender(glyph.uuid, contentVersion)) {
        // 尝试从缓存恢复
        if (CanvasManager.restoreFromCache(canvas, glyph.uuid)) {
          return true
        }
      }

      // 优先从 IndexedDB 加载预览数据（如果已计算过）
      let nonzeroContours: IContours | null = null
      let solidContours: IContours = []

      if (glyph.previewRef) {
        try {
          const stored = await indexedDBManager.get<IContours | { nonzero: IContours; solid: IContours }>(glyph.previewRef)
          if (stored) {
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

      // 如果没有预览数据，需要计算
      if (!nonzeroContours) {
        let components = glyph.components || []

        // 字形有脚本时，必须执行脚本才能获得完整组件列表（包含脚本生成的内置组件）
        if (glyph.script || glyph.script_reference) {
          try {
            const { executeGlyphScript } = await import('../script/ScriptExecutor')
            const { instanceManager } = await import('../instance/InstanceManager')
            const { CustomGlyph } = await import('../instance/CustomGlyph')

            const instanceKey = glyph.uuid
            const glyphInstance = instanceManager.acquireTemporaryInstance(
              instanceKey,
              () => new CustomGlyph(glyph),
              'glyph'
            )

            try {
              executeGlyphScript(glyph, instanceKey)
              components = glyphInstance.components || []
            } finally {
              instanceManager.releaseTemporaryInstance(instanceKey)
            }
          } catch (error) {
            console.warn(`[GlyphRenderer] Failed to execute script for ${glyph.uuid}:`, error)
          }
        }

        if (components.length === 0) {
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

        // 异步存储新格式到 IndexedDB
        if (allContours.length > 0 && !glyph.previewRef) {
          const { IndexedDBManager } = await import('../storage/IndexedDBManager')
          const previewKey = IndexedDBManager.generatePreviewKey(glyph.uuid)
          indexedDBManager.set(previewKey, { nonzero: nonzeroContours, solid: solidContours }).then(() => {
            glyph.previewRef = previewKey
            if (import.meta.env.DEV) {
              console.log(`[GlyphRenderer] Saved preview to IndexedDB for ${glyph.uuid}`)
            }
          }).catch(error => {
            console.error(`[GlyphRenderer] Failed to save preview to IndexedDB for ${glyph.uuid}:`, error)
          })
        }
      }

      const allContoursCombined = [...(nonzeroContours || []), ...solidContours]
      if (allContoursCombined.length === 0) {
        RenderEngine.clearCanvas(canvas)
        return true
      }

      // 获取预览样式（从全局 store）
      const { useProjectStore } = await import('@/stores/project')
      const projectStore = useProjectStore()
      const previewStyle = projectStore.fontPreviewStyle

      // 计算所有轮廓的边界框（用于居中）
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const contour of allContoursCombined) {
        for (const path of contour) {
          minX = Math.min(minX, path.start.x, path.end.x)
          minY = Math.min(minY, path.start.y, path.end.y)
          maxX = Math.max(maxX, path.start.x, path.end.x)
          maxY = Math.max(maxY, path.start.y, path.end.y)
          if (path.type === PathType.QUADRATIC_BEZIER) {
            const qPath = path as { control: { x: number; y: number } }
            minX = Math.min(minX, qPath.control.x)
            minY = Math.min(minY, qPath.control.y)
            maxX = Math.max(maxX, qPath.control.x)
            maxY = Math.max(maxY, qPath.control.y)
          } else if (path.type === PathType.CUBIC_BEZIER) {
            const cPath = path as { control1: { x: number; y: number }; control2: { x: number; y: number } }
            minX = Math.min(minX, cPath.control1.x, cPath.control2.x)
            minY = Math.min(minY, cPath.control1.y, cPath.control2.y)
            maxX = Math.max(maxX, cPath.control1.x, cPath.control2.x)
            maxY = Math.max(maxY, cPath.control1.y, cPath.control2.y)
          }
        }
      }

      const contentWidth = maxX - minX
      const contentHeight = maxY - minY
      const offsetX = (canvas.width - contentWidth) / 2 - minX
      const offsetY = (canvas.height - contentHeight) / 2 - minY

      RenderEngine.renderPreview(canvas, nonzeroContours || [], {
        fillColors: [],
        previewStyle,
        scale: 1,
        offset: { x: offsetX, y: offsetY },
        solidContours,
      })

      // 标记 Canvas 已渲染
      CanvasManager.markCanvasRendered(canvas, glyph.uuid)

      // 缓存渲染结果
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        await CanvasManager.setRenderCache(glyph.uuid, imageData)
      }

      return true
    } catch (error) {
      console.error(`Failed to render glyph ${glyph.uuid}:`, error)
      return false
    }
  }
}
