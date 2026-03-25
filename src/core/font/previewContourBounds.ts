/**
 * 列表/缩略图预览：根据轮廓计算居中用的轴对齐包围盒。
 * 仅用端点+控制点会低估二次/三次贝塞尔的真实范围，居中后会出现整字偏左/偏右（编辑画布直接描边则正常）。
 */

import type { IContours } from './types'
import { PathType } from './types'

const BEZIER_SAMPLE_STEPS = 16

function cubicPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
) {
  const u = 1 - t
  const uu = u * u
  const uuu = uu * u
  const tt = t * t
  const ttt = tt * t
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

function quadPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

/**
 * 合并后的轮廓列表（含实心矩形/椭圆等）上计算用于预览居中的 AABB。
 */
export function computePreviewContoursBounds(contours: IContours): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const contour of contours) {
    for (const path of contour) {
      minX = Math.min(minX, path.start.x, path.end.x)
      minY = Math.min(minY, path.start.y, path.end.y)
      maxX = Math.max(maxX, path.start.x, path.end.x)
      maxY = Math.max(maxY, path.start.y, path.end.y)

      if (path.type === PathType.QUADRATIC_BEZIER) {
        const q = path as {
          start: { x: number; y: number }
          control: { x: number; y: number }
          end: { x: number; y: number }
        }
        for (let i = 0; i <= BEZIER_SAMPLE_STEPS; i++) {
          const t = i / BEZIER_SAMPLE_STEPS
          const p = quadPoint(t, q.start, q.control, q.end)
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        }
      } else if (path.type === PathType.CUBIC_BEZIER) {
        const c = path as {
          start: { x: number; y: number }
          control1: { x: number; y: number }
          control2: { x: number; y: number }
          end: { x: number; y: number }
        }
        for (let i = 0; i <= BEZIER_SAMPLE_STEPS; i++) {
          const t = i / BEZIER_SAMPLE_STEPS
          const p = cubicPoint(t, c.start, c.control1, c.control2, c.end)
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        }
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return { minX, minY, maxX, maxY }
}
