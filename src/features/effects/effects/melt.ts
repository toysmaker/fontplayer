/**
 * 液化/融化效果
 * 字形像受热融化一样向下流淌，底部出现垂滴
 */

import paper from 'paper'
import type { IComponent } from '@/core/types'
import { PathType } from '@/core/font/types'
import { contourUnite, paperPathToContour } from '@/core/utils/contourDilate'
import {
  penComponentsToContours,
  contourToPolyline,
  getBounds,
  contoursToPenComponents,
} from '../utils/contourOps'
import { noise2D, createPRNG } from '../utils/noise'

/**
 * 液化融化
 */
export function applyMelt(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const amplitude = params.amplitude ?? 10
  const frequency = params.frequency ?? 5
  const dripLength = params.dripLength ?? 15
  const dripCount = params.dripCount ?? 3
  const seed = params.seed ?? 0

  if (amplitude === 0 && dripLength === 0) return components

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    const allContours: any[] = []

    for (const contour of contours) {
      let polyline = contourToPolyline(contour, 1.0)
      if (polyline.length < 3) {
        allContours.push(contour)
        continue
      }

      const bounds = getBounds(polyline)
      const yRange = bounds.h || 1

      // 纵向位移场：底部（y 大）位移更大
      const displaced = polyline.map((pt) => {
        const falloff = Math.max(0, (pt.y - bounds.minY) / yRange)
        const noiseX = noise2D(pt.x * frequency * 0.01, pt.y * frequency * 0.01, seed)
        const noiseY = noise2D(pt.x * frequency * 0.01 + 100, pt.y * frequency * 0.01 + 100, seed)
        return {
          x: pt.x + noiseX * amplitude * falloff * 0.5,
          y: pt.y + Math.abs(noiseY) * amplitude * falloff,
        }
      })

      // 尝试生成垂滴
      const drips: Array<Array<{ x: number; y: number }>> = []
      if (dripLength > 0 && dripCount > 0) {
        const rng = createPRNG(seed + 2000)

        // 找局部最低点
        const localMinima: number[] = []
        for (let i = 0; i < displaced.length; i++) {
          const prev = displaced[(i - 1 + displaced.length) % displaced.length]
          const curr = displaced[i]
          const next = displaced[(i + 1) % displaced.length]
          if (curr.y >= prev.y && curr.y >= next.y) {
            // 只考虑下半部分的点
            if (curr.y > bounds.minY + yRange * 0.5) {
              localMinima.push(i)
            }
          }
        }

        // 随机选择垂滴点
        const selectedMinima = localMinima.sort(() => rng() - 0.5).slice(0, dripCount)
        for (const idx of selectedMinima) {
          const pt = displaced[idx]
          const dripLen = rng() * dripLength * 0.7 + dripLength * 0.3
          const dripWidth = rng() * 4 + 2

          // 生成泪滴形状
          const dripShape: Array<{ x: number; y: number }> = []
          const steps = 6
          for (let s = 0; s <= steps; s++) {
            const t = s / steps
            const dripY = pt.y + t * dripLen
            const width = dripWidth * (1 - t * 0.8)
            dripShape.push({ x: pt.x - width, y: dripY })
          }
          for (let s = steps; s >= 0; s--) {
            const t = s / steps
            const dripY = pt.y + t * dripLen
            const width = dripWidth * (1 - t * 0.8)
            dripShape.push({ x: pt.x + width, y: dripY })
          }
          drips.push(dripShape)
        }
      }

      // 生成融化后的轮廓
      try {
        const mainPath = new paper.Path()
        mainPath.moveTo(new paper.Point(displaced[0].x, displaced[0].y))
        for (let i = 1; i < displaced.length; i++) {
          mainPath.lineTo(new paper.Point(displaced[i].x, displaced[i].y))
        }
        mainPath.closePath()

        // 布尔合并垂滴
        let merged: paper.PathItem = mainPath
        for (const drip of drips) {
          const dripPath = new paper.Path()
          dripPath.moveTo(new paper.Point(drip[0].x, drip[0].y))
          for (let d = 1; d < drip.length; d++) {
            dripPath.lineTo(new paper.Point(drip[d].x, drip[d].y))
          }
          dripPath.closePath()
          merged = merged.unite(dripPath) as paper.PathItem
          dripPath.remove()
        }

        if (merged) {
          const extraChildren = (merged as any).children
          if (extraChildren && extraChildren.length > 0) {
            for (const child of extraChildren) {
              if (child instanceof paper.Path && child.curves.length > 0) {
                const c = paperPathToContour(child)
                if (c.length > 0) allContours.push(c)
              }
            }
          } else if (merged instanceof paper.Path && merged.curves.length > 0) {
            const c = paperPathToContour(merged)
            if (c.length > 0) allContours.push(c)
          }
        }
      } catch {
        allContours.push(contour)
      }
    }

    if (allContours.length === 0) return components

    // 布尔合并
    const merged = contourUnite(allContours)
    if (merged.length === 0) return components

    const result = contoursToPenComponents(merged, 'melt')
    return result.length > 0 ? result : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[melt] failed:', e)
    }
    return components
  }
}
