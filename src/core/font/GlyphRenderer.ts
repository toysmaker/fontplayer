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
      let contours: IContours | null = null
      
      if (glyph.previewRef) {
        try {
          contours = await indexedDBManager.get<IContours>(glyph.previewRef)
          if (contours && contours.length > 0) {
            // 成功从 IndexedDB 加载，直接使用
            if (import.meta.env.DEV) {
              console.log(`[GlyphRenderer] Loaded preview from IndexedDB for ${glyph.uuid}`)
            }
          } else {
            contours = null
          }
        } catch (error) {
          console.warn(`[GlyphRenderer] Failed to load preview from IndexedDB for ${glyph.uuid}:`, error)
          contours = null
        }
      }

      // 如果没有预览数据，需要计算
      if (!contours || contours.length === 0) {
      // 获取组件列表
        let components = glyph.components || []

        // 如果组件为空但字形有脚本，需要先执行脚本生成组件
        // 注意：正常情况下，ProjectLoader 应该已经处理过，这里只是兜底
        if (components.length === 0 && (glyph.script || glyph.script_reference)) {
          try {
            const { executeGlyphScript } = await import('../script/ScriptExecutor')
            const { instanceManager } = await import('../instance/InstanceManager')
            const { CustomGlyph } = await import('../instance/CustomGlyph')
            
            // 创建临时实例并执行脚本
            const instanceKey = glyph.uuid
            const glyphInstance = instanceManager.acquireTemporaryInstance(
              instanceKey,
              () => new CustomGlyph(glyph),
              'glyph'
            )
            
            try {
              await executeGlyphScript(glyph, instanceKey)
              // 从实例获取执行脚本后的组件
              components = glyphInstance.components || []
            } finally {
              instanceManager.releaseTemporaryInstance(instanceKey)
              // 不再维护 glyph._o，统一从 InstanceManager 管理
            }
          } catch (error) {
            console.warn(`[GlyphRenderer] Failed to execute script for ${glyph.uuid}:`, error)
          }
        }

      if (components.length === 0) {
        // 没有组件，清空Canvas
        RenderEngine.clearCanvas(canvas)
        return true
      }

      // 准备转换选项
      const unitsPerEm = fontSettings?.unitsPerEm || 1000
      const descender = fontSettings?.descender || -200

      // 转换为轮廓（字形使用与字符相同的转换逻辑）
        // 注意：ContourConverter 会自动处理字形组件中的脚本执行
        contours = await ContourConverter.componentsToContours(
        components as any,
        {
          unitsPerEm,
          descender,
          advanceWidth: unitsPerEm,
          preview: true,
        },
        { x: 0, y: 0 }
      )

        // 如果计算出了轮廓，存储到 IndexedDB（异步，不阻塞渲染）
        if (contours.length > 0 && !glyph.previewRef) {
          const { IndexedDBManager } = await import('../storage/IndexedDBManager')
          const previewKey = IndexedDBManager.generatePreviewKey(glyph.uuid)
          indexedDBManager.set(previewKey, contours).then(() => {
            glyph.previewRef = previewKey
            if (import.meta.env.DEV) {
              console.log(`[GlyphRenderer] Saved preview to IndexedDB for ${glyph.uuid}`)
            }
          }).catch(error => {
            console.error(`[GlyphRenderer] Failed to save preview to IndexedDB for ${glyph.uuid}:`, error)
          })
        }
      }

      if (contours.length === 0) {
        RenderEngine.clearCanvas(canvas)
        return true
      }

      // 获取填充颜色（如果有）
      const fillColors: string[] = []
      // TODO: 从字形数据中提取填充颜色

      // 为了居中，需要计算内容的边界框
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const contour of contours) {
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

      // 计算居中偏移
      const contentWidth = maxX - minX
      const contentHeight = maxY - minY
      const offsetX = (canvas.width - contentWidth) / 2 - minX
      const offsetY = (canvas.height - contentHeight) / 2 - minY

      // 渲染到Canvas
      RenderEngine.renderPreview(canvas, contours, {
        fillColors,
        previewStyle: fillColors.length > 0 ? 'color' : 'black',
        scale: 1,
        offset: { x: offsetX, y: offsetY },
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
