/**
 * 折线工具函数
 * 包含 RDP（Ramer-Douglas-Peucker）简化、距离计算等
 */

/** 2D 坐标点 */
export type Vec2 = { x: number; y: number }

/** 计算点 p 到线段 ab 的最短距离 */
export function pointToSegmentDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** 计算折线总长度 */
export function polylineLength(points: Vec2[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return len
}

/**
 * Ramer-Douglas-Peucker 折线简化算法
 * @param points 原始点集
 * @param epsilon 简化容差（像素），值越大简化越多
 * @returns 简化后的点集
 */
export function simplifyPolyline(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return points

  // 找到距离首尾连线最远的点
  const first = points[0]
  const last = points[points.length - 1]
  let maxDist = 0
  let maxIndex = 0

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToSegmentDist(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  // 如果最大距离大于容差，递归简化
  if (maxDist > epsilon) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), epsilon)
    const right = simplifyPolyline(points.slice(maxIndex), epsilon)
    // 合并结果（去掉重复的中间点）
    return [...left.slice(0, -1), ...right]
  }

  // 否则只保留首尾
  return [first, last]
}

/** 点到线段 ab 的垂直距离（用于弧线检测） */
export function pointToChordDist(p: Vec2, a: Vec2, b: Vec2): number {
  return pointToSegmentDist(p, a, b)
}

/** 计算两点之间的距离 */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 计算两点连线的角度（度，0=右，90=下） */
export function segmentAngle(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
}

/** 计算三点夹角（p2为顶点，p1-p2-p3，度） */
export function angleBetween(p1: Vec2, p2: Vec2, p3: Vec2): number {
  const a1 = segmentAngle(p2, p1)
  const a2 = segmentAngle(p2, p3)
  let diff = Math.abs(a1 - a2)
  if (diff > 180) diff = 360 - diff
  return diff
}

/** 计算单位方向向量 */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y)
  return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 }
}

/** 计算两点间的方向向量 */
export function direction(from: Vec2, to: Vec2): Vec2 {
  return normalize({ x: to.x - from.x, y: to.y - from.y })
}

/** 计算点 p 在线段 ab 上的投影比例 t（0~1）以及垂足距离 */
export function distanceAndFootPoint(
  a: Vec2,
  b: Vec2,
  p: Vec2,
): { percentageFromA: number; distance: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return { percentageFromA: 0, distance: Math.hypot(p.x - a.x, p.y - a.y) }
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  const clampedT = Math.max(0, Math.min(1, t))
  const footX = a.x + clampedT * dx
  const footY = a.y + clampedT * dy
  return {
    percentageFromA: clampedT,
    distance: Math.hypot(p.x - footX, p.y - footY),
  }
}
