/**
 * 钢笔路径编辑纯函数工具
 * 提供锚点增删、控制点定位、贝塞尔分割等纯函数，
 * 供 PenSelectTool（字符/字形/骨架轮廓编辑）与 PenTool（创建）共用。
 *
 * 路径点布局约定（与渲染器一致）：
 * - 锚点位于索引 0, 3, 6, ...（type === 'anchor'）
 * - 贝塞尔段：(锚点A, 控制点c1, 控制点c2, 锚点B)，由渲染循环 i = 1; i <= len-3; i += 3 绘制
 * - 闭合路径的收尾段：由 closePath 直线绘制（或显式的 [cIn0, a0dup] 结构）
 */

import type { IPoint } from '@/core/script/types'
import { genUUID } from '@/utils/uuid'
import { roundToPrecision } from '@/utils/number'

export interface PointXY {
  x: number
  y: number
}

/** 路径段描述（坐标取自传入 points 所在的坐标系） */
export interface PenPathSegment {
  type: 'bezier' | 'line'
  /** 段起点锚点在 points 中的索引 */
  startIndex: number
  /** 段终点锚点在 points 中的索引（闭合直线段为最后一段贝塞尔的终点锚点索引） */
  endIndex: number
  c1Index: number
  c2Index: number
  p0: PointXY
  c1: PointXY
  c2: PointXY
  p3: PointXY
}

/** 贝塞尔/直线分割后的五个新点坐标 */
export interface SplitPoints {
  c1a: PointXY
  c2a: PointXY
  mid: PointXY
  c1b: PointXY
  c2b: PointXY
}

export interface PathHit {
  segIndex: number
  t: number
  point: PointXY
  dist: number
}

function lerp(a: PointXY, b: PointXY, t: number): PointXY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function dist2(a: PointXY, b: PointXY): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/**
 * 收集所有锚点索引（type === 'anchor'）
 */
export function collectAnchorIndices(points: IPoint[]): number[] {
  const indices: number[] = []
  for (let i = 0; i < points.length; i++) {
    if (points[i]?.type === 'anchor') indices.push(i)
  }
  return indices
}

/**
 * 构建路径段列表（与 EditorCanvasRenderer 的贝塞尔绘制循环一致）
 * 闭合路径额外附加最后一段贝塞尔终点 → 首锚点的直线段（对应 ctx.closePath 的直线收尾）
 */
export function getPenSegments(points: IPoint[], closePath: boolean): PenPathSegment[] {
  const segments: PenPathSegment[] = []
  let lastEndIndex = -1

  for (let i = 1; i <= points.length - 3; i += 3) {
    segments.push({
      type: 'bezier',
      startIndex: i - 1,
      endIndex: i + 2,
      c1Index: i,
      c2Index: i + 1,
      p0: { x: points[i - 1].x, y: points[i - 1].y },
      c1: { x: points[i].x, y: points[i].y },
      c2: { x: points[i + 1].x, y: points[i + 1].y },
      p3: { x: points[i + 2].x, y: points[i + 2].y },
    })
    lastEndIndex = i + 2
  }

  if (closePath && lastEndIndex >= 0 && points.length > 0) {
    segments.push({
      type: 'line',
      startIndex: lastEndIndex,
      endIndex: 0,
      c1Index: -1,
      c2Index: -1,
      p0: { x: points[lastEndIndex].x, y: points[lastEndIndex].y },
      c1: { x: 0, y: 0 },
      c2: { x: 0, y: 0 },
      p3: { x: points[0].x, y: points[0].y },
    })
  }

  return segments
}

/** 三次贝塞尔在 t 处的点 */
function bezierPoint(p0: PointXY, c1: PointXY, c2: PointXY, p3: PointXY, t: number): PointXY {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  }
}

/**
 * 计算点 (x, y) 到三次贝塞尔曲线的最近点（采样 + 牛顿迭代细化）
 */
export function closestPointOnBezier(
  p0: PointXY, c1: PointXY, c2: PointXY, p3: PointXY,
  x: number, y: number,
): { t: number; point: PointXY; dist: number } {
  const SAMPLES = 30
  let bestT = 0
  let bestD = Infinity
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const p = bezierPoint(p0, c1, c2, p3, t)
    const d = dist2(p, { x, y })
    if (d < bestD) {
      bestD = d
      bestT = t
    }
  }

  // 牛顿迭代：求 dot(B(t) - P, B'(t)) = 0 的根
  let t = bestT
  for (let iter = 0; iter < 8; iter++) {
    const mt = 1 - t
    const a = mt * mt * mt
    const b = 3 * mt * mt * t
    const c = 3 * mt * t * t
    const d = t * t * t
    const px = a * p0.x + b * c1.x + c * c2.x + d * p3.x
    const py = a * p0.y + b * c1.y + c * c2.y + d * p3.y

    const mt2 = mt * mt
    const t2 = t * t
    const dx = 3 * (mt2 * (c1.x - p0.x) + 2 * mt * t * (c2.x - c1.x) + t2 * (p3.x - c2.x))
    const dy = 3 * (mt2 * (c1.y - p0.y) + 2 * mt * t * (c2.y - c1.y) + t2 * (p3.y - c2.y))

    const d2x = 6 * (mt * (c2.x - 2 * c1.x + p0.x) + t * (p3.x - 2 * c2.x + c1.x))
    const d2y = 6 * (mt * (c2.y - 2 * c1.y + p0.y) + t * (p3.y - 2 * c2.y + c1.y))

    const f = (px - x) * dx + (py - y) * dy
    const fd = dx * dx + dy * dy + (px - x) * d2x + (py - y) * d2y
    if (Math.abs(fd) < 1e-12) break
    const nt = Math.min(1, Math.max(0, t - f / fd))
    if (Math.abs(nt - t) < 1e-6) {
      t = nt
      break
    }
    t = nt
  }

  const point = bezierPoint(p0, c1, c2, p3, t)
  return { t, point, dist: Math.sqrt(dist2(point, { x, y })) }
}

/**
 * 计算点 (x, y) 到线段的最近点
 */
export function closestPointOnLine(p0: PointXY, p3: PointXY, x: number, y: number): { t: number; point: PointXY; dist: number } {
  const vx = p3.x - p0.x
  const vy = p3.y - p0.y
  const len2 = vx * vx + vy * vy
  let t = 0
  if (len2 > 1e-12) {
    t = Math.min(1, Math.max(0, ((x - p0.x) * vx + (y - p0.y) * vy) / len2))
  }
  const point = { x: p0.x + vx * t, y: p0.y + vy * t }
  return { t, point, dist: Math.sqrt(dist2(point, { x, y })) }
}

/**
 * 在所有路径段中寻找距 (x, y) 最近且在 maxDist 内的点
 */
export function findClosestOnPath(segments: PenPathSegment[], x: number, y: number, maxDist: number): PathHit | null {
  let best: PathHit | null = null
  let bestDist = Infinity
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const result =
      seg.type === 'bezier'
        ? closestPointOnBezier(seg.p0, seg.c1, seg.c2, seg.p3, x, y)
        : closestPointOnLine(seg.p0, seg.p3, x, y)
    if (result.dist < bestDist) {
      bestDist = result.dist
      best = { segIndex: i, t: result.t, point: result.point, dist: result.dist }
    }
  }
  if (!best || best.dist > maxDist) return null
  return best
}

/**
 * de Casteljau 分割三次贝塞尔：
 * 左段 (p0 → mid) 控制点为 c1a/c2a，右段 (mid → p3) 控制点为 c1b/c2b
 */
export function splitCubicAt(p0: PointXY, c1: PointXY, c2: PointXY, p3: PointXY, t: number): SplitPoints {
  const p01 = lerp(p0, c1, t)
  const p12 = lerp(c1, c2, t)
  const p23 = lerp(c2, p3, t)
  const p012 = lerp(p01, p12, t)
  const p123 = lerp(p12, p23, t)
  const mid = lerp(p012, p123, t)
  return { c1a: p01, c2a: p012, mid, c1b: p123, c2b: p23 }
}

/**
 * 直线段的分割点（控制点位于三等分处，保证形状仍是直线）
 */
export function lineSplitPoints(p0: PointXY, p3: PointXY, t: number): SplitPoints {
  const mid = lerp(p0, p3, t)
  return {
    c1a: lerp(p0, mid, 1 / 3),
    c2a: lerp(p0, mid, 2 / 3),
    mid,
    c1b: lerp(mid, p3, 1 / 3),
    c2b: lerp(mid, p3, 2 / 3),
  }
}

function makePoint(type: 'anchor' | 'control', x: number, y: number, origin: string | null): IPoint {
  return {
    uuid: genUUID(),
    type,
    x: roundToPrecision(x, 2),
    y: roundToPrecision(y, 2),
    origin,
    isShow: true,
  }
}

/**
 * 在贝塞尔段（startAnchorIdx 起）插入新锚点
 * ins 为已转换到目标坐标系的五个分割点
 */
export function insertBezierSplit(
  points: IPoint[],
  startAnchorIdx: number,
  ins: SplitPoints,
): { points: IPoint[]; newAnchorUUID: string } {
  const startAnchor = points[startAnchorIdx]
  const endAnchor = points[startAnchorIdx + 3]
  if (!startAnchor || !endAnchor || startAnchor.type !== 'anchor') {
    return { points: points.slice(), newAnchorUUID: '' }
  }

  const newAnchor = makePoint('anchor', ins.mid.x, ins.mid.y, null)
  const c1a = makePoint('control', ins.c1a.x, ins.c1a.y, startAnchor.uuid)
  const c2a = makePoint('control', ins.c2a.x, ins.c2a.y, newAnchor.uuid)
  const c1b = makePoint('control', ins.c1b.x, ins.c1b.y, newAnchor.uuid)
  const c2b = makePoint('control', ins.c2b.x, ins.c2b.y, endAnchor.uuid)

  // 用分割后的五个新点替换段原有的两个控制点：[A, c1, c2, B] → [A, c1a, c2a, Anew, c1b, c2b, B]
  const next = points.slice()
  next.splice(startAnchorIdx + 1, 2, c1a, c2a, newAnchor, c1b, c2b)
  return { points: next, newAnchorUUID: newAnchor.uuid }
}

/**
 * 在闭合路径的收尾直线段（lastAnchorIdx → 首锚点）插入新锚点。
 * 移除末尾的悬空控制点（收尾直线段原本未渲染），并追加显式的收尾贝塞尔结构
 * [c1a, c2a, 新锚点, c1b, c2b, a0dup]，使渲染器能正确绘制插入后的两段曲线。
 */
export function insertClosingLineSplit(
  points: IPoint[],
  lastAnchorIdx: number,
  ins: SplitPoints,
): { points: IPoint[]; newAnchorUUID: string } {
  const next = points.slice()
  // 移除末尾未参与渲染的悬空控制点（钢笔工具创建闭合路径时留下的收尾段控制点）
  if (next.length > 0 && next[next.length - 1].type === 'control') {
    next.pop()
  }

  const startAnchor = points[lastAnchorIdx]
  const endAnchor = points[0]
  if (!startAnchor || !endAnchor || endAnchor.type !== 'anchor') {
    return { points: next, newAnchorUUID: '' }
  }

  const newAnchor = makePoint('anchor', ins.mid.x, ins.mid.y, null)
  const c1a = makePoint('control', ins.c1a.x, ins.c1a.y, startAnchor.uuid)
  const c2a = makePoint('control', ins.c2a.x, ins.c2a.y, newAnchor.uuid)
  const c1b = makePoint('control', ins.c1b.x, ins.c1b.y, newAnchor.uuid)
  const c2b = makePoint('control', ins.c2b.x, ins.c2b.y, endAnchor.uuid)
  // 收尾锚点：与首锚点重合（保持 closePath 收尾语义）
  const closingDup = makePoint('anchor', endAnchor.x, endAnchor.y, null)

  next.push(c1a, c2a, newAnchor, c1b, c2b, closingDup)
  return { points: next, newAnchorUUID: newAnchor.uuid }
}

/**
 * 删除锚点（连同其相邻控制点），保证结果数组布局合法。
 * - 首锚点：删除整个首段（锚点 + 后续两个控制点）；闭合路径同时删除与之重合的收尾结构
 * - 尾锚点：删除其前接控制点 + 锚点 + 悬空收尾控制点
 * - 中间锚点：删除前接控制点 + 锚点 + 后继控制点
 * 若删除后不再有任何锚点则返回 null。
 */
export function removeAnchorAt(points: IPoint[], anchorIdx: number, closePath: boolean): IPoint[] | null {
  const len = points.length
  if (anchorIdx < 0 || anchorIdx >= len || points[anchorIdx]?.type !== 'anchor') return null

  let lastAnchorIdx = -1
  for (let i = 0; i < len; i++) {
    if (points[i].type === 'anchor') lastAnchorIdx = i
  }
  if (lastAnchorIdx === -1) return null

  const toRemove = new Set<number>()

  if (anchorIdx === 0) {
    // 删除首锚点：首段整体删除
    for (let i = 0; i <= 2 && i < len; i++) toRemove.add(i)
    if (closePath && lastAnchorIdx > 0) {
      const first = points[0]
      const last = points[lastAnchorIdx]
      // 收尾锚点与首锚点重合 → 一并删除收尾结构
      if (Math.abs(last.x - first.x) < 0.001 && Math.abs(last.y - first.y) < 0.001) {
        if (lastAnchorIdx - 1 > 0 && points[lastAnchorIdx - 1].type === 'control') toRemove.add(lastAnchorIdx - 1)
        toRemove.add(lastAnchorIdx)
        if (lastAnchorIdx + 1 < len && points[lastAnchorIdx + 1].type === 'control') toRemove.add(lastAnchorIdx + 1)
      }
    }
  } else {
    // 尾锚点 / 中间锚点：删除前接控制点 + 锚点 + 后继（悬空）控制点
    if (anchorIdx - 1 >= 0 && points[anchorIdx - 1].type === 'control') toRemove.add(anchorIdx - 1)
    toRemove.add(anchorIdx)
    if (anchorIdx + 1 < len && points[anchorIdx + 1].type === 'control') toRemove.add(anchorIdx + 1)
  }

  let next = points.filter((_, i) => !toRemove.has(i))
  if (!next.some((p) => p.type === 'anchor')) {
    // 回退：仅删除首段，保留收尾结构（闭合双锚点路径删除首锚点后仍保留一个锚点）
    const fallback = points.filter((_, i) => i !== 0 && i !== 1 && i !== 2)
    if (fallback.some((p) => p.type === 'anchor')) {
      next = fallback
    } else {
      return null
    }
  }
  return next
}

/**
 * 移动指定索引的点（dx/dy 为逻辑坐标增量），
 * 闭合路径下同步移动与首锚点重合的收尾锚点（与鼠标拖拽逻辑一致）
 */
export function movePointSynced(
  points: IPoint[],
  idx: number,
  dx: number,
  dy: number,
  closePath: boolean,
): IPoint[] {
  if (idx < 0 || idx >= points.length) return points.slice()
  const next = points.map((p) => ({ ...p }))
  const target = next[idx]
  const nx = roundToPrecision(target.x + dx, 2)
  const ny = roundToPrecision(target.y + dy, 2)

  if (target.type === 'anchor' && closePath) {
    if (idx < 2) {
      for (let i = next.length - 2; i < next.length; i++) {
        if (next[i]?.type === 'anchor' && next[i].x === target.x && next[i].y === target.y) {
          next[i].x = nx
          next[i].y = ny
        }
      }
    } else if (idx > next.length - 3) {
      for (let i = 0; i < 2; i++) {
        if (next[i]?.type === 'anchor' && next[i].x === target.x && next[i].y === target.y) {
          next[i].x = nx
          next[i].y = ny
        }
      }
    }
  }

  target.x = nx
  target.y = ny
  return next
}

/**
 * 获取锚点的左控制点（前接）与右控制点（后继）索引，不存在则为 -1。
 * 闭合路径特殊情形（与 PenSelectTool 既有语义一致）：
 * - 首锚点的左控制点：显式收尾贝塞尔结构中的 cIn0（数组末尾倒数第二项）
 * - 末尾重合锚点的右控制点：与首锚点共享的 points[1]
 */
export function anchorControlIndices(points: IPoint[], anchorIdx: number, closePath: boolean): { left: number; right: number } {
  const len = points.length
  let left = -1
  let right = -1

  if (anchorIdx - 1 >= 0 && points[anchorIdx - 1]?.type === 'control') left = anchorIdx - 1
  if (anchorIdx + 1 < len && points[anchorIdx + 1]?.type === 'control') right = anchorIdx + 1

  if (closePath) {
    const first = points[0]
    // 首锚点：收尾显式贝塞尔（…, cOutN, cIn0, a0dup）中 a0 的左控制点
    if (anchorIdx === 0 && left === -1 && len >= 2 && points[len - 1]?.type === 'anchor' && points[len - 2]?.type === 'control') {
      const last = points[len - 1]
      if (Math.abs(last.x - first.x) < 0.001 && Math.abs(last.y - first.y) < 0.001) {
        left = len - 2
      }
    }
    // 末尾重合锚点：与首锚点共享右控制点
    if (anchorIdx === len - 1 && right === -1 && len >= 2 && points[1]?.type === 'control') {
      const cur = points[len - 1]
      if (cur.type === 'anchor' && Math.abs(cur.x - first.x) < 0.001 && Math.abs(cur.y - first.y) < 0.001) {
        right = 1
      }
    }
  }

  return { left, right }
}

/**
 * 按方向（+1 下一个 / -1 上一个）在锚点列表中循环切换
 * currentIdx 不在列表中时返回方向上的首个锚点索引
 */
export function nextAnchorIndex(anchorIndices: number[], currentIdx: number, direction: 1 | -1): number {
  if (anchorIndices.length === 0) return -1
  const pos = anchorIndices.indexOf(currentIdx)
  if (pos === -1) {
    return direction === 1 ? anchorIndices[0] : anchorIndices[anchorIndices.length - 1]
  }
  const nextPos = (pos + direction + anchorIndices.length) % anchorIndices.length
  return anchorIndices[nextPos]
}
