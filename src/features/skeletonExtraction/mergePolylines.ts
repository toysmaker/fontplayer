/**
 * 折线段合并算法
 *
 * 将 skeleton-tracing 产生的碎片折线段合并为完整笔画。
 * 核心逻辑：在交叉点处，按端点数量和切线方向区分"折笔"与"交叉"。
 *
 * 合并策略：
 * - 2条折线汇合 → 必为同一笔画的折笔，直接合并（不限方向差）
 * - 3条折线汇合 → T字交叉，共线对合并，垂直者独立
 * - 4+条折线汇合 → 十字交叉，按方向配对其线对合并
 */

import { distance, direction, Vec2 } from '@/utils/polyline'

/** 折线端点描述 */
interface PolylineEndpoint {
  /** 所属折线在输入数组中的索引 */
  polylineIndex: number
  /** 端点坐标 */
  point: Vec2
  /** 是否为起点（true=起点，false=终点） */
  isStart: boolean
  /** 端点朝内的切线方向（单位向量） */
  tangent: Vec2
}

/** 交叉点簇：距离阈值内的端点集合 */
const ENDPOINT_CLUSTER_THRESHOLD = 4 // 像素（放宽以容忍追踪偏移）

/**
 * 计算折线端点处的方向向量（朝内）
 * 从端点向内走 totalLen * 50% 距离（min 50px, max 100px），
 * 取该处的点来确定方向，既不受局部弯曲干扰，也不像弦方向那样丢失曲线信息
 */
function computeEndpointTangent(
  polyline: Vec2[],
  isStart: boolean,
): Vec2 {
  if (polyline.length < 2) return { x: 0, y: 0 }
  let totalLen = 0
  for (let i = 1; i < polyline.length; i++) {
    totalLen += distance(polyline[i - 1], polyline[i])
  }
  const lookDist = Math.max(50, Math.min(100, totalLen * 0.5))

  if (isStart) {
    let accum = 0
    for (let i = 1; i < polyline.length; i++) {
      accum += distance(polyline[i - 1], polyline[i])
      if (accum >= lookDist || i === polyline.length - 1) {
        return direction(polyline[0], polyline[i])
      }
    }
    return direction(polyline[0], polyline[1])
  } else {
    let accum = 0
    for (let i = polyline.length - 2; i >= 0; i--) {
      accum += distance(polyline[i + 1], polyline[i])
      if (accum >= lookDist || i === 0) {
        return direction(polyline[polyline.length - 1], polyline[i])
      }
    }
    return direction(polyline[polyline.length - 1], polyline[polyline.length - 2])
  }
}

/**
 * 提取所有折线的端点信息
 */
export function extractEndpoints(polylines: Vec2[][]): PolylineEndpoint[] {
  const endpoints: PolylineEndpoint[] = []
  for (let i = 0; i < polylines.length; i++) {
    const poly = polylines[i]
    if (poly.length < 2) continue

    endpoints.push({
      polylineIndex: i,
      point: poly[0],
      isStart: true,
      tangent: computeEndpointTangent(poly, true),
    })

    endpoints.push({
      polylineIndex: i,
      point: poly[poly.length - 1],
      isStart: false,
      tangent: computeEndpointTangent(poly, false),
    })
  }
  return endpoints
}

/**
 * 按空间距离将端点聚类为交叉点
 * 使用简单的距离聚类（距离 < threshold 的归为一组）
 */
export function clusterEndpoints(
  endpoints: PolylineEndpoint[],
  threshold: number = ENDPOINT_CLUSTER_THRESHOLD,
): number[] {
  const n = endpoints.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }

  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  // Union-Find 聚类
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue
      // 同一折线的两个端点不应合并
      if (endpoints[i].polylineIndex === endpoints[j].polylineIndex) continue
      if (distance(endpoints[i].point, endpoints[j].point) < threshold) {
        union(i, j)
      }
    }
  }

  // 分配 cluster ID
  const clusterMap = new Map<number, number>()
  const result: number[] = new Array(n)
  let nextId = 0
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!clusterMap.has(root)) {
      clusterMap.set(root, nextId++)
    }
    result[i] = clusterMap.get(root)!
  }
  return result
}

/**
 * 反转折线方向
 */
function reversePolyline(polyline: Vec2[]): Vec2[] {
  return [...polyline].reverse()
}

/**
 * 合并两条折线
 * 反转 b 使得 a 的末端与 b 的首端相连
 */
function mergeTwoPolylines(a: Vec2[], b: Vec2[]): Vec2[] {
  // 交叉点可能位于 a 的起点或终点，b 的起点或终点，共 4 种组合
  // 找距离最近的一对端点，从那里连接
  const aStart = a[0], aEnd = a[a.length - 1]
  const bStart = b[0], bEnd = b[b.length - 1]

  const pairs = [
    { dist: distance(aEnd, bStart), aRev: false, bRev: false },
    { dist: distance(aEnd, bEnd),   aRev: false, bRev: true },
    { dist: distance(aStart, bStart), aRev: true, bRev: false },
    { dist: distance(aStart, bEnd),   aRev: true, bRev: true },
  ]
  // 找最近的一对
  let best = pairs[0]
  for (let i = 1; i < 4; i++) {
    if (pairs[i].dist < best.dist) best = pairs[i]
  }

  const na = best.aRev ? reversePolyline(a) : a
  const nb = best.bRev ? reversePolyline(b) : b
  // 跳过 nb 的第一个点（与 na 的终点重合或接近）
  const skip = distance(na[na.length - 1], nb[0]) <= 3 ? 1 : 0
  return na.concat(nb.slice(skip))
}

/**
 * 移除重复的连续点
 */
function dedupePolyline(polyline: Vec2[]): Vec2[] {
  if (polyline.length <= 1) return polyline
  const result: Vec2[] = [polyline[0]]
  for (let i = 1; i < polyline.length; i++) {
    const last = result[result.length - 1]
    if (distance(last, polyline[i]) > 0.5) {
      result.push(polyline[i])
    }
  }
  return result
}

/**
 * 在一个交叉点处执行合并
 * @param indices 这个交叉点包含的端点索引
 * @param endpoints 全局端点数组
 * @param polylines 原始折线数组
 * @param used 已使用的折线索引集合
 * @returns 新生成的合并折线
 */
function mergeAtJunction(
  indices: number[],
  endpoints: PolylineEndpoint[],
  polylines: Vec2[][],
  used: Set<number>,
): Vec2[][] {
  const merged: Vec2[][] = []
  const n = indices.length

  // 按折线索引去重（同一折线的两个端点可能在同一个交叉点）
  const uniquePolylines = new Map<number, number[]>()
  for (const idx of indices) {
    const ep = endpoints[idx]
    if (used.has(ep.polylineIndex)) continue
    if (!uniquePolylines.has(ep.polylineIndex)) {
      uniquePolylines.set(ep.polylineIndex, [])
    }
    uniquePolylines.get(ep.polylineIndex)!.push(idx)
  }

  const polyIndices = Array.from(uniquePolylines.keys())

  if (polyIndices.length === 2) {
    // ===== 只有2条折线在此汇合 → 必定是折笔 → 直接合并 =====
    const a = polylines[polyIndices[0]], b = polylines[polyIndices[1]]
    if (import.meta.env.DEV) {
      console.log(`[Merge]   PAIR(2-way): poly#${polyIndices[0]}[${a.length}pt] + poly#${polyIndices[1]}[${b.length}pt]`)
    }
    used.add(polyIndices[0])
    used.add(polyIndices[1])
    merged.push(dedupePolyline(mergeTwoPolylines(a, b)))
    return merged
  }

  // ===== 3+条折线 → 真正的笔画交叉点 → 按方向配对 =====
  const epList: Array<{ polyIdx: number; tangent: Vec2 }> = []
  for (const pi of polyIndices) {
    const idxs = uniquePolylines.get(pi)!
    const ep = endpoints[idxs[0]]
    epList.push({ polyIdx: pi, tangent: ep.tangent })
  }

  const usedLocal = new Set<number>()

  if (import.meta.env.DEV) {
    const jp = endpoints[indices[0]].point
    console.log(`[Merge]   Junction at (${jp.x},${jp.y}): ${polyIndices.length} polylines [${polyIndices.join(',')}]`)
    for (const ep of epList) {
      const p = polylines[ep.polyIdx]
      console.log(`[Merge]     poly#${ep.polyIdx}: len=${p.length} start=(${p[0].x},${p[0].y}) end=(${p[p.length-1].x},${p[p.length-1].y}) tg=(${ep.tangent.x.toFixed(3)},${ep.tangent.y.toFixed(3)})`)
    }
  }

  for (let i = 0; i < epList.length; i++) {
    if (usedLocal.has(i)) continue
    let bestJ = -1
    let bestDot = Infinity
    for (let j = i + 1; j < epList.length; j++) {
      if (usedLocal.has(j)) continue
      const dot =
        epList[i].tangent.x * epList[j].tangent.x +
        epList[i].tangent.y * epList[j].tangent.y
      if (dot < bestDot) { bestDot = dot; bestJ = j }
    }
    // cos(130°) ≈ -0.65, 容许曲线在交叉点附近的方向偏差
    if (bestJ >= 0 && bestDot < -0.65) {
      if (import.meta.env.DEV) {
        console.log(`[Merge]     PAIR: poly#${epList[i].polyIdx} + poly#${epList[bestJ].polyIdx} (dot=${bestDot.toFixed(3)})`)
      }
      usedLocal.add(i); usedLocal.add(bestJ)
      used.add(epList[i].polyIdx); used.add(epList[bestJ].polyIdx)
      merged.push(dedupePolyline(
        mergeTwoPolylines(polylines[epList[i].polyIdx], polylines[epList[bestJ].polyIdx]),
      ))
    } else if (bestJ >= 0 && import.meta.env.DEV) {
      console.log(`[Merge]     NO PAIR: poly#${epList[i].polyIdx} best=#${epList[bestJ].polyIdx} dot=${bestDot.toFixed(3)} (> -0.65, not collinear)`)
    } else if (import.meta.env.DEV) {
      console.log(`[Merge]     UNPAIRED: poly#${epList[i].polyIdx} (no partner found)`)
    }
  }

  // 未配对的端点：笔画在此结束/起始
  // 不标记为 used，让它们作为独立笔画保留在结果中

  return merged
}

/**
 * 主入口：合并碎片折线为完整笔画
 *
 * @param polylines 从 Rust skeleton trace 返回的碎片折线段
 * @returns 合并后的完整笔画折线
 */
export function mergePolylines(polylines: Vec2[][]): Vec2[][] {
  if (import.meta.env.DEV) {
    console.log('[Merge] ====== Polylines ======', polylines)
  }
  if (polylines.length <= 1) return polylines

  // 两轮合并：
  // Pass 1 — 处理原始 trace 的所有交叉点
  // Pass 2 — 仅处理 Pass 1 新合并折线的端点与未合并折线的端点之间的聚类
  //         已合并过的两条折线不在 Pass 2 中互相聚类，防止错误连接
  let current = polylines
  for (let iter = 0; iter < 2; iter++) {
    const eps = extractEndpoints(current)
    const cids = clusterEndpoints(eps)
    const groups = new Map<number, number[]>()
    for (let i = 0; i < eps.length; i++) {
      const c = cids[i]
      if (!groups.has(c)) groups.set(c, [])
      groups.get(c)!.push(i)
    }

    const used = new Set<number>()
    const merged: Vec2[][] = []

    if (import.meta.env.DEV) {
      // 打印当前轮次所有折线的端点信息
      console.log(`[Merge] ====== Pass ${iter} endpoints ======`)
      for (let i = 0; i < current.length; i++) {
        const p = current[i]; const s = p[0]; const e = p[p.length - 1]
        console.log(`[Merge]   #${i}: len=${p.length} start=(${s.x},${s.y}) end=(${e.x},${e.y})`)
      }
    }

    for (const [, indices] of groups) {
      if (indices.length <= 1) continue
      const polySet = new Set(indices.map(i => eps[i].polylineIndex))
      if (polySet.size <= 1) continue

      if (iter === 1) {
        const allFromPass1 = [...polySet].every(pi => pi >= polylines.length)
        if (allFromPass1) {
          if (import.meta.env.DEV) {
            console.log(`[Merge]   Skip junction: all ${polySet.size} polylines [${[...polySet].join(',')}] from Pass 1`)
          }
          continue
        }
      }

      merged.push(...mergeAtJunction(indices, eps, current, used))
    }

    for (let i = 0; i < current.length; i++) {
      if (!used.has(i)) merged.push(current[i])
    }

    const next = merged.filter(p => p.length >= 8)
    if (import.meta.env.DEV) {
      console.log(`[Merge] Pass ${iter} result (${next.length} polylines):`, next.map(p => ({ len: p.length, start: p[0], end: p[p.length - 1] })))
    }
    if (next.length === current.length) {
      if (import.meta.env.DEV && iter > 0) console.log(`[Merge] Converged after ${iter + 1} passes`)
      return next
    }
    current = next
  }

  if (import.meta.env.DEV) {
    console.log('[Merge] ====== Final merged ======', current)
  }
  return current.filter(p => p.length >= 8)
}
