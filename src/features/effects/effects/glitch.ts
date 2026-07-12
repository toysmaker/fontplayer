/**
 * 故障撕裂效果
 * 用 Paper.js intersect 将轮廓按水平 band 矩形裁剪 → 位移 → 布尔合并
 */

import paper from 'paper'
import type { IComponent, IContour } from '@/core/types'
import { penComponentsToContours, contourToPolyline, getBounds, contoursToPenComponents } from '../utils/contourOps'
import { createPRNG } from '../utils/noise'
import { paperPathToContour, contourToPaperPath } from '@/core/utils/contourDilate'

/**
 * 故障撕裂
 */
export function applyGlitch(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const sliceHeight = params.sliceHeight ?? 20
  const maxShift = params.maxShift ?? 15
  const gapProbability = params.gapProbability ?? 0.1
  const seed = params.seed ?? 0

  if (maxShift === 0 && gapProbability === 0) return components

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    const rng = createPRNG(seed)

    // 计算全局 y 范围
    let globalMinY = Infinity, globalMaxY = -Infinity, globalMinX = Infinity, globalMaxX = -Infinity
    for (const contour of contours) {
      const polyline = contourToPolyline(contour, 1.0)
      if (polyline.length < 3) continue
      const b = getBounds(polyline)
      if (b.minY < globalMinY) globalMinY = b.minY
      if (b.maxY > globalMaxY) globalMaxY = b.maxY
      if (b.minX < globalMinX) globalMinX = b.minX
      if (b.maxX > globalMaxX) globalMaxX = b.maxX
    }

    if (globalMaxY <= globalMinY) return components

    const bandStartY = Math.floor(globalMinY / sliceHeight) * sliceHeight
    const numBands = Math.ceil((globalMaxY - bandStartY) / sliceHeight)
    const bandWidth = globalMaxX - globalMinX + maxShift * 4

    // 为每个 band 分配随机位移
    const bandShifts: number[] = []
    for (let b = 0; b < numBands; b++) {
      if (rng() < gapProbability) {
        bandShifts.push(0)
      } else {
        bandShifts.push((rng() * 2 - 1) * maxShift)
      }
    }

    // 收集所有位移后的 band 片段
    const allPieces: paper.PathItem[] = []

    for (const contour of contours) {
      const origPath = contourToPaperPath(contour as any)
      if (!origPath || origPath.curves.length === 0) continue

      for (let b = 0; b < numBands; b++) {
        const shift = bandShifts[b]
        const yBottom = bandStartY + b * sliceHeight
        const yTop = yBottom + sliceHeight

        // 创建 band 矩形（足够宽以覆盖整个字形 + 位移空间）
        const bandRect = new paper.Path.Rectangle(
          new paper.Rectangle(
            globalMinX - maxShift * 2,
            yBottom,
            bandWidth,
            sliceHeight,
          ),
        )

        // 对原始路径进行裁剪（只保留 band 矩形内的部分）
        try {
          const clipped = origPath.intersect(bandRect) as paper.PathItem
          bandRect.remove()

          if (!clipped || (clipped as any).isEmpty?.()) {
            clipped?.remove()
            continue
          }

          if (shift !== 0) {
            // 位移
            ;(clipped as any).translate(new paper.Point(shift, 0))
          }

          allPieces.push(clipped)
        } catch {
          bandRect.remove()
        }
      }

      origPath.remove()
    }

    if (allPieces.length === 0) return components

    // 布尔合并所有片段
    let merged: paper.PathItem = allPieces[0]
    for (let i = 1; i < allPieces.length; i++) {
      try {
        merged = merged.unite(allPieces[i]) as paper.PathItem
        allPieces[i].remove()
      } catch {
        // skip
      }
    }

    // 提取结果轮廓
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

    const result = contoursToPenComponents(resultContours as unknown as IContour[], 'glitch')
    return result.length > 0 ? result : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[glitch] failed:', e)
    }
    return components
  }
}
