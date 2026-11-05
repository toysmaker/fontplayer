/**
 * 骨架拟合模块
 * 将变换后的密集采样点拟合回贝塞尔曲线控制点，
 * 并写回钢笔组件。
 */

import { fitCurve } from '@/core/utils/fitCurve'
import type { IPoint as FitIPoint } from '@/core/utils/fitCurve'
import type { IGlyphComponent, IPenComponent } from '@/core/types'
import type {
  SampledSkeletonBindData,
  SampledPointBinding,
  Bone,
  ComponentSegmentMeta,
} from './skeletonSampling'
import { getSamplePoint, SAMPLE_TOTAL } from './skeletonSampling'

// ==================== 常量 ====================

/** 拟合误差阈值（UPM 单位） */
const FIT_MAX_ERROR = 2

const LOG = '[SampledBind]'

/** 与 em 坐标量级匹配；避免浮点误差触发重复渲染 */
const SKELETON_TRANSFORM_EPS = 1e-4

// ==================== 单段拟合 ====================

/**
 * 拟合一组采样点为贝塞尔曲线数组
 * 使用 fitCurve（自适应分割 + 重参数化优化）
 * @returns 贝塞尔曲线数组，每条曲线为 [P0,P1,P2,P3]
 */
export function fitSamplesToBeziers(
  samples: Array<{ x: number; y: number }>,
  maxError: number = FIT_MAX_ERROR,
): Array<[{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }]> {
  if (samples.length < 2) {
    const p = samples[0] || { x: 0, y: 0 }
    return [[p, p, p, p]]
  }

  // 塌缩段会产生近乎重合的相邻采样点, fitCurve 在退化段上会拟合出尖锐毛刺;
  // 先合并距离过近的相邻点 (与 FIT_MAX_ERROR 同量级的阈值)
  const deduped: typeof samples = []
  const DEDUP_EPS = 0.5
  for (const p of samples) {
    const last = deduped[deduped.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < DEDUP_EPS) continue
    deduped.push(p)
  }
  if (deduped.length >= 2) {
    // 闭合环: 首尾点也应保持接近 (去重后末点可能与首点重合)
    const firstD = deduped[0]
    const lastD = deduped[deduped.length - 1]
    if (Math.hypot(lastD.x - firstD.x, lastD.y - firstD.y) < DEDUP_EPS) {
      deduped[deduped.length - 1] = { x: firstD.x, y: firstD.y }
    }
  }
  samples = deduped

  // 检测退化
  const first = samples[0]
  let allSame = true
  for (let i = 1; i < samples.length; i++) {
    if (Math.abs(samples[i].x - first.x) > 1e-4 || Math.abs(samples[i].y - first.y) > 1e-4) {
      allSame = false
      break
    }
  }
  if (allSame) {
    return [[first, first, first, first]]
  }

  // 结构类型与 FitIPoint 完全一致，直接传入避免每帧冗余拷贝
  const input: FitIPoint[] = samples as FitIPoint[]

  if (import.meta.env.DEV) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of input) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y
    }
    console.log(LOG, 'fitSamples samples=' + samples.length +
      ' range=[' + minX.toFixed(1) + ',' + minY.toFixed(1) + ']-[' + maxX.toFixed(1) + ',' + maxY.toFixed(1) + ']' +
      ' maxError=' + maxError)
  }

  try {
    // 使用 fitCurve：自适应分割 + 重参数化优化（最多20次迭代）
    const result = fitCurve(input, maxError)
    if (result && result.length > 0) {
      const beziers: Array<[{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }]> = []
      for (const bez of result) {
        if (bez && bez.length === 4) {
          beziers.push([bez[0], bez[1], bez[2], bez[3]])
        }
      }
      if (beziers.length > 0) {
        if (import.meta.env.DEV) {
          console.log(LOG, 'fitSamples OK curves=' + beziers.length +
            (beziers.length > 1 ? ' (SPLIT)' : '') +
            ' P0=(' + beziers[0][0].x.toFixed(1) + ',' + beziers[0][0].y.toFixed(1) + ')' +
            ' P3=(' + beziers[beziers.length - 1][3].x.toFixed(1) + ',' + beziers[beziers.length - 1][3].y.toFixed(1) + ')')
        }
        return beziers
      }
    }
    if (import.meta.env.DEV) {
      console.warn(LOG, 'fitCurve unexpected result:', result)
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(LOG, 'fitCurve threw:', e)
    }
  }

  // 退化回退
  if (import.meta.env.DEV) {
    console.warn(LOG, 'FALLBACK linear!')
  }
  const p0 = samples[0]
  const p3 = samples[samples.length - 1]
  const dx = (p3.x - p0.x) / 3
  const dy = (p3.y - p0.y) / 3
  return [[
    { x: p0.x, y: p0.y },
    { x: p0.x + dx, y: p0.y + dy },
    { x: p3.x - dx, y: p3.y - dy },
    { x: p3.x, y: p3.y },
  ]]
}

// ==================== 组件拟合 ====================

export function fitComponentFromSamples(
  outBuffer: Float64Array,
  rangeStart: number,
  rangeEnd: number,
  meta: ComponentSegmentMeta | undefined,
): Array<{ x: number; y: number }> {
  if (!meta || !Array.isArray(meta.samplesPerSegment) || meta.samplesPerSegment.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(LOG, 'fitComponent: meta missing or empty, skipping (rangeStart=' + rangeStart + ')')
    }
    return []
  }
  const { samplesPerSegment, closePath } = meta

  const points: Array<{ x: number; y: number }> = []
  let sampleOffset = 0
  let isFirstCurve = true
  const totalCount = rangeEnd - rangeStart

  if (import.meta.env.DEV) {
    console.log(LOG, 'fitComponent segs=' + samplesPerSegment.length +
      ' totalSamples=' + totalCount +
      ' perSeg=[' + samplesPerSegment.join(',') + ']' +
      ' closePath=' + closePath)
  }

  for (let seg = 0; seg < samplesPerSegment.length; seg++) {
    const count = samplesPerSegment[seg]
    // 直接从 Float64Array 构造段内采样点（无中间大数组拷贝）
    const segSamples: Array<{ x: number; y: number }> = new Array(count)
    for (let s = 0; s < count; s++) {
      const bi = (rangeStart + sampleOffset + s) * 2
      segSamples[s] = { x: outBuffer[bi], y: outBuffer[bi + 1] }
    }
    sampleOffset += count

    // fitCurve 自适应分割：一个原始段可能被拟合成多条贝塞尔曲线
    const beziers = fitSamplesToBeziers(segSamples)

    for (let b = 0; b < beziers.length; b++) {
      const bez = beziers[b]
      if (isFirstCurve) {
        points.push(
          { x: bez[0].x, y: bez[0].y },
          { x: bez[1].x, y: bez[1].y },
          { x: bez[2].x, y: bez[2].y },
          { x: bez[3].x, y: bez[3].y },
        )
        isFirstCurve = false
      } else {
        points.push(
          { x: bez[1].x, y: bez[1].y },
          { x: bez[2].x, y: bez[2].y },
          { x: bez[3].x, y: bez[3].y },
        )
      }
    }
  }

  if (closePath && points.length >= 4) {
    const firstP0 = points[0]
    const lastP3 = points[points.length - 1]
    if (
      Math.abs(lastP3.x - firstP0.x) > FIT_MAX_ERROR ||
      Math.abs(lastP3.y - firstP0.y) > FIT_MAX_ERROR
    ) {
      lastP3.x = firstP0.x
      lastP3.y = firstP0.y
    }
  }

  if (import.meta.env.DEV) {
    console.log(LOG, 'fitComponent result points=' + points.length)
  }

  return points
}

// ==================== 获取包围盒 ====================

function getBound(pts: Array<{ x: number; y: number }>): {
  x: number; y: number; w: number; h: number
} {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity
  for (const p of pts) {
    if (p.x < xMin) xMin = p.x; if (p.y < yMin) yMin = p.y
    if (p.x > xMax) xMax = p.x; if (p.y > yMax) yMax = p.y
  }
  return { x: xMin, y: yMin, w: xMax - xMin || 0, h: yMax - yMin || 0 }
}

function skeletonCoordChanged(a: number, b: number): boolean {
  return Math.abs(a - b) > SKELETON_TRANSFORM_EPS
}

// ==================== 变换采样点 ====================

export function transformSamplesWithBones(
  bindData: SampledSkeletonBindData,
  outBuffer: Float64Array,
  ensurePointsBonesMap: (bd: SampledSkeletonBindData) => SampledPointBinding[],
): void {
  const pointsBonesMap = ensurePointsBonesMap(bindData)
  const { samplePoints, bones } = bindData
  const count = Math.min(samplePoints.length / 2, outBuffer.length / 2)

  for (let i = 0; i < count; i++) {
    const binding = pointsBonesMap[i]
    if (!binding?.bones?.length) {
      outBuffer[i * 2] = samplePoints[i * 2]
      outBuffer[i * 2 + 1] = samplePoints[i * 2 + 1]
      continue
    }

    // 内联矩阵变换，避免每帧分配 1000 个 {x,y} 临时对象
    const ox = samplePoints[i * 2]
    const oy = samplePoints[i * 2 + 1]
    let newX = 0, newY = 0

    const boneList = binding.bones
    for (let b = 0; b < boneList.length; b++) {
      const { boneIndex, weight } = boneList[b]
      const bone = bones[boneIndex]
      if (!bone?.currentMatrix) continue
      const m = bone.currentMatrix
      // currentMatrix 格式 [a, b, c, d, tx, ty]
      const tx = m[0] * ox + m[1] * oy + m[4]
      const ty = m[2] * ox + m[3] * oy + m[5]
      newX += weight * tx
      newY += weight * ty
    }

    outBuffer[i * 2] = newX
    outBuffer[i * 2 + 1] = newY
  }
}

// ==================== 参数化轮廓细节迁移绑定 ====================

/**
 * 替代 LBS 的绑定方式 (针对"手绘轮廓 + 参数化骨架"的笔画):
 *
 * LBS 在段长压缩时角部采样点会折叠交叉 (candy-wrapper), 这是线性混合的固有缺陷。
 * 本方案利用笔画自身携带参数化模板 (getComponentsBySkeleton) — 模板在任何参数下
 * 生成的轮廓都是合法的, 不会自交:
 *
 *   绑定时: 每个手绘采样点 → 在参数化轮廓上找最近点 → 存 (段, s, 切向/法向位移)
 *   变形时: 用新参数重新生成参数化轮廓 → 采样点 = 新轮廓(s) + 切向位移×缩放比 + 法向位移
 *
 * 手绘的"纹理"(粗细变化/毛刺/风格)以偏移场形式保留; 切向位移随段长比例缩放
 * (纹理随笔画压缩/拉伸), 法向不缩放 (笔画宽度不变)。恒等姿态精确还原。
 */

export interface OutlineOffsetEntry {
  compIdx: number
  bezierIdx: number
  /** 带子采样点下标 (0..OUTLINE_SUBDIV) */
  s: number
  /** 采样点相对带子最近点的位移 — 绑定时刻段局部坐标: u=切向, v=法向 */
  u: number
  v: number
  /** 绑定时刻所在段的长度 (拖拽时切向位移按 拖拽段长/绑定段长 缩放) */
  bindSegLen: number
}

export interface OutlineOffsetBindData {
  entries: OutlineOffsetEntry[]
  /** 每个角部/端点弧线的绑定时刻方向符号 (+1 短弧逆时针 / -1 反射弧): 拖拽时沿用, 防止角凸凹翻转时弧线翻面 */
  arcSigns: number[]
}

/**
 * 迁移旧格式的细节迁移条目 (dx/dy/bindNormalAngle → u/v/bindSegLen)。
 * 旧格式缺少 bindSegLen, 迁移后切向缩放比固定为 1 (新生成笔画不受影响)。
 */
export function migrateOutlineOffsetBindData(data: any): void {
  if (!data || !Array.isArray(data.entries)) return
  let migrated = false
  for (const e of data.entries) {
    if (e && e.u === undefined && typeof e.dx === 'number') {
      const theta = typeof e.bindNormalAngle === 'number' ? e.bindNormalAngle : 0
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      e.u = -e.dx * sinT + e.dy * cosT
      e.v = e.dx * cosT + e.dy * sinT
      e.bindSegLen = -1
      migrated = true
    }
  }
  if (migrated && !Array.isArray(data.arcSigns)) {
    data.arcSigns = []
  }
}

const OUTLINE_SUBDIV = 6
/** 圆帽端点的细分段数 */
const CAP_SEGMENTS = 6

interface FlatSegment {
  compIdx: number
  segIdx: number
  /** 'side' 直线边 / 'arc' 角部与端点弧 */
  kind: 'side' | 'arc'
  /** 等分采样点 (subdiv+1 个) */
  pts: Array<{ x: number; y: number }>
  /** 每点法向 (平均相邻段方向) */
  normals: Array<{ x: number; y: number }>
}

export interface RibbonOutline {
  segments: FlatSegment[]
  /** 弧线方向符号列表 (与构建顺序一致) */
  arcSigns: number[]
}

/**
 * 构建参数化带子轮廓。
 * @param arcSigns 绑定时刻的弧线方向 (拖拽时沿用, 保证角部凸凹翻转时边界不翻面);
 *                 缺省时按短弧构建并返回实际使用的符号。
 */
export function buildRibbonOutline(
  reflines: Array<{ start: string; end: string; type?: string }>,
  joints: Array<{ name: string; x: number; y: number }>,
  weight: number,
  arcSigns?: number[],
): RibbonOutline {
  const jointMap = new Map<string, { x: number; y: number }>()
  for (const j of joints) {
    jointMap.set(j.name, { x: typeof j.x === 'function' ? (j.x as any)() : j.x, y: typeof j.y === 'function' ? (j.y as any)() : j.y })
  }
  const main = reflines.filter((r) => r.type !== 'ref')
  if (main.length === 0) return { segments: [], arcSigns: [] }

  // 中心线点链
  const chain: Array<{ x: number; y: number }> = []
  for (let i = 0; i < main.length; i++) {
    const s = jointMap.get(main[i].start)
    if (!s) continue
    if (i === 0) chain.push(s)
    const e = jointMap.get(main[i].end)
    if (e) chain.push(e)
  }
  if (chain.length < 2) return { segments: [], arcSigns: [] }
  // 去重连续重复点
  const deduped = [chain[0]]
  for (let i = 1; i < chain.length; i++) {
    const p = chain[i]
    const last = deduped[deduped.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) > 0.01) deduped.push(p)
  }
  if (deduped.length < 2) return { segments: [], arcSigns: [] }

  const half = Math.max(weight / 2, 1)

  // 每边法向
  const edgeNormals: Array<{ x: number; y: number }> = []
  for (let i = 0; i < deduped.length - 1; i++) {
    let dx = deduped[i + 1].x - deduped[i].x
    let dy = deduped[i + 1].y - deduped[i].y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    edgeNormals.push({ x: -dy, y: dx })
  }

  // 轮廓点序: A 侧 (每边线 + 顶点圆角弧) → 末端圆帽 → B 侧 (倒走) → 起始圆帽
  const outline: Array<{ x: number; y: number }> = []
  const pushLine = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (outline.length === 0 || Math.hypot(a.x - outline[outline.length - 1].x, a.y - outline[outline.length - 1].y) > 0.01) {
      outline.push(a)
    }
    outline.push(b)
  }
  const usedSigns: number[] = []
  let arcIdx = 0
  const arcPointSet = new Set<number>()
  const pushJoinArc = (center: { x: number; y: number }, fromAngle: number, toAngle: number) => {
    let sweep = ((toAngle - fromAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    const override = arcSigns?.[arcIdx]
    if (override !== undefined && sweep !== 0) {
      if (override > 0 && sweep < 0) sweep += Math.PI * 2
      else if (override < 0 && sweep > 0) sweep -= Math.PI * 2
    }
    usedSigns.push(sweep >= 0 ? 1 : -1)
    arcIdx++
    for (let s = 1; s <= CAP_SEGMENTS; s++) {
      const a = fromAngle + (sweep * s) / CAP_SEGMENTS
      arcPointSet.add(outline.length)
      outline.push({ x: center.x + Math.cos(a) * half, y: center.y + Math.sin(a) * half })
    }
  }

  // A 侧
  for (let i = 0; i < deduped.length - 1; i++) {
    const n = edgeNormals[i]
    pushLine(
      { x: deduped[i].x + n.x * half, y: deduped[i].y + n.y * half },
      { x: deduped[i + 1].x + n.x * half, y: deduped[i + 1].y + n.y * half },
    )
    if (i < deduped.length - 2) {
      pushJoinArc(deduped[i + 1], Math.atan2(n.y, n.x), Math.atan2(edgeNormals[i + 1].y, edgeNormals[i + 1].x))
    }
  }
  // 末端圆帽
  {
    const last = deduped[deduped.length - 1]
    const n = edgeNormals[edgeNormals.length - 1]
    pushJoinArc(last, Math.atan2(n.y, n.x), Math.atan2(-n.y, -n.x))
  }
  // B 侧 (倒走)
  for (let i = deduped.length - 2; i >= 0; i--) {
    const n = edgeNormals[i]
    pushLine(
      { x: deduped[i + 1].x - n.x * half, y: deduped[i + 1].y - n.y * half },
      { x: deduped[i].x - n.x * half, y: deduped[i].y - n.y * half },
    )
    if (i > 0) {
      pushJoinArc(deduped[i], Math.atan2(-edgeNormals[i].y, -edgeNormals[i].x), Math.atan2(-edgeNormals[i - 1].y, -edgeNormals[i - 1].x))
    }
  }
  // 起始圆帽
  {
    const first = deduped[0]
    const n = edgeNormals[0]
    pushJoinArc(first, Math.atan2(-n.y, -n.x), Math.atan2(n.y, n.x))
  }

  // 组成 line 段列表
  const segments: FlatSegment[] = []
  const n = outline.length
  for (let i = 0; i < n; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % n]
    const sampled: Array<{ x: number; y: number }> = new Array(OUTLINE_SUBDIV + 1)
    for (let s = 0; s <= OUTLINE_SUBDIV; s++) {
      const t = s / OUTLINE_SUBDIV
      sampled[s] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    const normalsSeg: Array<{ x: number; y: number }> = new Array(OUTLINE_SUBDIV + 1)
    for (let s = 0; s <= OUTLINE_SUBDIV; s++) {
      const prev = sampled[Math.max(0, s - 1)]
      const next = sampled[Math.min(OUTLINE_SUBDIV, s + 1)]
      let dx = next.x - prev.x
      let dy = next.y - prev.y
      const len = Math.hypot(dx, dy) || 1
      dx /= len
      dy /= len
      normalsSeg[s] = { x: -dy, y: dx }
    }
    segments.push({
      compIdx: 0,
      segIdx: i,
      kind: arcPointSet.has(i) ? 'arc' : 'side',
      pts: sampled,
      normals: normalsSeg,
    })
  }
  return { segments, arcSigns: usedSigns }
}

/**
 * 构建细节迁移绑定: 每个采样点 → 参数化带子最近点 (段, s, 切向/法向位移)
 */
export function buildOutlineOffsetBindData(
  samplePoints: number[],
  ribbon: RibbonOutline,
): OutlineOffsetBindData {
  const count = samplePoints.length / 2
  const entries: OutlineOffsetEntry[] = new Array(count)
  for (let i = 0; i < count; i++) {
    const px = samplePoints[i * 2]
    const py = samplePoints[i * 2 + 1]
    let best: OutlineOffsetEntry | null = null
    let bestDist = Infinity
    for (const sgm of ribbon.segments) {
      for (let s = 0; s < sgm.pts.length; s++) {
        const q = sgm.pts[s]
        const d = Math.hypot(px - q.x, py - q.y)
        if (d < bestDist) {
          bestDist = d
          // 段切向 (相邻采样点方向, 端点处取段端方向)
          const prev = sgm.pts[Math.max(0, s - 1)]
          const next = sgm.pts[Math.min(sgm.pts.length - 1, s + 1)]
          let tx = next.x - prev.x
          let ty = next.y - prev.y
          const tl = Math.hypot(tx, ty) || 1
          tx /= tl
          ty /= tl
          const nx = -ty
          const ny = tx
          const ddx = px - q.x
          const ddy = py - q.y
          const segLen = Math.hypot(
            sgm.pts[sgm.pts.length - 1].x - sgm.pts[0].x,
            sgm.pts[sgm.pts.length - 1].y - sgm.pts[0].y,
          )
          best = {
            compIdx: sgm.compIdx,
            bezierIdx: sgm.segIdx,
            s,
            u: ddx * tx + ddy * ty,
            v: ddx * nx + ddy * ny,
            bindSegLen: Math.max(segLen, 0.5),
          }
        }
      }
    }
    entries[i] = best ?? { compIdx: -1, bezierIdx: -1, s: 0, u: 0, v: 0, bindSegLen: 1 }
  }
  return { entries, arcSigns: ribbon.arcSigns }
}

/**
 * 应用细节迁移变形: 新参数化带子 + 存下的 (s, 切向/法向位移) → 采样点位置。
 * 切向位移随段长比例缩放 (纹理随笔画压缩/拉伸), 法向不缩放 (笔画宽度不变)。
 */
export function applyOutlineOffsetDeformation(
  bindData: OutlineOffsetBindData,
  ribbon: FlatSegment[],
  outBuffer: Float64Array,
): boolean {
  if (ribbon.length === 0) return false
  const count = bindData.entries.length

  // 段级缩放比: 拖拽段长/绑定段长
  const segBindLen = new Float64Array(ribbon.length)
  for (const e of bindData.entries) {
    if (e.compIdx < 0) continue
    if (!segBindLen[e.bezierIdx] && e.bindSegLen > 0) segBindLen[e.bezierIdx] = e.bindSegLen
  }
  const segRatios = ribbon.map((sgm, si) => {
    const dragSegLen = Math.max(
      Math.hypot(
        sgm.pts[sgm.pts.length - 1].x - sgm.pts[0].x,
        sgm.pts[sgm.pts.length - 1].y - sgm.pts[0].y,
      ),
      0.5,
    )
    const bindLen = segBindLen[si] || dragSegLen
    return Math.min(Math.max(dragSegLen / Math.max(bindLen, 0.5), 0.05), 20)
  })

  // 逐采样点取所在段的缩放比, 沿轮廓平滑 (2 次)
  const ratios = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const e = bindData.entries[i]
    ratios[i] = e.compIdx < 0 ? 1 : (segRatios[e.bezierIdx] ?? 1)
  }
  for (let pass = 0; pass < 2; pass++) {
    const src = Float64Array.from(ratios)
    for (let i = 0; i < count; i++) {
      const prev = i > 0 ? i - 1 : count - 1
      const next = i < count - 1 ? i + 1 : 0
      ratios[i] = 0.5 * src[i] + 0.25 * src[prev] + 0.25 * src[next]
    }
  }

  let anyChanged = false
  for (let i = 0; i < count; i++) {
    const e = bindData.entries[i]
    if (e.compIdx < 0) {
      outBuffer[i * 2] = 0
      outBuffer[i * 2 + 1] = 0
      continue
    }
    const sgm = ribbon.find((x) => x.compIdx === e.compIdx && x.segIdx === e.bezierIdx)
    if (!sgm) continue
    const s = Math.min(e.s, OUTLINE_SUBDIV)
    const q = sgm.pts[s]
    // 段切向 (相邻采样点方向)
    const prev = sgm.pts[Math.max(0, s - 1)]
    const next = sgm.pts[Math.min(sgm.pts.length - 1, s + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const nx = -ty
    const ny = tx
    // 切向位移随缩放比缩放 (纹理随笔画压缩/拉伸), 法向不缩放 (笔画宽度不变);
    // 旧格式迁移条目无 bindSegLen (-1) → 不缩放切向
    const ut = e.u * (e.bindSegLen && e.bindSegLen > 0 ? ratios[i] : 1)
    outBuffer[i * 2] = q.x + tx * ut + nx * e.v
    outBuffer[i * 2 + 1] = q.y + ty * ut + ny * e.v
    anyChanged = true
  }
  return anyChanged
}

/**
 * 对变换后的采样点做 1 次沿轮廓的邻域平滑 (0.5 自身 + 0.25 左右邻居):
 * 消除压缩段角部采样点折叠产生的尖锐折返 (拖拽预览与最终拟合共用同一结果,
 * 松手瞬间无跳变)。闭合轮廓首尾相连。
 */
export function smoothSamplePositions(
  bindData: SampledSkeletonBindData,
  outBuffer: Float64Array,
): void {
  const { samplePoints, componentSampleRanges, componentSegmentMeta } = bindData
  const count = Math.min(samplePoints.length / 2, outBuffer.length / 2)

  // 2 次平滑: 1 次消除相邻点突变, 第 2 次抚平压缩段端点(笔帽)附近的过渡扭结
  let src = new Float64Array(outBuffer.subarray(0, count * 2))
  for (let pass = 0; pass < 2; pass++) {
    const dst = pass === 0 ? outBuffer : new Float64Array(count * 2)
    for (let ri = 0; ri < componentSampleRanges.length; ri++) {
      const range = componentSampleRanges[ri]
      const lo = range.start
      const hi = range.end
      if (hi - lo < 2) continue
      const closed = !!componentSegmentMeta[ri]?.closePath
      for (let i = lo; i < hi; i++) {
        const prev = i > lo ? i - 1 : closed ? hi - 1 : i
        const next = i < hi - 1 ? i + 1 : closed ? lo : i
        dst[i * 2] = 0.5 * src[i * 2] + 0.25 * src[prev * 2] + 0.25 * src[next * 2]
        dst[i * 2 + 1] = 0.5 * src[i * 2 + 1] + 0.25 * src[prev * 2 + 1] + 0.25 * src[next * 2 + 1]
      }
    }
    src = dst
  }
  if (src !== outBuffer) {
    outBuffer.set(src.subarray(0, count * 2))
  }
}

// ==================== 拟合写回 ====================

/**
 * 组件/元数据解析器 (拟合与折线预览共用):
 * 按 range.componentUUID 匹配组件, UUID 失效时按索引回退 (组件被重新生成后 UUID 会变)
 */
function createComponentResolver(
  penComponents: IGlyphComponent[],
  bindData: SampledSkeletonBindData,
): (rangeIdx: number) => { comp: IGlyphComponent | undefined; meta: ComponentSegmentMeta | undefined } {
  const { componentSampleRanges, componentSegmentMeta } = bindData

  const componentMap = new Map<string, IGlyphComponent>()
  for (const comp of penComponents) {
    componentMap.set(comp.uuid, comp)
  }

  const metaMap = new Map<string, ComponentSegmentMeta>()
  for (const meta of componentSegmentMeta) {
    metaMap.set(meta.componentUUID, meta)
  }

  return (rangeIdx: number) => {
    const range = componentSampleRanges[rangeIdx]
    let comp = componentMap.get(range.componentUUID)
    let meta = metaMap.get(range.componentUUID)

    // UUID 查找失败 → 按索引回退（组件被重新生成后 UUID 会变）
    if (!comp && rangeIdx < penComponents.length) {
      comp = penComponents[rangeIdx]
      if (comp) {
        const oldUUID = range.componentUUID
        range.componentUUID = comp.uuid
        if (metaMap.has(oldUUID)) {
          const m = metaMap.get(oldUUID)!
          metaMap.delete(oldUUID)
          m.componentUUID = comp.uuid
          metaMap.set(comp.uuid, m)
        }
        meta = metaMap.get(comp.uuid)
      }
    }

    if (comp && !meta && rangeIdx < componentSegmentMeta.length) {
      meta = componentSegmentMeta[rangeIdx]
    }
    return { comp, meta }
  }
}

/** 新点写回组件: 长度一致原地覆写, 否则整体替换; 同步更新组件包围盒 */
function updateComponentPoints(comp: IGlyphComponent, newPoints: Array<{ x: number; y: number }>): boolean {
  const pts = (comp.value as unknown as IPenComponent).points as Array<{ x: number; y: number }>
  if (!pts || pts.length === 0) return false

  // 检查是否有实质变化
  let hasChanged = newPoints.length !== pts.length
  if (!hasChanged) {
    for (let i = 0; i < pts.length; i++) {
      if (
        skeletonCoordChanged(pts[i].x, newPoints[i].x) ||
        skeletonCoordChanged(pts[i].y, newPoints[i].y)
      ) {
        hasChanged = true
        break
      }
    }
  }

  if (hasChanged) {
    if (newPoints.length === pts.length) {
      // 长度一致：原地覆写坐标（零对象分配，最少响应式触发）
      for (let i = 0; i < pts.length; i++) {
        pts[i].x = newPoints[i].x
        pts[i].y = newPoints[i].y
      }
    } else {
      // 段数变化：整体替换数组（单次响应式触发）
      const newPts: Array<{ x: number; y: number }> = new Array(newPoints.length)
      for (let i = 0; i < newPoints.length; i++) {
        newPts[i] = { x: newPoints[i].x, y: newPoints[i].y }
      }
      ;(comp.value as unknown as IPenComponent).points = newPts
    }

    // 重新读取 points（段数变化时数组已被整体替换）
    const curPts = (comp.value as unknown as IPenComponent).points as Array<{ x: number; y: number }>
    const bound = getBound(curPts)
    const pc = comp as any
    if (
      skeletonCoordChanged(pc.x ?? 0, bound.x) ||
      skeletonCoordChanged(pc.y ?? 0, bound.y) ||
      skeletonCoordChanged(pc.w ?? 0, bound.w) ||
      skeletonCoordChanged(pc.h ?? 0, bound.h)
    ) {
      pc.x = bound.x; pc.y = bound.y; pc.w = bound.w; pc.h = bound.h
    }
  }

  return hasChanged
}

/** 逐段把采样点串成退化贝塞尔 (控制点=端点) 直线序列: [P0,P0,P1,P1] + [P0,P1,P1]... */
function polylineComponentFromSamples(
  outBuffer: Float64Array,
  rangeStart: number,
  rangeEnd: number,
  meta: ComponentSegmentMeta,
): Array<{ x: number; y: number }> {
  const { samplesPerSegment, closePath } = meta

  const points: Array<{ x: number; y: number }> = []
  let sampleOffset = 0
  let isFirstCurve = true

  for (let seg = 0; seg < samplesPerSegment.length; seg++) {
    const count = samplesPerSegment[seg]
    // 每对相邻采样点构成一条直线段; 跳过过短的段 (塌缩段产生的点状毛刺)
    for (let s = 0; s < count - 1; s++) {
      const bi = (rangeStart + sampleOffset + s) * 2
      const p0 = { x: outBuffer[bi], y: outBuffer[bi + 1] }
      const p1 = { x: outBuffer[bi + 2], y: outBuffer[bi + 3] }
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.5) continue
      if (isFirstCurve) {
        points.push(
          { x: p0.x, y: p0.y },
          { x: p0.x, y: p0.y },
          { x: p1.x, y: p1.y },
          { x: p1.x, y: p1.y },
        )
        isFirstCurve = false
      } else {
        points.push(
          { x: p0.x, y: p0.y },
          { x: p1.x, y: p1.y },
          { x: p1.x, y: p1.y },
        )
      }
    }
    sampleOffset += count
  }

  if (closePath && points.length >= 4) {
    const firstP0 = points[0]
    const lastP3 = points[points.length - 1]
    if (
      Math.abs(lastP3.x - firstP0.x) > FIT_MAX_ERROR ||
      Math.abs(lastP3.y - firstP0.y) > FIT_MAX_ERROR
    ) {
      // 末段退化贝塞尔的 c2 与 p3 同值, 一并吸附保证闭合处视觉干净
      lastP3.x = firstP0.x
      lastP3.y = firstP0.y
      const lastC2 = points[points.length - 2]
      lastC2.x = firstP0.x
      lastC2.y = firstP0.y
    }
  }

  return points
}

export function applyFittedSamplesToComponents(
  penComponents: IGlyphComponent[],
  outBuffer: Float64Array,
  bindData: SampledSkeletonBindData,
): boolean {
  const { componentSampleRanges, componentSegmentMeta } = bindData
  if (!componentSampleRanges?.length) return false

  if (import.meta.env.DEV) {
    console.log(LOG, 'applyFitted penComps=' + penComponents.length +
      ' ranges=' + componentSampleRanges.length +
      ' metas=' + componentSegmentMeta.length)
  }

  const resolve = createComponentResolver(penComponents, bindData)
  let anyPointChanged = false

  for (let rangeIdx = 0; rangeIdx < componentSampleRanges.length; rangeIdx++) {
    const range = componentSampleRanges[rangeIdx]
    const { comp, meta } = resolve(rangeIdx)
    if (!comp) continue

    if (!meta) {
      if (import.meta.env.DEV) {
        console.warn(LOG, 'meta missing for uuid=' + range.componentUUID +
          ' rangeIdx=' + rangeIdx + ' metaCount=' + componentSegmentMeta.length +
          ' SKIPPING (prevents crash)')
      }
      continue
    }

    // 直接从 Float64Array 拟合（不构造中间数组）
    const fittedPoints = fitComponentFromSamples(outBuffer, range.start, range.end, meta)
    if (fittedPoints.length === 0) continue

    // DEV: 输出原始 vs 拟合的控制点数量对比
    if (import.meta.env.DEV) {
      const pts = (comp.value as unknown as IPenComponent).points as Array<{ x: number; y: number }>
      console.log(LOG, 'writeback uuid=' + range.componentUUID +
        ' origCP=' + pts.length + ' fittedCP=' + fittedPoints.length +
        (fittedPoints.length !== pts.length ? ' (SEGMENT COUNT CHANGED!)' : ''))
    }

    if (updateComponentPoints(comp, fittedPoints)) {
      anyPointChanged = true
    }
  }

  return anyPointChanged
}

/**
 * 拖拽预览写回: 与拟合写回结构一致, 但不调用 fitCurve,
 * 直接把变换后的采样点串成直线段 (退化贝塞尔) 写入组件,
 * 拖拽过程中以短折线渲染阶段性效果, 松手后由拟合写回恢复曲线。
 */
export function applyPolylineSamplesToComponents(
  penComponents: IGlyphComponent[],
  outBuffer: Float64Array,
  bindData: SampledSkeletonBindData,
): boolean {
  const { componentSampleRanges, componentSegmentMeta } = bindData
  if (!componentSampleRanges?.length) return false

  const resolve = createComponentResolver(penComponents, bindData)
  let anyPointChanged = false

  for (let rangeIdx = 0; rangeIdx < componentSampleRanges.length; rangeIdx++) {
    const range = componentSampleRanges[rangeIdx]
    const { comp, meta } = resolve(rangeIdx)
    if (!comp) continue

    if (!meta) {
      if (import.meta.env.DEV) {
        console.warn(LOG, 'meta missing for uuid=' + range.componentUUID +
          ' rangeIdx=' + rangeIdx + ' metaCount=' + componentSegmentMeta.length +
          ' SKIPPING (prevents crash)')
      }
      continue
    }

    const polyPoints = polylineComponentFromSamples(outBuffer, range.start, range.end, meta)
    if (polyPoints.length === 0) continue

    if (updateComponentPoints(comp, polyPoints)) {
      anyPointChanged = true
    }
  }

  return anyPointChanged
}
