/**
 * 像素化效果
 * 将光滑矢量字形转换为块状像素风格，边缘呈现"马赛克"锯齿
 */

import paper from 'paper'
import type { IComponent } from '@/core/types'
import { contourUnite, paperPathToContour } from '@/core/utils/contourDilate'
import {
  penComponentsToContours,
  contourToPolyline,
  getBounds,
  contoursToPenComponents,
} from '../utils/contourOps'

/**
 * 像素化
 * @param components pen 组件列表
 * @param params { cellSize: 像素单元格边长 }
 * @returns 新的 pen 组件列表
 */
export function applyPixelate(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const cellSize = params.cellSize ?? 20

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    // 收集所有折线点并计算全局包围盒
    let allPoints: Array<{ x: number; y: number }> = []
    for (const contour of contours) {
      const polyline = contourToPolyline(contour, 1.0)
      allPoints = allPoints.concat(polyline)
    }
    if (allPoints.length < 3) return components

    const bounds = getBounds(allPoints)
    const padding = cellSize
    const minX = bounds.minX - padding
    const minY = bounds.minY - padding
    const w = bounds.w + padding * 2
    const h = bounds.h + padding * 2

    const cols = Math.ceil(w / cellSize)
    const rows = Math.ceil(h / cellSize)

    // Step 1: 渲染到低分辨率离屏 Canvas
    const offscreen = document.createElement('canvas')
    offscreen.width = cols
    offscreen.height = rows
    const ctx = offscreen.getContext('2d')
    if (!ctx) return components

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cols, rows)

    // 在离屏 canvas 上绘制轮廓
    ctx.fillStyle = '#000'
    ctx.beginPath()
    for (const contour of contours) {
      if (contour.length === 0) continue
      const seg0 = contour[0]
      ctx.moveTo(
        (seg0.start.x - minX) / cellSize,
        (seg0.start.y - minY) / cellSize,
      )
      for (const seg of contour) {
        if (seg.type === 0) { // LINE
          ctx.lineTo((seg.end.x - minX) / cellSize, (seg.end.y - minY) / cellSize)
        } else if (seg.type === 2) { // CUBIC_BEZIER
          ctx.bezierCurveTo(
            (seg.control1.x - minX) / cellSize, (seg.control1.y - minY) / cellSize,
            (seg.control2.x - minX) / cellSize, (seg.control2.y - minY) / cellSize,
            (seg.end.x - minX) / cellSize, (seg.end.y - minY) / cellSize,
          )
        } else if (seg.type === 1) { // QUADRATIC_BEZIER
          ctx.quadraticCurveTo(
            (seg.control.x - minX) / cellSize, (seg.control.y - minY) / cellSize,
            (seg.end.x - minX) / cellSize, (seg.end.y - minY) / cellSize,
          )
        }
      }
    }
    ctx.fill()

    // Step 2: 采样像素 → 生成方块
    const imageData = ctx.getImageData(0, 0, cols, rows)
    const pixels = imageData.data

    // 收集所有黑色像素坐标
    const blackCells: Array<{ row: number; col: number }> = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 4
        // 检测是否为黑色（任何非白色像素）
        if (pixels[idx] < 128 && pixels[idx + 1] < 128 && pixels[idx + 2] < 128) {
          blackCells.push({ row: r, col: c })
        }
      }
    }

    if (blackCells.length === 0) return components

    // Step 3: 为每个黑色像素生成方块并做布尔并集
    const cellPaths: paper.Path[] = []
    for (const { row, col } of blackCells) {
      const cx = minX + col * cellSize
      const cy = minY + row * cellSize
      const path = new paper.Path.Rectangle(
        new paper.Rectangle(cx, cy, cellSize, cellSize),
      )
      cellPaths.push(path)
    }

    // 批量布尔合并
    if (cellPaths.length === 0) return components

    let merged: paper.PathItem = cellPaths[0]
    // 分批处理避免性能问题
    const batchSize = 200
    for (let i = 1; i < cellPaths.length; i += batchSize) {
      const end = Math.min(i + batchSize, cellPaths.length)
      for (let j = i; j < end; j++) {
        try {
          merged = merged.unite(cellPaths[j]) as paper.PathItem
          cellPaths[j].remove()
        } catch {
          // skip
        }
      }
    }

    // Step 4: 提取结果轮廓并简化
    const resultContours: any[] = []
    const children = (merged as any).children
    if (children && children.length > 0) {
      for (const child of children) {
        if (child instanceof paper.Path && child.curves.length > 0) {
          const c = paperPathToContour(child)
          if (c.length > 0) resultContours.push(c)
        }
      }
    } else if (merged instanceof paper.Path && merged.curves.length > 0) {
      const c = paperPathToContour(merged)
      if (c.length > 0) resultContours.push(c)
    }
    merged.remove()

    if (resultContours.length === 0) return components

    const mergedContours = contourUnite(resultContours)
    if (mergedContours.length === 0) return components

    const result = contoursToPenComponents(mergedContours, 'pixel')
    return result.length > 0 ? result : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[pixelate] failed:', e)
    }
    return components
  }
}
