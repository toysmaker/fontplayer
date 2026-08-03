/**
 * 笔画分类算法
 *
 * 将合并后的折线分类到 kai 楷体笔画类型（32种）。
 * 流程：
 * 1. RDP 简化折线为关键转折点
 * 2. 合并方向相近的相邻段
 * 3. 基于关键点数量和方向特征分类
 */

import { simplifyPolyline, segmentAngle, Vec2, polylineLength, distance, pointToChordDist } from '@/utils/polyline'

/** 笔画分类结果 */
export interface StrokeClassification {
  /** 笔画名称，如 '横', '竖', '撇', '横折' 等 */
  name: string
  /** 简化后的关键转折点（合并连续弧线后的结果） */
  cornerPoints: Vec2[]
  /** 置信度 0~1 */
  confidence: number
  /** 方向修正后的折线 */
  correctedPolyline?: Vec2[]
  /** 每段的类型（合并连续弧线后） */
  segmentTypes?: Array<'line' | 'arc'>
  /** 原始角点（合并前，用于贝塞尔拟合等后续步骤） */
  originalCorners?: Vec2[]
  /** 原始段类型（合并前） */
  originalSegmentTypes?: Array<'line' | 'arc'>
  /** 合并角点 → 原始角点索引映射 [startIdx, endIdx] */
  cornerIndexMap?: Array<{ start: number; end: number }>
}

/** 可用的所有笔画名称 */
export const STROKE_NAMES: string[] = [
  '横', '竖', '撇', '捺', '点', '挑',
  '横折', '竖折', '横撇', '竖撇', '横钩', '竖钩',
  '竖弯', '竖挑', '横折2', '横折钩', '横折弯', '横折挑',
  '横弯钩', '横折弯钩', '横折折撇', '横撇弯钩',
  '竖弯钩', '竖折折钩', '二横折', '横折折弯钩',
  '弯钩', '斜钩', '撇挑', '撇点', '挑捺', '平捺',
]

/**
 * 主分类函数
 *
 * @param polyline 合并后的完整笔画折线
 * @returns 分类结果
 */
export function classifyStroke(polyline: Vec2[]): StrokeClassification {
  if (polyline.length < 2) {
    return { name: '未识别', cornerPoints: [], confidence: 0 }
  }

  const totalLen = polylineLength(polyline)

  // 1. RDP 简化：先用较小容差(6px)保留微弧线，再用较大容差(12px)去噪
  let simplified = simplifyPolyline(polyline, 6)
  if (simplified.length === 2 && polyline.length > 10) {
    const [a, b] = simplified
    let maxDist = 0, maxIdx = 0
    for (let i = 1; i < polyline.length - 1; i++) {
      const d = pointToChordDist(polyline[i], a, b)
      if (d > maxDist) { maxDist = d; maxIdx = i }
    }
    if (maxDist > 3) {
      simplified = [a, polyline[maxIdx], b]
    }
  }
  if (import.meta.env.DEV) {
    console.log('[Classify] Polyline len=', polyline.length, 'totalLen=', totalLen.toFixed(0))
    console.log('[Classify] Simplified:', simplified.length, 'points', simplified)
  }
  if (simplified.length < 2) {
    return { name: '未识别', cornerPoints: [], confidence: 0 }
  }

  // 1.5. 方向修正
  const { polyline: correctedPolyline, corners: correctedSimplified } = normalizePolylineByCorners(polyline, simplified)
  if (import.meta.env.DEV) {
    console.log('[Classify] Direction corrected:', correctedPolyline !== polyline ? 'YES (reversed)' : 'no')
  }

  // 2. 先基于修正后的角点做逐段弧线分析（在合并前，保留所有角点）
  const rawSegmentTypes = analyzeSegments(correctedPolyline, correctedSimplified)
  if (import.meta.env.DEV) {
    console.log('[Classify] Raw segment types:', rawSegmentTypes.join(', '), '| corners:', correctedSimplified.length)
  }

  // 2.5. 过滤短弧线段：非单独折线 + 弦长 < 30 + type=arc → 从 corners 和 polyline 中删除
  const MIN_ARC_LEN = 35
  const { polyline: filteredPolyline, corners: filteredCorners } =
    filterShortArcs(correctedPolyline, correctedSimplified, rawSegmentTypes, MIN_ARC_LEN)

  if (import.meta.env.DEV) {
    console.log('[Classify] Filtered polyline:', filteredPolyline.length, 'points')
    console.log('[Classify] Filtered corners:', filteredCorners.length, 'points', filteredCorners)
  }

  // 过滤器可能删除了整条折线
  if (filteredCorners.length < 2) {
    return { name: '未识别', cornerPoints: [], confidence: 0 }
  }

  // 3. 对过滤后的数据重新分析 segment 类型
  const preMergeTypes = analyzeSegments(filteredPolyline, filteredCorners)
  if (import.meta.env.DEV) {
    console.log('[Classify] Pre-merge types:', preMergeTypes.join(', '), '| corners:', filteredCorners.length)
  }

  // 3.5. 合并连续弧线段 + 合并方向接近的直线段
  const mergedData = mergeArcSegments(filteredCorners, preMergeTypes, filteredPolyline)

  if (import.meta.env.DEV) {
    console.log('[Classify] Merged corners:', mergedData.mergedCorners.length, 'points', mergedData.mergedCorners)
    console.log('[Classify] Merged types:', mergedData.mergedSegmentTypes.join(', '))
  }

  const corners = mergedData.mergedCorners
  const segmentTypes = mergedData.mergedSegmentTypes
  const numPoints = corners.length

  // 4. 子笔画分类 + 模式匹配
  const subTypes = classifySubSegments(corners, segmentTypes)
  if (import.meta.env.DEV) {
    console.log('[Classify] Sub-segment types:', subTypes.join(', '))
  }

  const result = matchStrokePattern(corners, subTypes, filteredPolyline)
  result.correctedPolyline = filteredPolyline
  result.segmentTypes = segmentTypes
  result.originalCorners = filteredCorners
  result.originalSegmentTypes = preMergeTypes
  result.cornerIndexMap = mergedData.cornerIndexMap
  return result
}

/**
 * 逐段分析：判断每对相邻角点之间的原始折线段是直线还是弧线
 * @returns 每段的类型数组，长度 = corners.length - 1
 */
function analyzeSegments(polyline: Vec2[], corners: Vec2[]): Array<'line' | 'arc'> {
  const types: Array<'line' | 'arc'> = []

  for (let s = 0; s < corners.length - 1; s++) {
    const a = corners[s]
    const b = corners[s + 1]

    // 在 polyline 中找到 a 到 b 之间的所有点
    let startIdx = -1, endIdx = -1
    for (let i = 0; i < polyline.length; i++) {
      if (startIdx < 0 && distance(polyline[i], a) < 2) startIdx = i
      if (distance(polyline[i], b) < 2) endIdx = i
    }
    if (startIdx < 0 || endIdx < 0 || endIdx - startIdx < 4) {
      types.push('line')
      continue
    }

    // 累积切线方向变化：arc 的切线方向会持续偏转，line 基本不变
    let totalAngleChange = 0
    // 每隔 step 步取一个采样点计算切线，避免相邻点噪声
    const step = Math.max(1, Math.floor((endIdx - startIdx) / 20))
    for (let i = startIdx + step; i < endIdx - step; i += step) {
      const prev = polyline[i - step]
      const next = polyline[i + step]
      const angle = Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI
      // 与弦方向比较
      const chordAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
      let diff = Math.abs(angle - chordAngle)
      if (diff > 180) diff = 360 - diff
      // 只累计 > 3° 的偏差，过滤噪声
      if (diff > 3) totalAngleChange += diff
    }

    // 累积偏转 > 15° 视为弧线
    types.push(totalAngleChange > 15 ? 'arc' : 'line')
  }

  return types
}

/**
 * 合并连续弧线段（如连续的 'arc','arc' 合并为一个 'arc' 段）
 * 同时合并方向接近的直线段
 * 返回合并后的角点、段类型、以及到原始角点的索引映射
 */
function mergeArcSegments(
  corners: Vec2[],
  segmentTypes: Array<'line' | 'arc'>,
  _polyline: Vec2[],
): {
  mergedCorners: Vec2[]
  mergedSegmentTypes: Array<'line' | 'arc'>
  cornerIndexMap: Array<{ start: number; end: number }>
} {
  const n = corners.length
  if (n <= 2) return {
    mergedCorners: corners,
    mergedSegmentTypes: segmentTypes,
    cornerIndexMap: segmentTypes.map((_, i) => ({ start: i, end: i + 1 })),
  }

  // 决定每个中间角点是否保留
  const keepCorner = new Array(n).fill(true)
  for (let i = 1; i < n - 1; i++) {
    const t0 = segmentTypes[i - 1], t1 = segmentTypes[i]
    if (t0 === 'arc' && t1 === 'arc') {
      keepCorner[i] = false // 连续弧线 → 合并
    } else if (t0 === 'line' && t1 === 'line') {
      const a0 = segmentAngle(corners[i - 1], corners[i])
      const a1 = segmentAngle(corners[i], corners[i + 1])
      let diff = Math.abs(a0 - a1)
      if (diff > 180) diff = 360 - diff
      keepCorner[i] = diff > 15 // 方向突变 → 保留
    }
    // arc↔line 混合：保持 true
  }

  // 构建输出
  const mergedCorners: Vec2[] = []
  const mergedTypes: Array<'line' | 'arc'> = []
  const indexMap: Array<{ start: number; end: number }> = []
  let segStart = 0
  for (let i = 0; i < n; i++) {
    if (!keepCorner[i]) continue
    mergedCorners.push(corners[i])
    if (mergedCorners.length >= 2) {
      const isArc = segmentTypes.slice(segStart, i).every(t => t === 'arc')
      mergedTypes.push(isArc ? 'arc' : 'line')
      indexMap.push({ start: segStart, end: i })
      segStart = i
    }
  }
  return { mergedCorners, mergedSegmentTypes: mergedTypes, cornerIndexMap: indexMap }
}

/**
 * 过滤短弧线段：删掉非独立折线中弦长 < minLen 的 arc 段
 * 返回新的 polyline 和 corners（已删除短弧段对应的点和角点）
 */
function filterShortArcs(
  polyline: Vec2[],
  corners: Vec2[],
  segmentTypes: Array<'line' | 'arc'>,
  minLen: number,
): { polyline: Vec2[]; corners: Vec2[] } {
  const removeCorners = new Set<number>()

  // 规则0：全部段都是 arc + 总弦长 < minLen → 整条删除
  const allArc = segmentTypes.every(t => t === 'arc')
  if (allArc) {
    let totalChord = 0
    for (let s = 0; s < segmentTypes.length; s++) {
      totalChord += distance(corners[s], corners[s + 1])
    }
    if (totalChord < minLen) {
      for (let i = 0; i < corners.length; i++) removeCorners.add(i)
      if (import.meta.env.DEV) {
        console.log(`[Classify] Filtered all-arc stroke: totalChord=${totalChord.toFixed(0)} < ${minLen}, remove all`)
      }
      return { polyline: [], corners: [] }
    }
  }

  // 标记要删除的角点索引
  for (let s = 0; s < segmentTypes.length; s++) {
    if (segmentTypes[s] !== 'arc') continue
    const chordLen = distance(corners[s], corners[s + 1])

    // 规则1：独立弧线（仅一段）→ 删除
    if (segmentTypes.length === 1 && chordLen < minLen) {
      removeCorners.add(0)
      removeCorners.add(1)
      if (import.meta.env.DEV) {
        console.log(`[Classify] Filtered isolated arc: chordLen=${chordLen.toFixed(0)}, remove all`)
      }
      continue
    }

    // 规则2：多段弧线 → 检查相邻段是否都是 arc
    if (segmentTypes.length > 1) {
      const prevIsArc = s > 0 && segmentTypes[s - 1] === 'arc'
      const nextIsArc = s < segmentTypes.length - 1 && segmentTypes[s + 1] === 'arc'
      if (prevIsArc && nextIsArc) continue // 前后都是 arc → 保留
      if (chordLen < minLen) {
        // 首段删起点（切除开头的弧线），末段删终点（切除末尾的弧线），中间段删终点
        if (s === 0) {
          removeCorners.add(0) // 首段：删起点，保留后续 stroke
        } else if (s === segmentTypes.length - 1) {
          removeCorners.add(s + 1) // 末段：删终点
        } else {
          removeCorners.add(s + 1) // 中间段：删终点
        }
        if (import.meta.env.DEV) {
          const idx = s === 0 ? 0 : s + 1
          console.log(`[Classify] Filtered arc seg[${s}]: chordLen=${chordLen.toFixed(0)}, remove corner[${idx}]`)
        }
      }
    }
  }

  if (removeCorners.size === 0) return { polyline, corners }

  // 构建新 corners
  const newCorners = corners.filter((_, i) => !removeCorners.has(i))

  // 构建新 polyline：删除被移除角点对应的折线段
  // 找到每个保留角点在 polyline 中的位置，保留相邻保留角点之间的点
  const newPolyline: Vec2[] = []
  for (let c = 0; c < newCorners.length; c++) {
    const corner = newCorners[c]
    // 在 polyline 中找到该角点
    let idx = -1
    for (let i = 0; i < polyline.length; i++) {
      if (distance(polyline[i], corner) < 2) { idx = i; break }
    }
    if (idx < 0) continue

    if (c === 0) {
      // 第一个角点：保留从该点到下一个角点起点之前的所有点
      newPolyline.push(polyline[idx])
    } else {
      // 后续角点：保留从上一个角点之后到该角点的所有点
      const prevCorner = newCorners[c - 1]
      let prevIdx = -1
      for (let i = 0; i < polyline.length; i++) {
        if (distance(polyline[i], prevCorner) < 2) { prevIdx = i; break }
      }
      if (prevIdx >= 0 && prevIdx < idx) {
        for (let i = prevIdx + 1; i <= idx; i++) {
          newPolyline.push(polyline[i])
        }
      }
    }
  }

  if (import.meta.env.DEV) {
    console.log(`[Classify] After filterShortArcs: ${corners.length}→${newCorners.length} corners, ${polyline.length}→${newPolyline.length} polyline pts`)
  }

  return { polyline: newPolyline, corners: newCorners }
}

/**
 * 方向修正：基于 RDP 简化后的角点判断方向，修正原折线
 * 只在 RDP 后仅 2 个角点时生效（直线笔画），避免误判有弧度的撇捺
 */
function normalizePolylineByCorners(original: Vec2[], corners: Vec2[]): { polyline: Vec2[]; corners: Vec2[] } {
  if (corners.length !== 2) return { polyline: original, corners }
  const [a, b] = corners
  const dx = b.x - a.x
  const dy = b.y - a.y

  let needReverse = false
  if (Math.abs(dy) < 20 && dx < 0) needReverse = true       // a. 水平：从左到右
  else if (Math.abs(dx) < 20 && dy < 0) needReverse = true   // b. 竖直：从上到下
  else if (dx < 0 && dy < 0 && a.x > b.x && a.y > b.y) needReverse = true  // c. 右下→左上

  if (needReverse) {
    return {
      polyline: [...original].reverse(),
      corners: [...corners].reverse(),
    }
  }
  return { polyline: original, corners }
}

// ============================================================
// 子笔画分类 + 笔画模式匹配
// ============================================================

/** 子笔画类型 */
type SubType = '横' | '竖' | '直' | '弧' | '钩'

/** 计算两点连线的角度：0=右, 正=顺时针(下), 范围[-180,180] */
function segAngle(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
}

/** 将角度归一化到 [-180, 180] */
function normAngle(a: number): number {
  let r = ((a % 360) + 360) % 360
  if (r > 180) r -= 360
  return r
}

/** 判断点 P 在连线 AB 的左侧(cross>0)还是右侧(cross<0) */
function crossSign(a: Vec2, b: Vec2, p: Vec2): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
}

/** 在 polyline 中找到离弦 AB 最远的点 */
function findFarthestPoint(polyline: Vec2[], a: Vec2, b: Vec2): Vec2 | null {
  let maxD = 0, best: Vec2 | null = null
  for (const p of polyline) {
    const d = pointToChordDist(p, a, b)
    if (d > maxD) { maxD = d; best = p }
  }
  return best
}

/**
 * 子笔画分类器：每两个角点之间分类为 横/竖/直/弧/钩
 */
function classifySubSegments(
  corners: Vec2[],
  segmentTypes: Array<'line' | 'arc'>,
): SubType[] {
  const n = corners.length
  const result: SubType[] = []

  for (let i = 0; i < n - 1; i++) {
    const a = corners[i], b = corners[i + 1]
    const angle = segAngle(a, b)
    const len = distance(a, b)
    const type = segmentTypes[i]
    const isLast = i === n - 2
    const isOnly = n === 2

    // 钩：最后一个段 + 非唯一段 + 长度 < 100
    if (isLast && !isOnly && len < 100) {
      result.push('钩')
      continue
    }

    if (type === 'line') {
      if (angle >= -30 && angle <= 30) result.push('横')
      else if (angle >= 60 && angle <= 120) result.push('竖')
      else result.push('直')
    } else {
      // type === 'arc'
      result.push('弧')
    }
  }
  return result
}

/**
 * 笔画模式匹配
 */
function matchStrokePattern(
  corners: Vec2[],
  subTypes: SubType[],
  polyline: Vec2[],
): StrokeClassification {
  const n = corners.length
  const sig = subTypes.join(',')
  const conf = (c: number) => ({ name: '', cornerPoints: corners, confidence: c } as StrokeClassification)

  if (n === 2) {
    return classify2Point(corners, subTypes, polyline)
  }
  if (n === 3) {
    return classify3Point(corners, subTypes, polyline)
  }
  if (n === 4) {
    return classify4Point(corners, subTypes, polyline)
  }
  if (n === 5) {
    return classify5Point(corners, subTypes, polyline)
  }
  if (n === 6) {
    return classify6Point(corners, subTypes, polyline)
  }
  return { name: '未识别', cornerPoints: corners, confidence: 0.3 }
}

// ============ 2点 ============
function classify2Point(corners: Vec2[], st: SubType[], polyline: Vec2[]): StrokeClassification {
  const cn = corners
  if (st[0] === '横') return { name: '横', cornerPoints: cn, confidence: 0.95 }
  if (st[0] === '竖') return { name: '竖', cornerPoints: cn, confidence: 0.95 }
  if (st[0] === '弧') {
    const angle = segAngle(cn[0], cn[1])
    // 撇：弧在 90~180 或 -180~-90（向左）
    if (angle >= 90 || angle <= -90) return { name: '撇', cornerPoints: cn, confidence: 0.85 }
    // 捺/点/挑：弧在 -90~0 或 0~90
    const fp = findFarthestPoint(polyline, cn[0], cn[1])
    if (fp) {
      const cs = crossSign(cn[0], cn[1], fp)
      // 捺：凸点在连线左下方（cross > 0，即左侧）
      if (cs > 0) return { name: '捺', cornerPoints: cn, confidence: 0.85 }
      // 点：凸点在连线右上方（cross < 0，即右侧）
      if (cs < 0) return { name: '点', cornerPoints: cn, confidence: 0.85 }
    }
    return { name: '捺', cornerPoints: cn, confidence: 0.6 }
  }
  // 直/钩 = 挑（角度 -30~-90）
  const angle = segAngle(cn[0], cn[1])
  if (angle >= -90 && angle <= -30) return { name: '挑', cornerPoints: cn, confidence: 0.7 }
  return { name: '直', cornerPoints: cn, confidence: 0.4 }
}

// ============ 3点 ============
function classify3Point(corners: Vec2[], st: SubType[], _poly: Vec2[]): StrokeClassification {
  const cn = corners
  const [t0, t1] = st
  const sig = `${t0}+${t1}`

  // 横折：横+竖
  if (sig === '横+竖') return { name: '横折', cornerPoints: cn, confidence: 0.9 }
  // 竖折：竖+横
  if (sig === '竖+横') return { name: '竖折', cornerPoints: cn, confidence: 0.9 }
  // 横撇：横+弧
  if (sig === '横+弧') return { name: '横撇', cornerPoints: cn, confidence: 0.85 }
  // 横钩：横+钩
  if (sig === '横+钩') return { name: '横钩', cornerPoints: cn, confidence: 0.85 }

  if (t1 === '钩') {
    // 竖钩/竖挑：竖+钩
    if (t0 === '竖') {
      const hookEnd = cn[2], hookStart = cn[1]
      if (hookEnd.x > hookStart.x) return { name: '竖挑', cornerPoints: cn, confidence: 0.85 }
      return { name: '竖钩', cornerPoints: cn, confidence: 0.85 }
    }
    // 弯钩/斜钩：弧+钩
    if (t0 === '弧') {
      const cs = crossSign(cn[1], cn[2], cn[0])
      if (cs > 0) return { name: '弯钩', cornerPoints: cn, confidence: 0.8 }
      return { name: '斜钩', cornerPoints: cn, confidence: 0.8 }
    }
  }

  // 撇点/撇挑：两段夹角判断
  const a0 = segAngle(cn[0], cn[1])
  const a1 = segAngle(cn[1], cn[2])
  let diff = Math.abs(a0 - a1)
  if (diff > 180) diff = 360 - diff
  if (diff > 90) return { name: '撇点', cornerPoints: cn, confidence: 0.7 }
  if (diff < 90) return { name: '撇挑', cornerPoints: cn, confidence: 0.7 }

  return { name: '未识别', cornerPoints: cn, confidence: 0.3 }
}

// ============ 4点 ============
function classify4Point(corners: Vec2[], st: SubType[], _poly: Vec2[]): StrokeClassification {
  const cn = corners
  const sig = st.join('+')

  // 横折挑：横+竖+钩，钩方向 -90~90
  if (sig === '横+竖+钩') {
    const hookAngle = segAngle(cn[2], cn[3])
    if (hookAngle >= -90 && hookAngle <= 90) return { name: '横折挑', cornerPoints: cn, confidence: 0.85 }
    return { name: '横折钩', cornerPoints: cn, confidence: 0.85 }
  }
  // 横弯钩：横+弧+钩
  if (sig === '横+弧+钩') return { name: '横弯钩', cornerPoints: cn, confidence: 0.85 }
  // 横撇弯钩：横+直+弧 或 横+弧+弧
  if (st[0] === '横' && st[2] === '弧' && (st[1] === '直' || st[1] === '弧')) {
    return { name: '横撇弯钩', cornerPoints: cn, confidence: 0.8 }
  }

  return { name: '未识别', cornerPoints: cn, confidence: 0.3 }
}

// ============ 5点 ============
function classify5Point(corners: Vec2[], st: SubType[], _poly: Vec2[]): StrokeClassification {
  const cn = corners
  const sig = st.join('+')

  // 横折折撇：横+直或弧+横或直+弧
  if (st[0] === '横' && st[3] === '弧') return { name: '横折折撇', cornerPoints: cn, confidence: 0.8 }
  // 竖折折钩：竖+横+竖或直+钩
  if (st[0] === '竖' && st[1] === '横' && st[3] === '钩') return { name: '竖折折钩', cornerPoints: cn, confidence: 0.8 }
  // 二横折：横+竖或直+横+竖或直
  if (st[0] === '横' && st[2] === '横') return { name: '二横折', cornerPoints: cn, confidence: 0.8 }

  return { name: '未识别', cornerPoints: cn, confidence: 0.3 }
}

// ============ 6点 ============
function classify6Point(corners: Vec2[], st: SubType[], _poly: Vec2[]): StrokeClassification {
  const cn = corners
  // 横折折弯钩：横+竖或直+横+竖或直+钩
  if (st[0] === '横' && st[4] === '钩') return { name: '横折折弯钩', cornerPoints: cn, confidence: 0.8 }
  return { name: '未识别', cornerPoints: cn, confidence: 0.3 }
}
