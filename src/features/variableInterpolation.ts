/**
 * 可变参数差值引擎
 * - 每个可变参数有 N 个关键帧，按 value 排序后取最小/最大作为两端
 * - 差值在关键帧图层之间按组件顺序进行
 * - 同时插值 raw points 和 transform（x/y/w/h/rotation/flipX/flipY）
 * - 多变量以首个变量最小关键帧图层为基准，各变量独立叠加 delta
 */

import type { ICustomGlyph, IGlyphComponent, IPenComponent } from '@/core/types'
import { getBound } from '@/core/utils/math'

export interface InterpolationResult {
  success: boolean
  error?: string
  /** 差值后每组件数据：raw points + 全量 transform */
  interpolatedComponents?: Map<string, {
    points: Array<{ x: number; y: number }>
    x: number; y: number; w: number; h: number
    rotation: number; flipX: boolean; flipY: boolean
  }>
}

function rawPoints(comp: IGlyphComponent): Array<{ x: number; y: number }> {
  const p = (comp.value as IPenComponent)?.points
  return (p && Array.isArray(p)) ? p.map((pt: any) => ({ x: pt.x, y: pt.y })) : []
}

function penCompsInLayer(glyph: ICustomGlyph, layer: string): IGlyphComponent[] {
  const uuidSet = new Set(glyph.layers?.[layer] || [])
  const result: IGlyphComponent[] = []
  for (const item of glyph.orderedList || []) {
    if (item.type === 'component' && uuidSet.has(item.uuid)) {
      const comp = glyph.components.find(c => c.uuid === item.uuid)
      if (comp && comp.type === 'pen') result.push(comp as IGlyphComponent)
    }
  }
  return result
}

export function getAllLayerUUIDs(glyph: ICustomGlyph): Set<string> {
  const s = new Set<string>()
  if (glyph.layers) for (const uuids of Object.values(glyph.layers)) for (const uuid of uuids) s.add(uuid)
  return s
}

export function getPreviewDisplayUUIDs(glyph: ICustomGlyph): Set<string> {
  const vs = glyph.variables
  if (!vs?.length) return new Set()
  const sorted = [...vs[0].keyframes].sort((a, b) => Number(a.value) - Number(b.value))
  if (sorted.length === 0) return new Set()
  return new Set(glyph.layers?.[sorted[0].layer] || [])
}

export function interpolateGlyphOutline(glyph: ICustomGlyph): InterpolationResult {
  const variables = glyph.variables
  if (!variables || variables.length === 0) {
    return { success: true, interpolatedComponents: new Map() }
  }

  const firstSorted = [...variables[0].keyframes].sort((a, b) => Number(a.value) - Number(b.value))
  if (firstSorted.length < 2) return { success: false, error: 'Need at least 2 keyframes' }

  const displayLayer = firstSorted[0].layer
  const baseComps = penCompsInLayer(glyph, displayLayer)
  if (baseComps.length === 0) return { success: false, error: `Display layer "${displayLayer}" has no pen components` }

  const basePtCounts = baseComps.map(c => rawPoints(c).length)

  // delta: [compIndex][pointIndex]{x,y} + transform deltas per component
  const ptDelta: Array<Array<{ x: number; y: number }>> = basePtCounts.map(n => Array(n).fill(null).map(() => ({ x: 0, y: 0 })))
  const xfDelta = baseComps.map(() => ({ x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: 0, flipY: 0 }))
  let xfCount = 0

  // 骨架变形后的锚点缓存（由 applySkeletonTransformation 存入，避免重复计算）
  const vkb: Record<string, any> | undefined = (glyph.skeleton as any)?.variableKeyframeBinds

  for (const variable of variables) {
    if (variable.keyframes.length < 2) continue
    const sorted = [...variable.keyframes].sort((a, b) => Number(a.value) - Number(b.value))
    const lo = sorted[0]
    const hi = sorted[sorted.length - 1]
    const loVal = Number(lo.value)
    const hiVal = Number(hi.value)
    if (loVal === hiVal) continue

    let t = (Number(variable.value) - loVal) / (hiVal - loVal)
    t = Math.max(0, Math.min(1, t))

    const loComps = penCompsInLayer(glyph, lo.layer)
    const hiComps = penCompsInLayer(glyph, hi.layer)
    if (loComps.length !== baseComps.length || hiComps.length !== baseComps.length) continue

    // 优先使用骨架变形后的锚点
    const loDeformed: Array<{ x: number; y: number }> | undefined = vkb?.[lo.uuid]?.deformedPoints
    const hiDeformed: Array<{ x: number; y: number }> | undefined = vkb?.[hi.uuid]?.deformedPoints
    let loDeformedOff = 0
    let hiDeformedOff = 0

    for (let ci = 0; ci < baseComps.length; ci++) {
      const n = basePtCounts[ci]
      const loPts = loDeformed
        ? loDeformed.slice(loDeformedOff, loDeformedOff + n)
        : rawPoints(loComps[ci])
      const hiPts = hiDeformed
        ? hiDeformed.slice(hiDeformedOff, hiDeformedOff + n)
        : rawPoints(hiComps[ci])
      loDeformedOff += n
      hiDeformedOff += n
      if (loPts.length !== n || hiPts.length !== n) continue

      // raw-point delta
      const d = ptDelta[ci]
      for (let pi = 0; pi < basePtCounts[ci]; pi++) {
        d[pi].x += (hiPts[pi].x - loPts[pi].x) * t
        d[pi].y += (hiPts[pi].y - loPts[pi].y) * t
      }

      // transform delta
      const loC = loComps[ci]; const hiC = hiComps[ci]
      xfDelta[ci].x += ((hiC.x ?? 0) - (loC.x ?? 0)) * t
      xfDelta[ci].y += ((hiC.y ?? 0) - (loC.y ?? 0)) * t
      xfDelta[ci].w += ((hiC.w ?? 0) - (loC.w ?? 0)) * t
      xfDelta[ci].h += ((hiC.h ?? 0) - (loC.h ?? 0)) * t
      xfDelta[ci].rotation += ((hiC.rotation ?? 0) - (loC.rotation ?? 0)) * t
      xfDelta[ci].flipX += ((hiC.flipX ? 1 : 0) - (loC.flipX ? 1 : 0)) * t
      xfDelta[ci].flipY += ((hiC.flipY ? 1 : 0) - (loC.flipY ? 1 : 0)) * t
    }
    xfCount++
  }

  // 基础图层也优先使用骨架变形后的锚点
  const displayKfUuid = firstSorted[0].uuid
  const baseDeformed: Array<{ x: number; y: number }> | undefined = vkb?.[displayKfUuid]?.deformedPoints
  let baseDeformedOff = 0

  const result = new Map<string, { points: Array<{ x: number; y: number }>; x: number; y: number; w: number; h: number; rotation: number; flipX: boolean; flipY: boolean }>()
  for (let ci = 0; ci < baseComps.length; ci++) {
    const comp = baseComps[ci]
    const n = basePtCounts[ci]
    const basePts = baseDeformed
      ? baseDeformed.slice(baseDeformedOff, baseDeformedOff + n)
      : rawPoints(comp)
    baseDeformedOff += n
    const d = ptDelta[ci]
    const xf = xfDelta[ci]
    const outPts = basePts.map((p, i) => ({ x: p.x + d[i].x, y: p.y + d[i].y }))
    // 从差值后的锚点反算包围盒，确保骨架变形后的位置/尺寸正确
    const bound = outPts.length > 0 ? getBound(outPts) : { x: comp.x ?? 0, y: comp.y ?? 0, w: comp.w ?? 0, h: comp.h ?? 0 }
    result.set(comp.uuid, {
      points: outPts,
      x: bound.x,
      y: bound.y,
      w: bound.w,
      h: bound.h,
      rotation: (comp.rotation ?? 0) + xf.rotation,
      flipX: ((comp.flipX ? 1 : 0) + xf.flipX) > 0.5,
      flipY: ((comp.flipY ? 1 : 0) + xf.flipY) > 0.5,
    })
  }

  return { success: true, interpolatedComponents: result }
}
