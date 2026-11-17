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
import { useProjectStore } from '@/stores/project'
import { fontRenderStyle } from '@/core/script/globals'
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

function contourToShapePoints(contour: IContour, metrics: SdfMetrics) {
  const n = contour.length
  if (n === 0) return null
  const v: number[][] = []
  const ins: number[][] = []
  const outs: number[][] = []
  // 原始坐标即画布 y-down 坐标，与 lottie 一致，直接使用
  const pts = (p: { x: number; y: number }): number[] => [round2(p.x), round2(p.y)]
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
  if (index === keyframes.length - 1) {
    const prev = keyframes[index - 1]
    const fPrev = f(prev.time)
    const midPrev = Math.round((fPrev + fk) / 2)
    return [
      { t: fPrev, s: [0] },
      { t: midPrev, s: [100] },
      { t: fk, s: [100] },
    ]
  }

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

/**
 * 组件轮廓：使用编辑时原始坐标（componentsToContoursEditing 仅做几何变换，
 * 不做 formatPoints / unitsPerEm 等字库坐标转换）。
 * 原始坐标与 lottie 同为 y-down，导出后无需翻转。
 */
function componentContours(comp: IGlyphComponent): IContour[] {
  return ContourConverter.componentsToContoursEditing([comp], { x: 0, y: 0 })
}

export interface LottieExportOptions {
  clip: IAnimationClip
  char: ICharacterFileLite
  metrics: SdfMetrics
  /** 渲染样式（轮廓/黑白/彩色），默认跟随编辑页面 fontRenderStyle */
  style?: 'contour' | 'black' | 'color'
  onProgress?: (done: number, total: number) => void
}

/**
 * 生成 Lottie JSON（字符串）。
 * 分辨率为 unitsPerEm × unitsPerEm。
 */
export function buildLottieJson(opts: LottieExportOptions): string {
  const { clip, char, metrics, onProgress } = opts
  const style = opts.style ?? (fontRenderStyle.value as 'contour' | 'black' | 'color')
  const fps = clip.fps || 30
  const file = useProjectStore().selectedFile
  // 画布尺寸与编辑画布逻辑尺寸一致（file.width × file.height），避免笔画越界被裁切
  const canvasW = file?.width || metrics.advanceWidth || metrics.unitsPerEm
  const canvasH = file?.height || metrics.unitsPerEm
  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
  const firstTime = kfs.length > 0 ? kfs[0].time : 0
  const lastTime = kfs.length > 0 ? kfs[kfs.length - 1].time : 0
  const totalFrames = Math.max(1, Math.round((lastTime - firstTime) * fps))

  const comps = characterGlyphComponents(char).filter((gc) => {
    const g = gc.value as ICustomGlyph | undefined
    return !!g && typeof g === 'object'
  })
  // comp|k -> 形状数组（每轮廓一个 {c,v,i,o}）；null = 隐藏或无轮廓
  const shapeMap = new Map<string, Array<{ c: boolean; v: number[][]; i: number[][]; o: number[][] }> | null>()

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
          shapeMap.set(`${comp.uuid}|${k}`, null)
          continue
        }
        const clonedComp = (session.clone.components || []).find(
          (c) => c.uuid === session.uuidMap.get(comp.uuid),
        ) as IGlyphComponent | undefined
        if (!clonedComp) {
          shapeMap.set(`${comp.uuid}|${k}`, null)
          continue
        }
        const contours = withKeyframeConstantsMap(kf.constants, () =>
          componentContours(clonedComp),
        )
        const shapes: Array<{ c: boolean; v: number[][]; i: number[][]; o: number[][] }> = []
        for (const contour of contours) {
          const shape = contourToShapePoints(contour, metrics)
          if (shape) shapes.push(shape)
        }
        shapeMap.set(`${comp.uuid}|${k}`, shapes.length > 0 ? shapes : null)
      }
    } finally {
      session.release()
    }
    done++
    onProgress?.(done, totalWork)
  }

  // 组装图层：连续关键帧轮廓顶点数一一匹配 → 单个形变组（路径关键帧插值）；
  // 顶点数变化（拓扑变化）→ 交叉淡化回退；样式按轮廓/黑白/彩色填充或描边
  type Shape = { c: boolean; v: number[][]; i: number[][]; o: number[][] }
  const layers: unknown[] = []
  for (const comp of comps) {
    const glyph = comp.value as ICustomGlyph
    const layerName = (comp as { name?: string }).name || glyph.name || 'stroke'
    // 分色与编辑页面一致（comp.fillColor → value.fillColor → '#000'）
    const [fr, fg, fb] = hexToRgb(componentFillColor(comp))
    const shapeAt = (k: number): Shape[] | null => shapeMap.get(`${comp.uuid}|${k}`) ?? null

    // 连续形变段
    const runs: Array<{ start: number; end: number }> = []
    let runStart = -1
    let runShapes: Shape[] | null = null
    const shapesMatch = (a: Shape[] | null, b: Shape[] | null) =>
      !!a && !!b && a.length === b.length && a.every((sa, i) => sa.v.length === b[i].v.length)
    for (let k = 0; k < kfs.length; k++) {
      const shapes = shapeAt(k)
      if (runStart < 0) {
        if (shapes) {
          runStart = k
          runShapes = shapes
        }
        continue
      }
      if (shapesMatch(runShapes, shapes)) {
        runShapes = shapes
        continue
      }
      runs.push({ start: runStart, end: k - 1 })
      runStart = shapes ? k : -1
      runShapes = shapes
    }
    if (runStart >= 0) runs.push({ start: runStart, end: kfs.length - 1 })

    const groups: unknown[] = []
    const baseTr = {
      ty: 'tr',
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      sk: { a: 0, k: 0 },
      sa: { a: 0, k: 0 },
    }
    const styleItem = () =>
      style === 'contour'
        ? // 轮廓：纯描边（宽度与编辑界面一致：getStrokeWidth 20px@2000 → 10 逻辑单位）
          { ty: 'st', c: { a: 0, k: [0, 0, 0, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 10 }, lc: 2, lj: 2 }
        : { ty: 'fl', c: { a: 0, k: [fr / 255, fg / 255, fb / 255, 1] }, o: { a: 0, k: 100 }, r: 1 }

    for (const run of runs) {
      if (run.start === run.end) {
        // 单关键帧：交叉淡化组（与相邻段淡入淡出）
        const k = run.start
        const shapes = shapeAt(k)
        if (!shapes || shapes.length === 0) continue
        const items: unknown[] = shapes.map((sh) => ({ ty: 'sh', ks: { a: 0, k: sh } }))
        items.push(styleItem())
        items.push(baseTr)
        groups.push({
          ty: 'gr',
          nm: `${layerName}#${k}`,
          o: { a: 1, k: opacityKeyframes(k, kfs, firstTime, fps) },
          it: items,
        })
        continue
      }
      // 形变组：路径关键帧线性插值（顶点数匹配）
      const items: unknown[] = []
      const firstShapes = shapeAt(run.start)!
      for (let si = 0; si < firstShapes.length; si++) {
        const pathKf: unknown[] = []
        for (let k = run.start; k <= run.end; k++) {
          const shapes = shapeAt(k)!
          pathKf.push({ t: Math.round((kfs[k].time - firstTime) * fps), s: [shapes[si]] })
        }
        items.push({ ty: 'sh', ks: { a: 1, k: pathKf } })
      }
      items.push(styleItem())
      items.push(baseTr)
      // 组透明度包络：从上一关键帧中点淡入、到下一关键帧中点淡出（仅边界交叉淡化）
      const frames: Array<{ t: number; s: number[] }> = []
      const f = (t: number) => Math.round((t - firstTime) * fps)
      if (run.start > 0) {
        const fPrev = f(kfs[run.start - 1].time)
        const fFirst = f(kfs[run.start].time)
        frames.push({ t: fPrev, s: [0] }, { t: Math.round((fPrev + fFirst) / 2), s: [100] })
      } else {
        frames.push({ t: f(kfs[run.start].time), s: [100] })
      }
      if (run.end < kfs.length - 1) {
        const fLast = f(kfs[run.end].time)
        const fNext = f(kfs[run.end + 1].time)
        frames.push({ t: Math.round((fLast + fNext) / 2), s: [100] }, { t: fNext, s: [0] })
      } else {
        frames.push({ t: f(kfs[run.end].time), s: [100] })
      }
      groups.push({
        ty: 'gr',
        nm: `${layerName}#${run.start}-${run.end}`,
        o: { a: 1, k: frames },
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
    w: canvasW,
    h: canvasH,
    nm: clip.name,
    ddd: 0,
    assets: [],
    layers: layers.reverse(), // lottie 层级自下而上
  }
  return JSON.stringify(json)
}
