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
 * 将一组采样点拟合为单段三次贝塞尔曲线
 * 保证返回恰好 4 个控制点 [P0, P1, P2, P3]
 */
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

  const input: FitIPoint[] = samples.map((p) => ({ x: p.x, y: p.y }))

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
            (beziers.length > 1 ? ' (SPLIT!)' : '') +
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
  samples: Array<{ x: number; y: number }>,
  meta: ComponentSegmentMeta,
): Array<{ x: number; y: number }> {
  const { samplesPerSegment, closePath } = meta
  if (samplesPerSegment.length === 0 || samples.length === 0) return []

  const points: Array<{ x: number; y: number }> = []
  let sampleOffset = 0
  let isFirstCurve = true

  if (import.meta.env.DEV) {
    console.log(LOG, 'fitComponent segs=' + samplesPerSegment.length +
      ' totalSamples=' + samples.length +
      ' perSeg=[' + samplesPerSegment.join(',') + ']' +
      ' closePath=' + closePath)
  }

  for (let seg = 0; seg < samplesPerSegment.length; seg++) {
    const count = samplesPerSegment[seg]
    const segSamples = samples.slice(sampleOffset, sampleOffset + count)
    sampleOffset += count

    // fitCurve 自适应分割：一个原始段可能被拟合成多条贝塞尔曲线
    const beziers = fitSamplesToBeziers(segSamples)

    for (let b = 0; b < beziers.length; b++) {
      const bez = beziers[b]
      if (isFirstCurve) {
        // 第一条曲线：写入全部4个控制点
        points.push(
          { x: bez[0].x, y: bez[0].y },
          { x: bez[1].x, y: bez[1].y },
          { x: bez[2].x, y: bez[2].y },
          { x: bez[3].x, y: bez[3].y },
        )
        isFirstCurve = false
      } else {
        // 后续曲线：仅写入 P1, P2, P3（P0 缝合到前一曲线的 P3）
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
  transformPointToWorld: (point: { x: number; y: number }, matrix: number[]) => { x: number; y: number },
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

    let newX = 0, newY = 0
    const originalPt = getSamplePoint(samplePoints, i)

    for (const { boneIndex, weight } of binding.bones) {
      const bone = bones[boneIndex]
      if (!bone?.currentMatrix) continue
      const tp = transformPointToWorld(originalPt, bone.currentMatrix)
      newX += weight * tp.x
      newY += weight * tp.y
    }

    outBuffer[i * 2] = newX
    outBuffer[i * 2 + 1] = newY
  }
}

// ==================== 拟合写回 ====================

export function applyFittedSamplesToComponents(
  penComponents: IGlyphComponent[],
  outBuffer: Float64Array,
  bindData: SampledSkeletonBindData,
): boolean {
  const { componentSampleRanges, componentSegmentMeta } = bindData
  if (!componentSampleRanges?.length) return false

  const componentMap = new Map<string, IGlyphComponent>()
  for (const comp of penComponents) {
    componentMap.set(comp.uuid, comp)
  }

  const metaMap = new Map<string, ComponentSegmentMeta>()
  for (const meta of componentSegmentMeta) {
    metaMap.set(meta.componentUUID, meta)
  }

  if (import.meta.env.DEV) {
    console.log(LOG, 'applyFitted penComps=' + penComponents.length +
      ' ranges=' + componentSampleRanges.length +
      ' metas=' + componentSegmentMeta.length)
    for (let ri = 0; ri < componentSampleRanges.length; ri++) {
      const r = componentSampleRanges[ri]
      console.log(LOG, '  range[' + ri + '] uuid=' + r.componentUUID +
        ' start=' + r.start + ' end=' + r.end +
        ' count=' + (r.end - r.start))
    }
  }

  let anyPointChanged = false

  for (let rangeIdx = 0; rangeIdx < componentSampleRanges.length; rangeIdx++) {
    const range = componentSampleRanges[rangeIdx]
    let comp = componentMap.get(range.componentUUID)
    let meta = metaMap.get(range.componentUUID)

    // UUID 查找失败 → 按索引回退（组件被重新生成后 UUID 会变）
    if (!comp && rangeIdx < penComponents.length) {
      comp = penComponents[rangeIdx]
      if (import.meta.env.DEV) {
        console.log(LOG, 'UUID mismatch, index fallback: old=' + range.componentUUID + ' new=' + (comp?.uuid || 'none'))
      }
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

    if (!comp) continue
    const pts = (comp.value as unknown as IPenComponent).points as Array<{ x: number; y: number }>
    if (!pts || pts.length === 0) continue

    if (!meta && rangeIdx < componentSegmentMeta.length) {
      meta = componentSegmentMeta[rangeIdx]
    }
    if (!meta) continue

    const sampleCount = range.end - range.start
    const compSamples: Array<{ x: number; y: number }> = new Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      const idx = (range.start + i) * 2
      compSamples[i] = { x: outBuffer[idx], y: outBuffer[idx + 1] }
    }

    const fittedPoints = fitComponentFromSamples(compSamples, meta)
    if (fittedPoints.length === 0) continue

    // DEV: 输出原始 vs 拟合的控制点数量对比
    if (import.meta.env.DEV) {
      console.log(LOG, 'writeback uuid=' + range.componentUUID +
        ' origCP=' + pts.length + ' fittedCP=' + fittedPoints.length +
        (fittedPoints.length !== pts.length ? ' (SEGMENT COUNT CHANGED!)' : ''))
    }

    // 直接替换整个 points 数组（fitCurve 可能改变段数）
    if (fittedPoints.length > 0) {
      // 检查是否有实质变化
      let hasChanged = fittedPoints.length !== pts.length
      if (!hasChanged) {
        for (let i = 0; i < pts.length; i++) {
          if (
            skeletonCoordChanged(pts[i].x, fittedPoints[i].x) ||
            skeletonCoordChanged(pts[i].y, fittedPoints[i].y)
          ) {
            hasChanged = true
            break
          }
        }
      }

      if (hasChanged) {
        // 替换整个数组
        pts.length = 0
        for (const p of fittedPoints) {
          pts.push({ x: p.x, y: p.y })
        }
        anyPointChanged = true
      }
    }

    if (anyPointChanged) {
      const bound = getBound(pts)
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
  }

  return anyPointChanged
}
