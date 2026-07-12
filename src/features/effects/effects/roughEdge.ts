/**
 * 粗糙边缘效果
 * 沿轮廓法线方向施加 Perlin 噪声扰动，产生手工撕纸/老旧印刷的毛糙感
 */

import type { IComponent } from '@/core/types'
import {
  penComponentsToContours,
  contourToPolyline,
  computeNormals,
  polylineToPenComponent,
} from '../utils/contourOps'
import { noise1DFreq } from '../utils/noise'

/**
 * 粗糙边缘
 * @param components pen 组件列表
 * @param params { amplitude: 扰动幅度, frequency: 噪声频率, seed: 随机种子 }
 * @returns 新的 pen 组件列表
 */
export function applyRoughEdge(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const amplitude = params.amplitude ?? 3
  const frequency = params.frequency ?? 8
  const seed = params.seed ?? 0

  if (amplitude === 0) return components

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    const results: IComponent[] = []

    for (const contour of contours) {
      const polyline = contourToPolyline(contour, 1.0)
      if (polyline.length < 3) continue

      const normals = computeNormals(polyline)
      const n = polyline.length

      // 沿法线施加噪声扰动
      const perturbed = polyline.map((pt, i) => {
        const t = i / n
        const noiseVal = noise1DFreq(t, frequency, seed)
        const offset = noiseVal * amplitude
        const normal = normals[i]
        return {
          x: pt.x + normal.nx * offset,
          y: pt.y + normal.ny * offset,
        }
      })

      const comp = polylineToPenComponent(perturbed, `rough_${results.length}`)
      if (comp) results.push(comp)
    }

    return results.length > 0 ? results : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[roughEdge] failed:', e)
    }
    return components
  }
}
