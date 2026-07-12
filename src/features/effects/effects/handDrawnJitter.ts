/**
 * 手绘颤动效果
 * 细分 + 随机点扰动，让曲线看起来像手写的
 */

import type { IComponent } from '@/core/types'
import {
  penComponentsToContours,
  contourToPolyline,
  polylineToPenComponent,
} from '../utils/contourOps'
import { createPRNG } from '../utils/noise'

/**
 * 手绘颤动
 * @param components pen 组件列表
 * @param params { jitterAmplitude: 抖动幅度, subdivisions: 细分次数, seed: 随机种子 }
 * @returns 新的 pen 组件列表
 */
export function applyHandDrawnJitter(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const jitterAmplitude = params.jitterAmplitude ?? 3
  const subdivisions = params.subdivisions ?? 2
  const seed = params.seed ?? 0

  if (jitterAmplitude === 0) return components

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    const rng = createPRNG(seed)
    const results: IComponent[] = []

    for (const contour of contours) {
      let polyline = contourToPolyline(contour, 1.0)
      if (polyline.length < 3) continue

      // 细分：在每对相邻点之间插入中点
      for (let s = 0; s < subdivisions; s++) {
        const subdivided: Array<{ x: number; y: number }> = []
        for (let i = 0; i < polyline.length; i++) {
          subdivided.push(polyline[i])
          const next = polyline[(i + 1) % polyline.length]
          subdivided.push({
            x: (polyline[i].x + next.x) / 2,
            y: (polyline[i].y + next.y) / 2,
          })
        }
        polyline = subdivided
      }

      // 随机抖动每个点
      const perturbed = polyline.map((pt) => ({
        x: pt.x + (rng() * 2 - 1) * jitterAmplitude,
        y: pt.y + (rng() * 2 - 1) * jitterAmplitude,
      }))

      const comp = polylineToPenComponent(perturbed, `jitter_${results.length}`)
      if (comp) results.push(comp)
    }

    return results.length > 0 ? results : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[handDrawnJitter] failed:', e)
    }
    return components
  }
}
