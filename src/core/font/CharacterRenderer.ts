/**
 * 字符渲染器
 * 负责渲染字符预览到Canvas
 */

import type { ICharacterFileLite, IFontSettings } from '../types'
import { ContourConverter } from './converter'
import { RenderEngine } from './renderer'
import { CanvasManager } from '../canvas/CanvasManager'
import { PathType } from './types'

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

      // 获取组件列表
      const components = ContourConverter.getComponentsForCharacter(
        characterFile
      )

      if (components.length === 0) {
        // 没有组件，清空Canvas
        RenderEngine.clearCanvas(canvas)
        return true
      }

      // 准备转换选项
      const unitsPerEm = fontSettings?.unitsPerEm || 1000
      const descender = fontSettings?.descender || -200

      if (characterFile.character.text === '三') {
        console.log('DEBUG: 三')
        // debugger
      }

      // 转换为轮廓
      const contours = await ContourConverter.componentsToContours(
        components,
        {
          unitsPerEm,
          descender,
          advanceWidth: unitsPerEm,
          preview: true,
        },
        { x: 0, y: 0 }
      )

      if (contours.length === 0) {
        // 没有轮廓，清空Canvas
        console.warn(`No contours generated for character ${characterFile.uuid}, components count: ${components.length}`)
        RenderEngine.clearCanvas(canvas)
        return true
      }
      
      console.log(`Generated ${contours.length} contours for character ${characterFile.uuid}`)

      // 获取填充颜色
      const fillColors = ContourConverter.getFillColors(components)

      // 注意：预览轮廓已经在 converter.ts 中进行了缩放（scale = 100 / unitsPerEm）
      // 所以这里不需要再次缩放，只需要应用偏移来居中显示
      // 计算居中偏移（假设字符内容在 unitsPerEm 范围内，预览已经缩放到 100 范围内）
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

      // 渲染到Canvas（预览轮廓已经是缩放后的，所以 scale = 1）
      RenderEngine.renderPreview(canvas, contours, {
        fillColors,
        previewStyle: fillColors.length > 0 ? 'color' : 'black',
        scale: 1, // 预览轮廓已经是缩放后的，不需要再次缩放
        offset: { x: offsetX, y: offsetY }, // 居中偏移
      })
      
      // 标记 Canvas 已渲染（用于检测 Canvas 复用）
      CanvasManager.markCanvasRendered(canvas, characterFile.uuid)
      
      // 缓存渲染结果（异步存储到 IndexedDB，不阻塞）
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        // 异步存储，不阻塞主线程
        CanvasManager.setRenderCache(characterFile.uuid, imageData).catch(error => {
          console.error(`Failed to cache render result for ${characterFile.uuid}:`, error)
        })
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
