/**
 * Lottie JSON 导出器
 *
 * 每个字形组件一个图层；图层内每个关键帧一组形状（拓扑可任意变化），
 * 组与组之间按关键帧区间做透明度交叉淡化（前半段淡入、后半段淡出），
 * hidden 关键帧的组恒为透明，从而支持淡入淡出效果。
 * 坐标：em → px（y 轴翻转）。
 *
 * 实例隔离与内存管理：
 * - 关键帧外层循环：每个关键帧创建一次烘焙克隆（组件 rekey + 字符参数/脚本 + 常量注入），
 *   提取全部组件轮廓后立即释放全部临时实例，不缓存任何轮廓/SDF
 */

import type { IAnimationClip, ICharacterFileLite, ICustomGlyph, IGlyphComponent } from '@/core/types'
import type { IContour } from '@/core/font/types'
import { PathType } from '@/core/font/types'
import { ContourConverter } from '@/core/font/converter'
import { hexToRgb } from './sdf'
import {
  applyKeyframeParamsToCharacter,
  characterGlyphComponents,
  characterLayoutGrid,
  componentFillColor,
  createBakeClone,
  withKeyframeConstantsMap,
  type SdfMetrics,
} from './render'

const round2 = (v: number) => Math.round(v * 100) / 100

function contourToShapePoints(contour: IContour, height: number) {
  const n = contour.length
  if (n === 0) return null
  const v: number[][] = []
  const ins: number[][] = []
  const outs: number[][] = []
  const pts = (p: { x: number; y: number }): number[] => [round2(p.x), round2(height - p.y)]
  const rel = (a: { x: number; y: number }, b: { x: number; y: number }): number[] => [
    round2(a.x - b.x),
    round2(a.y - b.y),
  ]

  for (let j = 0; j < n; j++) {
    const seg = contour[j]
    v.push(pts(seg.start))
    ins.push([0, 0])
    outs.push([0, 0])
  }
  for (let j = 0; j < n; j++) {
    const seg = contour[j]
    const next = (j + 1) % n
    if (seg.type === PathType.LINE) {
      // 直线：切向量为 0
    } else if (seg.type === PathType.QUADRATIC_BEZIER) {
      // 二次贝塞尔转三次：cp1 = start + 2/3(control-start), cp2 = end + 2/3(control-end)
      const cp1 = {
        x: seg.start.x + (2 / 3) * (seg.control.x - seg.start.x),
        y: seg.start.y + (2 / 3) * (seg.control.y - seg.start.y),
      }
      const cp2 = {
        x: seg.end.x + (2 / 3) * (seg.control.x - seg.end.x),
        y: seg.end.y + (2 / 3) * (seg.control.y - seg.end.y),
      }
      outs[j] = rel(cp1, seg.start)
      ins[next] = rel(cp2, seg.end)
    } else if (seg.type === PathType.CUBIC_BEZIER) {
      outs[j] = rel(seg.control1, seg.start)
      ins[next] = rel(seg.control2, seg.end)
    }
  }
  return { c: true, v, i: ins, o: outs }
}

/** 组透明度关键帧（帧号；与相邻关键帧交叉淡化） */
function opacityKeyframes(
  index: number,
  keyframes: Array<{ id: string; time: number; hidden: boolean }>,
  firstTime: number,
  fps: number,
): Array<{ t: number; s: number[] }> {
  const kf = keyframes[index]
  const f = (t: number) => Math.round((t - firstTime) * fps)
  const fk = f(kf.time)
  if (kf.hidden) return [{ t: fk, s: [0] }]
  if (index === keyframes.length - 1) return [{ t: fk, s: [100] }]

  const next = keyframes[index + 1]
  const fNext = f(next.time)
  const mid = Math.round((fk + fNext) / 2)
  if (index === 0) {
    return [
      { t: fk, s: [100] },
      { t: mid, s: [100] },
      { t: fNext, s: [0] },
    ]
  }
  const prev = keyframes[index - 1]
  const fPrev = f(prev.time)
  const midPrev = Math.round((fPrev + fk) / 2)
  return [
    { t: fPrev, s: [0] },
    { t: midPrev, s: [100] },
    { t: mid, s: [100] },
    { t: fNext, s: [0] },
  ]
}

function componentContours(
  comp: IGlyphComponent,
  char: ICharacterFileLite,
  metrics: SdfMetrics,
): IContour[] {
  // 与编辑页面一致：组件定位走字符布局网格（grid + useSkeletonGrid）；
  // preview 必须为 false（em 单位原始数据，preview 轮廓是 0..100 百分比坐标）
  return ContourConverter.componentsToContours(
    [comp],
    {
      unitsPerEm: metrics.unitsPerEm,
      descender: metrics.descender,
      advanceWidth: metrics.advanceWidth,
      preview: false,
      forceUpdate: true,
      advancedEdit: true,
      grid: characterLayoutGrid(char),
      useSkeletonGrid: char.info?.useSkeletonGrid ?? false,
    },
    { x: 0, y: 0 },
  )
}

export interface LottieExportOptions {
  clip: IAnimationClip
  char: ICharacterFileLite
  metrics: SdfMetrics
  onProgress?: (done: number, total: number) => void
}

/**
 * 生成 Lottie JSON（字符串）。
 * 分辨率为 unitsPerEm × unitsPerEm。
 */
export function buildLottieJson(opts: LottieExportOptions): string {
  const { clip, char, metrics, onProgress } = opts
  const fps = clip.fps || 30
  const height = metrics.unitsPerEm
  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
  const firstTime = kfs.length > 0 ? kfs[0].time : 0
  const lastTime = kfs.length > 0 ? kfs[kfs.length - 1].time : 0
  const totalFrames = Math.max(1, Math.round((lastTime - firstTime) * fps))

  const comps = characterGlyphComponents(char).filter((gc) => {
    const g = gc.value as ICustomGlyph | undefined
    return !!g && typeof g === 'object'
  })
  // compIndex -> keyframeIndex -> shape items（null = 无轮廓或 hidden）
  const shapeMap = new Map<string, unknown[]>()

  const totalWork = Math.max(1, kfs.length)
  let done = 0

  for (let k = 0; k < kfs.length; k++) {
    const kf = kfs[k]
    // 每个关键帧一次烘焙克隆（rekey 隔离 + 常量注入），结束即释放
    const session = createBakeClone(char)
    try {
      applyKeyframeParamsToCharacter(session.clone, kf, undefined, session.uuidMap)
      const hasCharAnim = kf.charParams && Object.keys(kf.charParams).length > 0
      session.runCharacterScript(hasCharAnim)
      for (const comp of comps) {
        // 整字符隐藏或该组件在此关键帧被隐藏 → 无形状（透明度由组关键帧控制）
        const compHidden = kf.hidden || (kf.hiddenComponents ?? []).includes(comp.uuid)
        if (compHidden) {
          shapeMap.set(`${comp.uuid}|${k}`, [])
          continue
        }
        const clonedComp = (session.clone.components || []).find(
          (c) => c.uuid === session.uuidMap.get(comp.uuid),
        ) as IGlyphComponent | undefined
        if (!clonedComp) {
          shapeMap.set(`${comp.uuid}|${k}`, [])
          continue
        }
        const contours = withKeyframeConstantsMap(kf.constants, () =>
          componentContours(clonedComp, session.clone, metrics),
        )
        const items: unknown[] = []
        for (const contour of contours) {
          const shape = contourToShapePoints(contour, height)
          if (shape) items.push({ ty: 'sh', ks: { a: 0, k: shape } })
        }
        shapeMap.set(`${comp.uuid}|${k}`, items)
      }
    } finally {
      session.release()
    }
    done++
    onProgress?.(done, totalWork)
  }

  // 组装图层
  const layers: unknown[] = []
  for (const comp of comps) {
    const glyph = comp.value as ICustomGlyph
    const layerName = (comp as { name?: string }).name || glyph.name || 'stroke'
    // 分色与编辑页面一致（comp.fillColor → value.fillColor → '#000'）
    const [fr, fg, fb] = hexToRgb(componentFillColor(comp))
    const groups: unknown[] = []
    for (let k = 0; k < kfs.length; k++) {
      const items = shapeMap.get(`${comp.uuid}|${k}`) ?? []
      if (items.length === 0) continue
      items.push({ ty: 'fl', c: { a: 0, k: [fr / 255, fg / 255, fb / 255, 1] }, o: { a: 0, k: 100 }, r: 1 })
      items.push({
        ty: 'tr',
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
      })
      groups.push({
        ty: 'gr',
        nm: `${layerName}#${k}`,
        o: { a: 1, k: opacityKeyframes(k, kfs, firstTime, fps) },
        it: items,
      })
    }
    if (groups.length > 0) {
      layers.push({
        ty: 4,
        nm: layerName,
        ip: 0,
        op: totalFrames,
        st: 0,
        ind: layers.length + 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [0, 0, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        shapes: groups,
      })
    }
  }

  const json = {
    v: '5.7.4',
    fr: fps,
    ip: 0,
    op: totalFrames,
    w: metrics.advanceWidth || height,
    h: height,
    nm: clip.name,
    ddd: 0,
    assets: [],
    layers: layers.reverse(), // lottie 层级自下而上
  }
  return JSON.stringify(json)
}
