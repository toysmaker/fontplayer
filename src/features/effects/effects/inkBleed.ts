/**
 * 油墨洇开效果
 * 模拟墨水在纸上渗透：轻微膨胀 + 边缘噪声扰动 + 随机溅洒墨点
 */

import paper from 'paper'
import type { IComponent } from '@/core/types'
import { PathType } from '@/core/font/types'
import { contourDilate, contourUnite, contourToPaperPath, paperPathToContour } from '@/core/utils/contourDilate'
import {
  penComponentsToContours,
  contourToPolyline,
  computeNormals,
  contoursToPenComponents,
} from '../utils/contourOps'
import { noise1DFreq, createPRNG } from '../utils/noise'

/**
 * 油墨洇开
 */
export function applyInkBleed(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const expandDist = params.expandDist ?? 3
  const roughnessScale = params.roughnessScale ?? 12
  const roughnessAmp = params.roughnessAmp ?? 2
  const splatterDensity = params.splatterDensity ?? 0.1
  const splatterSize = params.splatterSize ?? 3
  const seed = params.seed ?? 0

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    // Step 1: 基础膨胀
    let dilatedContours = contours
    if (expandDist > 0) {
      dilatedContours = contourDilate(contours, expandDist)
      if (dilatedContours.length === 0) return components
    }

    // Step 2: 对膨胀后的轮廓进行噪声粗糙化
    const roughenedContours = dilatedContours.map((contour) => {
      const polyline = contourToPolyline(contour, 1.0)
      if (polyline.length < 3) return contour

      const normals = computeNormals(polyline)
      const n = polyline.length
      const perturbed = polyline.map((pt, i) => {
        const t = i / n
        const noiseVal = noise1DFreq(t, roughnessScale, seed)
        const offset = Math.abs(noiseVal) * roughnessAmp
        const normal = normals[i]
        return {
          x: pt.x + normal.nx * offset,
          y: pt.y + normal.ny * offset,
        }
      })

      // 将扰动后的折线转回轮廓
      try {
        const path = new paper.Path()
        path.moveTo(new paper.Point(perturbed[0].x, perturbed[0].y))
        for (let i = 1; i < perturbed.length; i++) {
          path.lineTo(new paper.Point(perturbed[i].x, perturbed[i].y))
        }
        path.closePath()
        if (path.segments.length > 2) {
          path.simplify(2)
        }
        const result = paperPathToContour(path)
        path.remove()
        return result.length > 0 ? result : contour
      } catch {
        return contour
      }
    })

    // Step 3: 生成溅洒墨点
    const allContours = [...roughenedContours]
    if (splatterDensity > 0 && splatterSize > 0) {
      const rng = createPRNG(seed + 1000)
      for (const contour of dilatedContours) {
        const polyline = contourToPolyline(contour, 2.0)
        if (polyline.length < 3) continue
        const normals = computeNormals(polyline)
        const n = polyline.length

        // 根据密度计算墨点种子数
        const splatterCount = Math.floor(n * splatterDensity)
        for (let s = 0; s < splatterCount; s++) {
          const idx = Math.floor(rng() * n)
          const normal = normals[idx]
          const dist = rng() * splatterSize * 2 + splatterSize * 0.5
          const radius = rng() * splatterSize * 0.8 + splatterSize * 0.2

          const cx = polyline[idx].x + normal.nx * dist
          const cy = polyline[idx].y + normal.ny * dist

          // 生成圆形墨点（用多边形近似）
          const circlePts = 8
          const circleContour: any[] = []
          for (let c = 0; c < circlePts; c++) {
            const angle = (c / circlePts) * Math.PI * 2
            const px = cx + Math.cos(angle) * radius
            const py = cy + Math.sin(angle) * radius
            const nextAngle = ((c + 1) / circlePts) * Math.PI * 2
            const nx = cx + Math.cos(nextAngle) * radius
            const ny = cy + Math.sin(nextAngle) * radius
            circleContour.push({
              type: PathType.LINE as const,
              start: { x: px, y: py },
              end: { x: nx, y: ny },
            })
          }
          if (circleContour.length > 0) {
            allContours.push(circleContour)
          }
        }
      }
    }

    // Step 4: 布尔合并所有轮廓（膨胀 + 粗糙化 + 墨点）
    const merged = contourUnite(allContours)
    if (merged.length === 0) return components

    // Step 5: 转回 pen 组件
    const result = contoursToPenComponents(merged, 'bleed')
    return result.length > 0 ? result : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[inkBleed] failed:', e)
    }
    return components
  }
}
