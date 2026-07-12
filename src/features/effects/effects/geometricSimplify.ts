/**
 * 几何简化效果
 * 使用 RDP 简化 + 贝塞尔拟合减少节点，使曲线硬朗化
 */

import type { IComponent } from '@/core/types'
import { penComponentsToContours, contourToPolyline, simplifyPolyline, polylineToPenComponent } from '../utils/contourOps'

/**
 * 几何简化
 * @param components pen 组件列表
 * @param params { tolerance: RDP 容差, curveError: 贝塞尔拟合容差 }
 * @returns 新的 pen 组件列表
 */
export function applyGeometricSimplify(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const tolerance = params.tolerance ?? 3
  const curveError = params.curveError ?? 3

  try {
    const contours = penComponentsToContours(components)
    if (contours.length === 0) return components

    const results: IComponent[] = []

    for (const contour of contours) {
      // 采样为折线
      const polyline = contourToPolyline(contour, curveError)
      if (polyline.length < 3) continue

      // RDP 简化
      const simplified = simplifyPolyline(polyline, tolerance)
      if (simplified.length < 3) {
        // 如果简化后点太少，保留原始折线的最少3个点
        if (polyline.length >= 3) {
          const step = Math.max(1, Math.floor(polyline.length / 3))
          const sparse = [polyline[0]]
          for (let i = step; i < polyline.length - step; i += step) {
            sparse.push(polyline[i])
          }
          sparse.push(polyline[polyline.length - 1])
          const comp = polylineToPenComponent(sparse, `simplify_${results.length}`)
          if (comp) results.push(comp)
        }
        continue
      }

      // 转为 pen 组件
      const comp = polylineToPenComponent(simplified, `simplify_${results.length}`)
      if (comp) results.push(comp)
    }

    return results.length > 0 ? results : components
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[geometricSimplify] failed:', e)
    }
    return components
  }
}
