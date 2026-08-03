/**
 * 参数提取算法
 *
 * 将分类后的笔画折线转换为参数 + 关键点格式。
 * 参数计算公式与各 kai 模板的 computeParamsByJoints 保持一致。
 */

import { distance, distanceAndFootPoint, Vec2 } from '@/utils/polyline'
import type { ICharacterSkeletonStroke, ISkeletonJoint } from '@/core/types'

/**
 * 笔画模型定义：关键点名称、参数提取方式
 */
interface StrokeModel {
  /** 关键点名称列表 */
  jointKeys: string[]
  /** 从关键点计算参数 */
  computeParams: (joints: Record<string, Vec2>) => Record<string, number>
}

/** 默认参数 */
const DEFAULT_PARAMS = {
  skeletonRefPos: 0,
  weight: 40,
}

/**
 * 从折线拟合关键点并提取参数
 *
 * @param name 笔画名称
 * @param polyline 合并后的完整折线
 * @param cornerPoints 简化后的关键转折点
 * @returns 笔画骨架数据
 */
export function extractStrokeParams(
  name: string,
  polyline: Vec2[],
  cornerPoints: Vec2[],
): ICharacterSkeletonStroke {
  if (cornerPoints.length < 2) {
    return {
      name: '未识别',
      params: { horizontalSpan: 0, verticalSpan: 0 },
      joints: {},
      ox: 0, oy: 0,
    }
  }
  // 根据笔画类型选择不同的关键点提取策略
  const joints = fitJoints(name, polyline, cornerPoints)
  // 确保所有关节坐标有效
  for (const key of Object.keys(joints)) {
    const v = joints[key]
    if (!v || v.x == null || v.y == null) {
      joints[key] = cornerPoints[0] || { x: 0, y: 0 }
    }
  }
  if (Object.keys(joints).length === 0) {
    joints.start = cornerPoints[0]
    joints.end = cornerPoints[cornerPoints.length - 1]
  }
  const params = computeParamsByName(name, joints)

  return {
    name,
    params,
    joints: jointsToRecord(joints),
    ox: 0,
    oy: 0,
  }
}

/**
 * 根据笔画类型拟合关键点
 */
function fitJoints(
  name: string,
  polyline: Vec2[],
  corners: Vec2[],
): Record<string, Vec2> {
  const n = corners.length

  switch (name) {
    // ===== 2关节笔画 =====
    case '横':
    case '竖':
      return {
        start: corners[0],
        end: corners[n - 1],
      }

    // ===== 3关节笔画（带弯曲） =====
    case '撇':
    case '捺':
    case '点':
    case '挑':
    case '平捺':
    case '弯钩':
    case '斜钩':
      return fitThreeJoint(polyline, corners)

    // ===== 4关节笔画（单折） =====
    case '横折':
    case '竖折':
    case '横钩':
    case '竖钩':
    case '竖挑':
    case '竖弯':
      return fitSingleBend(name, polyline, corners)

    // ===== 5+关节笔画（多折） =====
    case '横撇':
    case '竖撇':
      return fitHengPieOrShuPie(name, corners)
    case '横折2':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe_start', 'zhe_end'], corners)
    case '横折钩':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe_start', 'zhe_end', 'gou_start', 'gou_end'], corners)
    case '横折弯':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe_start', 'zhe_end', 'wan_start', 'wan_end'], corners)
    case '横折挑':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe_start', 'zhe_end', 'tiao_start', 'tiao_end'], corners)
    case '竖弯钩':
      return fitMultiBendSequential(['shu_start', 'shu_end', 'wan_start', 'wan_end', 'gou_start', 'gou_end'], corners)
    case '横弯钩':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'wan_start', 'wan_end', 'gou_start', 'gou_end'], corners)
    case '横折弯钩':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe_start', 'zhe_end', 'wan_start', 'wan_end', 'gou_start', 'gou_end'], corners)
    case '二横折':
      return fitMultiBendSequential(['heng1_start', 'heng1_end', 'zhe1_start', 'zhe1_end', 'heng2_start', 'heng2_end', 'zhe2_start', 'zhe2_end'], corners)
    case '横折折撇':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe1_start', 'zhe1_end', 'zhe2_start', 'zhe2_end', 'pie_start', 'pie_end'], corners)
    case '横撇弯钩':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'pie_start', 'pie_end', 'wangou_start', 'wangou_end'], corners)
    case '竖折折钩':
      return fitMultiBendSequential(['shu_start', 'shu_end', 'zhe1_start', 'zhe1_end', 'zhe2_start', 'zhe2_end', 'gou_start', 'gou_end'], corners)
    case '横折折弯钩':
      return fitMultiBendSequential(['heng_start', 'heng_end', 'zhe1_start', 'zhe1_end', 'zhe2_start', 'zhe2_end', 'wan_start', 'wan_end', 'gou_start', 'gou_end'], corners)
    case '撇挑':
      return fitMultiBendSequential(['pie_start', 'pie_end', 'tiao_start', 'tiao_end'], corners)
    case '撇点':
      return fitMultiBendSequential(['pie_start', 'pie_end', 'dian_start', 'dian_end'], corners)
    case '挑捺':
      return fitMultiBendSequential(['tiao_start', 'tiao_end', 'na_start', 'na_end'], corners)

    // ===== 未识别 =====
    default:
      return fitGeneric(name, polyline, corners)
  }
}

/** 拟合3关节笔画（start, bend, end） */
function fitThreeJoint(
  polyline: Vec2[],
  corners: Vec2[],
): Record<string, Vec2> {
  const start = corners[0]
  const end = corners[corners.length - 1]

  // 找离 start-end 连线最远的点作为 bend
  let maxDist = 0
  let bend = corners[1] || corners[0]
  for (const pt of polyline) {
    const d = pointToLineDist(pt, start, end)
    if (d > maxDist) {
      maxDist = d
      bend = pt
    }
  }

  return { start, bend, end }
}

/** 点到线段的垂直距离 */
function pointToLineDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  if (t < 0) return Math.hypot(p.x - a.x, p.y - a.y)
  if (t > 1) return Math.hypot(p.x - b.x, p.y - b.y)
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY)
}

/** 拟合单折笔画 */
function fitSingleBend(
  name: string,
  _polyline: Vec2[],
  corners: Vec2[],
): Record<string, Vec2> {
  // 获取笔画段前缀
  let prefix = ''
  if (name.startsWith('横')) prefix = 'heng'
  else if (name.startsWith('竖')) prefix = 'shu'

  if (name === '横折' || name === '竖折') {
    return {
      [`${prefix}_start`]: corners[0],
      [`${prefix}_end`]: corners[1],
      [name.startsWith('横') ? 'zhe_start' : 'zhe_start']: corners[1],
      [name.startsWith('横') ? 'zhe_end' : 'zhe_end']: corners[corners.length - 1],
    }
  }

  if (name === '横钩' || name === '竖钩') {
    const hookType = name.startsWith('横') ? 'gou' : 'gou'
    return {
      [`${prefix}_start`]: corners[0],
      [`${prefix}_end`]: corners[1],
      [`${hookType}_start`]: corners[1],
      [`${hookType}_end`]: corners[corners.length - 1],
    }
  }

  // 竖挑、竖弯
  if (name === '竖挑') {
    return {
      shu_start: corners[0],
      shu_end: corners[1],
      tiao_start: corners[1],
      tiao_end: corners[corners.length - 1],
    }
  }
  if (name === '竖弯') {
    return {
      shu_start: corners[0],
      shu_end: corners[1],
      wan_start: corners[1],
      wan_end: corners[corners.length - 1],
    }
  }

  return { start: corners[0], end: corners[corners.length - 1] }
}

/** 拟合横撇/竖撇 */
function fitHengPieOrShuPie(
  name: string,
  corners: Vec2[],
): Record<string, Vec2> {
  if (name === '横撇') {
    return {
      heng_start: corners[0],
      heng_end: corners[1],
      pie_start: corners[1],
      pie_end: corners[corners.length - 1],
    }
  }
  return {
    shu_start: corners[0],
    shu_end: corners[1],
    pie_start: corners[1],
    pie_end: corners[corners.length - 1],
  }
}

/** 多段笔画按顺序分配关键点 */
function fitMultiBendSequential(
  keys: string[],
  corners: Vec2[],
): Record<string, Vec2> {
  const result: Record<string, Vec2> = {}

  // 将 corners 映射到 keys（相邻段共享端点）
  // 例如 keys = ['heng_start','heng_end','zhe_start','zhe_end']
  // corners = [p0, p1, p2] → heng_start=p0, heng_end=p1, zhe_start=p1, zhe_end=p2
  let cornerIdx = 0
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key.endsWith('_start') && i > 0) {
      // _start 类型的关节通常与上一个 _end 共享同一点
      const prevKey = keys[i - 1]
      result[key] = result[prevKey]
        ? { ...result[prevKey] }
        : corners[Math.min(cornerIdx, corners.length - 1)]
    } else {
      result[key] = corners[Math.min(cornerIdx, corners.length - 1)]
      cornerIdx++
    }
  }

  return result
}

/** 通用拟合 */
function fitGeneric(
  _name: string,
  _polyline: Vec2[],
  corners: Vec2[],
): Record<string, Vec2> {
  return {
    start: corners[0],
    end: corners[corners.length - 1],
  }
}

/** 将 Vec2 map 转为 ISkeletonJoint record */
function jointsToRecord(joints: Record<string, Vec2>): Record<string, ISkeletonJoint> {
  const result: Record<string, ISkeletonJoint> = {}
  for (const [key, val] of Object.entries(joints)) {
    result[key] = { x: Math.round(val.x * 100) / 100, y: Math.round(val.y * 100) / 100 }
  }
  return result
}

// ============================================================
// 参数计算（与各模板 computeParamsByJoints 保持一致）
// ============================================================

/**
 * 根据笔画名和关键点计算参数
 */
function computeParamsByName(
  name: string,
  joints: Record<string, Vec2>,
): Record<string, number> {
  const keys = Object.keys(joints)
  if (keys.length < 2) return { horizontalSpan: 0, verticalSpan: 0, ...DEFAULT_PARAMS }

  switch (name) {
    case '横': return computeHengParams(joints)
    case '竖': return computeShuParams(joints)
    case '撇': return computePieParams(joints)
    case '捺': return computeNaParams(joints)
    case '点': return computeDianParams(joints)
    case '挑': return computeTiaoParams(joints)
    case '平捺': return computePingNaParams(joints)
    case '横折': return computeHengZheParams(joints)
    case '竖折': return computeShuZheParams(joints)
    case '横钩': return computeHengGouParams(joints)
    case '竖钩': return computeShuGouParams(joints)
    case '横撇': return computeHengPieParams(joints)
    case '竖撇': return computeShuPieParams(joints)
    case '竖挑': return computeShuTiaoParams(joints)
    case '竖弯': return computeShuWanParams(joints)
    default:
      return computeGenericParams(joints)
  }
}

/** 安全取值 */
function j(joints: Record<string, Vec2>, key: string): Vec2 {
  return joints[key] || { x: 0, y: 0 }
}

/** 横参数 */
function computeHengParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end')
  return {
    horizontalSpan: Math.abs(e.x - s.x),
    verticalSpan: Math.abs(s.y - e.y),
    ...DEFAULT_PARAMS,
  }
}
function computeShuParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end')
  return { horizontalSpan: Math.abs(e.x - s.x), verticalSpan: Math.abs(e.y - s.y), ...DEFAULT_PARAMS }
}
function computePieParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end'), b = j(jts, 'bend')
  const { percentageFromA, distance: dist } = distanceAndFootPoint(s, e, b)
  return { horizontalSpan: Math.abs(s.x - e.x), verticalSpan: Math.abs(e.y - s.y), bendCursor: percentageFromA, bendDegree: dist, ...DEFAULT_PARAMS }
}
function computeNaParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end'), b = j(jts, 'bend')
  const { percentageFromA, distance: dist } = distanceAndFootPoint(s, e, b)
  return { horizontalSpan: Math.abs(e.x - s.x), verticalSpan: Math.abs(e.y - s.y), bendCursor: percentageFromA, bendDegree: dist, ...DEFAULT_PARAMS }
}
function computeDianParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end'), b = j(jts, 'bend')
  const { percentageFromA, distance: dist } = distanceAndFootPoint(s, e, b)
  return { horizontalSpan: Math.abs(e.x - s.x), verticalSpan: Math.abs(e.y - s.y), bendCursor: percentageFromA, bendDegree: dist, ...DEFAULT_PARAMS }
}
function computeTiaoParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end'), b = j(jts, 'bend')
  const { percentageFromA, distance: dist } = distanceAndFootPoint(s, e, b)
  return { horizontalSpan: Math.abs(e.x - s.x), verticalSpan: Math.abs(s.y - e.y), bendCursor: percentageFromA, bendDegree: dist, ...DEFAULT_PARAMS }
}
function computePingNaParams(jts: Record<string, Vec2>): Record<string, number> {
  const s = j(jts, 'start'), e = j(jts, 'end'), b = j(jts, 'bend')
  const { percentageFromA, distance: dist } = distanceAndFootPoint(s, e, b)
  return { horizontalSpan: Math.abs(e.x - s.x), verticalSpan: Math.abs(e.y - s.y), bendCursor: percentageFromA, bendDegree: dist, ...DEFAULT_PARAMS }
}

/** 横折参数 */
function computeHengZheParams(jts: Record<string, Vec2>): Record<string, number> {
  const hs = j(jts, 'heng_start'), he = j(jts, 'heng_end')
  const zs = j(jts, 'zhe_start'), ze = j(jts, 'zhe_end')
  return { '横-水平延伸': Math.abs(he.x - hs.x), '横-竖直延伸': Math.abs(hs.y - he.y), '折-水平延伸': Math.abs(ze.x - zs.x), '折-竖直延伸': Math.abs(ze.y - zs.y), ...DEFAULT_PARAMS }
}
function computeShuZheParams(jts: Record<string, Vec2>): Record<string, number> {
  const ss = j(jts, 'shu_start'), se = j(jts, 'shu_end')
  const zs = j(jts, 'zhe_start'), ze = j(jts, 'zhe_end')
  return { '竖-水平延伸': Math.abs(se.x - ss.x), '竖-竖直延伸': Math.abs(se.y - ss.y), '折-水平延伸': Math.abs(ze.x - zs.x), '折-竖直延伸': Math.abs(ze.y - zs.y), ...DEFAULT_PARAMS }
}
function computeHengGouParams(jts: Record<string, Vec2>): Record<string, number> {
  const hs = j(jts, 'heng_start'), he = j(jts, 'heng_end')
  const gs = j(jts, 'gou_start'), ge = j(jts, 'gou_end')
  return { '横-水平延伸': Math.abs(he.x - hs.x), '横-竖直延伸': Math.abs(hs.y - he.y), '钩-水平延伸': Math.abs(ge.x - gs.x), '钩-竖直延伸': Math.abs(ge.y - gs.y), ...DEFAULT_PARAMS }
}
function computeShuGouParams(jts: Record<string, Vec2>): Record<string, number> {
  const ss = j(jts, 'shu_start'), se = j(jts, 'shu_end')
  const gs = j(jts, 'gou_start'), ge = j(jts, 'gou_end')
  return { '竖-水平延伸': Math.abs(se.x - ss.x), '竖-竖直延伸': Math.abs(se.y - ss.y), '钩-水平延伸': Math.abs(ge.x - gs.x), '钩-竖直延伸': Math.abs(ge.y - gs.y), ...DEFAULT_PARAMS }
}
function computeHengPieParams(jts: Record<string, Vec2>): Record<string, number> {
  const hs = j(jts, 'heng_start'), he = j(jts, 'heng_end')
  const ps = j(jts, 'pie_start'), pe = j(jts, 'pie_end')
  return { '横-水平延伸': Math.abs(he.x - hs.x), '横-竖直延伸': Math.abs(hs.y - he.y), '撇-水平延伸': Math.abs(ps.x - pe.x), '撇-竖直延伸': Math.abs(pe.y - ps.y), ...DEFAULT_PARAMS }
}
function computeShuPieParams(jts: Record<string, Vec2>): Record<string, number> {
  const ss = j(jts, 'shu_start'), se = j(jts, 'shu_end')
  const ps = j(jts, 'pie_start'), pe = j(jts, 'pie_end')
  return { '竖-长度': Math.abs(se.y - ss.y), '撇-水平延伸': Math.abs(ps.x - pe.x), '撇-竖直延伸': Math.abs(pe.y - ps.y), ...DEFAULT_PARAMS }
}
function computeShuTiaoParams(jts: Record<string, Vec2>): Record<string, number> {
  const ss = j(jts, 'shu_start'), se = j(jts, 'shu_end')
  const ts = j(jts, 'tiao_start'), te = j(jts, 'tiao_end')
  return { '竖-水平延伸': Math.abs(se.x - ss.x), '竖-竖直延伸': Math.abs(se.y - ss.y), '挑-水平延伸': Math.abs(te.x - ts.x), '挑-竖直延伸': Math.abs(ts.y - te.y), ...DEFAULT_PARAMS }
}
function computeShuWanParams(jts: Record<string, Vec2>): Record<string, number> {
  const ss = j(jts, 'shu_start'), se = j(jts, 'shu_end')
  const ws = j(jts, 'wan_start'), we = j(jts, 'wan_end')
  return { '竖-水平延伸': Math.abs(se.x - ss.x), '竖-竖直延伸': Math.abs(se.y - ss.y), '弯-长度': Math.abs(we.x - ws.x), ...DEFAULT_PARAMS }
}
function computeGenericParams(jts: Record<string, Vec2>): Record<string, number> {
  const keys = Object.keys(jts).filter(k => jts[k] != null && jts[k].x != null)
  if (keys.length >= 2) {
    const s = jts[keys[0]]!, e = jts[keys[keys.length - 1]]!
    return { horizontalSpan: Math.abs(e.x - s.x), verticalSpan: Math.abs(e.y - s.y), ...DEFAULT_PARAMS }
  }
  return { horizontalSpan: 0, verticalSpan: 0, ...DEFAULT_PARAMS }
}
