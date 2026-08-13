/**
 * 骨架采样模块
 * 将钢笔组件的贝塞尔曲线密集采样为固定数量的点，
 * 提供采样点与骨骼的绑定计算、变换缓冲区和 IndexedDB 持久化支持。
 */

import { bezierCurve } from '@/core/utils/bezierCurve'
import type { IGlyphComponent, IPenComponent } from '@/core/types'

// ==================== 常量 ====================

/** 总采样点数（所有贝塞尔段合计） */
export const SAMPLE_TOTAL = 1000

/** 每段最少采样点数 */
export const MIN_SAMPLES_PER_SEGMENT = 4

// ==================== 类型定义 ====================

/** 骨骼定义（从 glyphSkeletonBind.ts 提取，公共类型） */
export interface Bone {
  id: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  length: number
  bindLength: number
  uAxis: { x: number; y: number }
  vAxis: { x: number; y: number }
  parent?: string
  children: string[]
  bindMatrix: number[]
  currentMatrix: number[]
}

/** 单个采样点的骨骼绑定条目 */
export interface SampleBoneBinding {
  boneIndex: number
  weight: number
  localCoords: { u: number; v: number }
}

/** 单个采样点的完整骨骼绑定 */
export interface SampledPointBinding {
  pointIndex: number
  bones: SampleBoneBinding[]
}

/** 每个钢笔组件的段元数据（用于拟合时按段分组采样点） */
export interface ComponentSegmentMeta {
  componentUUID: string
  /** 各段的采样点数量（按段顺序排列） */
  samplesPerSegment: number[]
  /** 是否闭合路径 */
  closePath: boolean
}

/**
 * 完整的采样骨架绑定数据
 *
 * 存储策略：
 * - bones + samplePoints + componentSegmentMeta → IndexedDB (~19KB)
 * - _pointsBonesMap → 不存储，按需重算
 * - _transformBuffer → 运行时惰性分配，不持久化
 */
export interface SampledSkeletonBindData {
  /** 骨骼数组 */
  bones: Bone[]
  /**
   * 扁平采样点数组 [x0, y0, x1, y1, ...] 长度 = SAMPLE_TOTAL * 2
   * 序列化友好，structured clone 紧凑
   */
  samplePoints: number[]
  /** 每个组件的采样点索引范围 */
  componentSampleRanges: Array<{ componentUUID: string; start: number; end: number }>
  /** 每个组件的段元数据 */
  componentSegmentMeta: ComponentSegmentMeta[]

  // === 以下为运行时字段（不持久化，带 _ 前缀） ===

  /** 骨骼绑定缓存（惰性重算；bones 更新时清除） */
  _pointsBonesMap?: SampledPointBinding[]
  /** 变换缓冲区 Float64Array(SAMPLE_TOTAL * 2)，惰性分配 */
  _transformBuffer?: Float64Array
}

// ==================== 辅助函数 ====================

/**
 * 从扁平采样点数组读取单个点
 */
export function getSamplePoint(
  samplePoints: number[],
  index: number,
): { x: number; y: number } {
  const i = index * 2
  return { x: samplePoints[i], y: samplePoints[i + 1] }
}

/**
 * 计算一段三次贝塞尔曲线的弦长（近似弧长）
 */
function cubicChordLength(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): number {
  // 用控制点多边形周长近似
  const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const d3 = Math.hypot(p3.x - p2.x, p3.y - p2.y)
  return d1 + d2 + d3
}

// ==================== 段切分 ====================

/** 三次贝塞尔段：[p0, p1, p2, p3] */
type CubicSegment = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
]

/**
 * 从钢笔组件 points 中切出三次贝塞尔段
 * points 格式：[p0,p1,p2,p3, p3,p4,p5,p6, ...]（每段共享端点）
 */
export function splitPenComponentIntoSegments(comp: IGlyphComponent): {
  segments: CubicSegment[]
  closePath: boolean
} {
  const penValue = comp.value as unknown as IPenComponent
  const points = penValue.points as Array<{ x: number; y: number }>
  const closePath = !!penValue.closePath

  if (!points || points.length < 4) {
    return { segments: [], closePath }
  }

  const segments: CubicSegment[] = []
  // 每 3 个点前进一段（因为相邻段共享端点）
  for (let i = 0; i < points.length - 3; i += 3) {
    segments.push([points[i], points[i + 1], points[i + 2], points[i + 3]])
  }

  return { segments, closePath }
}

// ==================== 采样数分配 ====================

/**
 * 按弦长比例分配采样数，每段至少 MIN_SAMPLES_PER_SEGMENT 个
 * 最后调整使总和恰好等于 total
 */
export function allocateSamplesPerSegment(
  segments: Array<{ chordLength: number }>,
  total: number = SAMPLE_TOTAL,
): number[] {
  if (segments.length === 0) return []

  // 每段至少 MIN_SAMPLES_PER_SEGMENT
  const minTotal = segments.length * MIN_SAMPLES_PER_SEGMENT
  const remaining = Math.max(0, total - minTotal)

  // 计算总弦长
  const totalChordLength = segments.reduce((sum, s) => sum + Math.max(s.chordLength, 0.001), 0)

  // 按比例分配
  const alloc = segments.map((s) => {
    const proportion = Math.max(s.chordLength, 0.001) / totalChordLength
    return MIN_SAMPLES_PER_SEGMENT + Math.round(remaining * proportion)
  })

  // 调整使总和等于 total
  let diff = total - alloc.reduce((a, b) => a + b, 0)
  // 从最长的段增减
  let idx = 0
  while (diff !== 0 && idx < alloc.length * 2) {
    const i = idx % alloc.length
    if (diff > 0) {
      alloc[i]++
      diff--
    } else if (diff < 0 && alloc[i] > MIN_SAMPLES_PER_SEGMENT) {
      alloc[i]--
      diff++
    }
    idx++
  }

  return alloc
}

// ==================== 贝塞尔采样 ====================

/**
 * 对一段三次贝塞尔曲线均匀采样 count 个点（含两端点）
 */
export function sampleCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  count: number,
): Array<{ x: number; y: number }> {
  if (count < 2) count = 2
  const result: Array<{ x: number; y: number }> = new Array(count)

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    result[i] = bezierCurve.q([p0, p1, p2, p3], t)
  }

  return result
}

// ==================== 构建采样绑定数据 ====================

/**
 * 核心函数：对一组钢笔组件执行采样，构建完整的 SampledSkeletonBindData
 * - 不会计算 _pointsBonesMap（由 ensurePointsBonesMap 惰性初始化）
 * - _transformBuffer 初始为 undefined（由 getTransformBuffer 惰性分配）
 *
 * @param penComponents 钢笔组件列表
 * @param bones 骨骼数组
 * @param total 总采样点数（默认 SAMPLE_TOTAL）
 */
export function buildSampledBindData(
  penComponents: IGlyphComponent[],
  bones: Bone[],
  total: number = SAMPLE_TOTAL,
): SampledSkeletonBindData {
  // 第一步：切分所有段并收集元数据
  const allSegments: Array<{
    seg: CubicSegment
    chordLength: number
    componentUUID: string
    compIndex: number
    segIndex: number
  }> = []

  const compMetaList: Array<{
    componentUUID: string
    closePath: boolean
    segCount: number
    segChordLengths: number[]
  }> = []

  for (const comp of penComponents) {
    const { segments, closePath } = splitPenComponentIntoSegments(comp)
    if (segments.length === 0) {
      compMetaList.push({
        componentUUID: comp.uuid,
        closePath,
        segCount: 0,
        segChordLengths: [],
      })
      continue
    }

    const segChordLengths: number[] = []
    for (const seg of segments) {
      const cl = cubicChordLength(seg[0], seg[1], seg[2], seg[3])
      segChordLengths.push(cl)
      allSegments.push({
        seg,
        chordLength: cl,
        componentUUID: comp.uuid,
        compIndex: compMetaList.length,
        segIndex: segChordLengths.length - 1,
      })
    }

    compMetaList.push({
      componentUUID: comp.uuid,
      closePath,
      segCount: segments.length,
      segChordLengths,
    })
  }

  if (allSegments.length === 0) {
    // 无有效段，返回空结构
    return {
      bones,
      samplePoints: [],
      componentSampleRanges: [],
      componentSegmentMeta: [],
    }
  }

  // 第二步：分配采样数
  const samplesPerSeg = allocateSamplesPerSegment(
    allSegments.map((s) => ({ chordLength: s.chordLength })),
    total,
  )

  // 第三步：采样并合并为扁平数组
  const samplePoints: number[] = new Array(total * 2)
  const componentSampleRanges: Array<{ componentUUID: string; start: number; end: number }> = []
  const componentSamplesPerSegment: Array<{ uuid: string; samplesPerSegment: number[]; closePath: boolean }> = []

  // 初始化每个组件的范围
  for (const meta of compMetaList) {
    componentSampleRanges.push({
      componentUUID: meta.componentUUID,
      start: -1,
      end: -1,
    })
    componentSamplesPerSegment.push({
      uuid: meta.componentUUID,
      samplesPerSegment: new Array(meta.segCount).fill(0),
      closePath: meta.closePath,
    })
  }

  let writeIdx = 0
  for (let s = 0; s < allSegments.length; s++) {
    const { seg, componentUUID, compIndex, segIndex } = allSegments[s]
    const count = samplesPerSeg[s]
    const samples = sampleCubicBezier(seg[0], seg[1], seg[2], seg[3], count)

    // 更新组件范围
    if (componentSampleRanges[compIndex].start === -1) {
      componentSampleRanges[compIndex].start = writeIdx
    }

    // 写入扁平数组
    for (let i = 0; i < count; i++) {
      samplePoints[writeIdx * 2] = samples[i].x
      samplePoints[writeIdx * 2 + 1] = samples[i].y
      writeIdx++
    }

    componentSampleRanges[compIndex].end = writeIdx
    componentSamplesPerSegment[compIndex].samplesPerSegment[segIndex] = count
  }

  // 构建 ComponentSegmentMeta
  const componentSegmentMeta: ComponentSegmentMeta[] = componentSamplesPerSegment
    .filter((c) => c.samplesPerSegment.length > 0)
    .map((c) => ({
      componentUUID: c.uuid,
      samplesPerSegment: c.samplesPerSegment,
      closePath: c.closePath,
    }))

  // 过滤掉无采样点的组件范围
  const filteredRanges = componentSampleRanges.filter((r) => r.start >= 0 && r.end > r.start)

  return {
    bones,
    samplePoints,
    componentSampleRanges: filteredRanges,
    componentSegmentMeta,
    // 运行时字段不初始化
    _pointsBonesMap: undefined,
    _transformBuffer: undefined,
  }
}

// ==================== 惰性计算 ====================

/**
 * 确保 _pointsBonesMap 存在（惰性重算）
 * 需要从调用方注入 calculatePointBones 函数以避免循环依赖
 */
export function ensurePointsBonesMap(
  bindData: SampledSkeletonBindData,
  calculatePointBones: (
    point: { x: number; y: number },
    bones: Bone[],
    pointIndex: number,
  ) => SampledPointBinding,
): SampledPointBinding[] {
  if (!bindData._pointsBonesMap) {
    const { samplePoints, bones } = bindData
    const count = samplePoints.length / 2
    bindData._pointsBonesMap = new Array(count)
    for (let i = 0; i < count; i++) {
      const pt = getSamplePoint(samplePoints, i)
      bindData._pointsBonesMap[i] = calculatePointBones(pt, bones, i)
    }
  }
  return bindData._pointsBonesMap
}

/**
 * 清除骨骼绑定缓存（bones 更新后调用）
 */
export function invalidatePointsBonesMap(bindData: SampledSkeletonBindData): void {
  bindData._pointsBonesMap = undefined
}

/**
 * 惰性确保存储包装层的运行时数据（pointsBonesMap + originalPoints 对象数组）
 * 这些数据只服务于权重绘制等交互流程，不随字形持久化；
 * 释放后（releaseStoredBindRuntimeData）由本函数按需重建。
 */
export function ensureStoredBindRuntimeData(
  stored: any,
  calculatePointBones: (
    point: { x: number; y: number },
    bones: Bone[],
    pointIndex: number,
  ) => SampledPointBinding,
): void {
  if (!stored?._sampleBindData) return
  const sampled: SampledSkeletonBindData = stored._sampleBindData

  if (!sampled._pointsBonesMap) {
    sampled._pointsBonesMap = ensurePointsBonesMap(sampled, calculatePointBones)
  }
  if (!stored.pointsBonesMap) {
    stored.pointsBonesMap = sampled._pointsBonesMap
  }
  if (!stored.originalPoints) {
    const flat = sampled.samplePoints
    const pts: Array<{ x: number; y: number }> = []
    for (let i = 0; i < flat.length / 2; i++) {
      pts.push({ x: flat[i * 2], y: flat[i * 2 + 1] })
    }
    stored.originalPoints = pts
  }
}

/**
 * 释放存储包装层与采样数据的运行时缓存：
 * - _pointsBonesMap（~100KB，1000 条骨骼绑定）拖拽结束后不再需要，下次按需重算
 * - originalPoints（1000 个 {x,y} 对象）同样释放
 * - _transformBuffer（Float64Array 2000）释放
 *
 * 持久化数据（bones / 扁平 samplePoints / componentSegmentMeta）保留不受影响。
 */
export function releaseStoredBindRuntimeData(stored: any): void {
  if (!stored) return
  const sampled: SampledSkeletonBindData | undefined = stored._sampleBindData
  if (sampled) {
    sampled._pointsBonesMap = undefined
    sampled._transformBuffer = undefined
  }
  stored.pointsBonesMap = undefined
  stored.originalPoints = undefined
}

/**
 * 获取或创建变换缓冲区（惰性分配，复用）
 * 返回的 Float64Array 长度为 SAMPLE_TOTAL * 2
 */
export function getTransformBuffer(bindData: SampledSkeletonBindData): Float64Array {
  if (!bindData._transformBuffer) {
    bindData._transformBuffer = new Float64Array(SAMPLE_TOTAL * 2)
  } else {
    // 清零复用（避免残留值干扰）
    bindData._transformBuffer.fill(0)
  }
  return bindData._transformBuffer
}

// ==================== 图层切片 ====================

/**
 * 按组件 UUID 从完整数据中切片出某图层的分量
 * 注意：不拷贝底层 samplePoints 数组，只返回索引范围引用
 */
export function sliceSampledBindDataForLayer(
  bindData: SampledSkeletonBindData,
  layerUUIDs: Set<string>,
): {
  samplePoints: number[]
  samplePointsBonesMap: SampledPointBinding[] | undefined
  componentSampleRanges: Array<{ componentUUID: string; start: number; end: number }>
} {
  const ranges = bindData.componentSampleRanges.filter((r) =>
    layerUUIDs.has(r.componentUUID),
  )

  if (ranges.length === 0) {
    return {
      samplePoints: bindData.samplePoints,
      samplePointsBonesMap: bindData._pointsBonesMap,
      componentSampleRanges: [],
    }
  }

  // 重新计算相对于切片后数组的起始偏移
  const minStart = Math.min(...ranges.map((r) => r.start))
  const shiftedRanges = ranges.map((r) => ({
    componentUUID: r.componentUUID,
    start: r.start - minStart,
    end: r.end - minStart,
  }))

  // 切片 samplePoints
  const slicedPoints = bindData.samplePoints.slice(minStart * 2, ranges[ranges.length - 1].end * 2)

  // 切片 pointsBonesMap
  let slicedBindings: SampledPointBinding[] | undefined
  if (bindData._pointsBonesMap) {
    slicedBindings = bindData._pointsBonesMap.slice(
      minStart,
      ranges[ranges.length - 1].end,
    )
    // 更新 pointIndex
    for (let i = 0; i < slicedBindings.length; i++) {
      slicedBindings[i] = { ...slicedBindings[i], pointIndex: i }
    }
  }

  return {
    samplePoints: slicedPoints,
    samplePointsBonesMap: slicedBindings,
    componentSampleRanges: shiftedRanges,
  }
}

// ==================== 持久化辅助 ====================

/**
 * 准备存入 IndexedDB 的数据（剥离运行时字段）
 * 返回纯数据副本，不影响原始 bindData
 */
export function toPersistableBindData(
  bindData: SampledSkeletonBindData,
): Omit<SampledSkeletonBindData, '_pointsBonesMap' | '_transformBuffer'> {
  return {
    bones: bindData.bones,
    samplePoints: bindData.samplePoints,
    componentSampleRanges: bindData.componentSampleRanges,
    componentSegmentMeta: bindData.componentSegmentMeta,
  }
}

/**
 * 从 IndexedDB 加载后还原运行时字段
 */
export function hydrateBindData(
  stored: Omit<SampledSkeletonBindData, '_pointsBonesMap' | '_transformBuffer'>,
): SampledSkeletonBindData {
  return {
    ...stored,
    _pointsBonesMap: undefined,
    _transformBuffer: undefined,
  }
}

// ==================== 轮廓编辑暂存/恢复 ====================

/**
 * 轮廓编辑前暂存骨架绑定数据
 * 将 live bind 字段移到 skeleton._stashedBindData，并清空现场字段
 */
export function stashSkeletonBindData(skeleton: any): void {
  if (!skeleton) return

  const stashed: any = {}

  if (skeleton.skeletonBindData) {
    stashed.skeletonBindData = skeleton.skeletonBindData
    skeleton.skeletonBindData = undefined
  }
  if (skeleton.glyphSkeletonBindData) {
    stashed.glyphSkeletonBindData = skeleton.glyphSkeletonBindData
    skeleton.glyphSkeletonBindData = undefined
  }
  if (skeleton.variableKeyframeBinds) {
    stashed.variableKeyframeBinds = skeleton.variableKeyframeBinds
    skeleton.variableKeyframeBinds = undefined
  }
  if (skeleton.skeletonBindDataRef) {
    stashed.skeletonBindDataRef = skeleton.skeletonBindDataRef
  }

  // 同时清除骨架绑定激活标志
  if (skeleton.onSkeletonBind !== undefined) {
    stashed.onSkeletonBind = skeleton.onSkeletonBind
    skeleton.onSkeletonBind = false
  }

  skeleton._stashedBindData = stashed
}

/**
 * 重新绑定时恢复暂存的骨架绑定数据
 */
export function restoreStashedSkeletonBindData(skeleton: any): void {
  if (!skeleton?._stashedBindData) return

  const stashed = skeleton._stashedBindData

  if (stashed.skeletonBindData) {
    skeleton.skeletonBindData = stashed.skeletonBindData
  }
  if (stashed.glyphSkeletonBindData) {
    skeleton.glyphSkeletonBindData = stashed.glyphSkeletonBindData
  }
  if (stashed.variableKeyframeBinds) {
    skeleton.variableKeyframeBinds = stashed.variableKeyframeBinds
  }
  if (stashed.onSkeletonBind !== undefined) {
    skeleton.onSkeletonBind = stashed.onSkeletonBind
  }

  delete skeleton._stashedBindData
}
