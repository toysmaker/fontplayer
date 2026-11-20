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

import type { IAnimationClip, ICharacterFileLite, IComponent, ICustomGlyph, IGlyphComponent } from '@/core/types'
import type { IContour } from '@/core/font/types'
import { PathType } from '@/core/font/types'
import { ContourConverter } from '@/core/font/converter'
import { hexToRgb } from './sdf'

/** 解析组件填充色 → [r, g, b, a]（支持 #rgb/#rrggbb/#rrggbbaa 与 rgba()/rgb()；透明色不再回退黑色） */
function parseColorToRgba(color: string): [number, number, number, number] {
  const s = (color || '#000').trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    if (full.length === 6) {
      const num = parseInt(full, 16)
      if (!Number.isNaN(num)) return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff, 255]
    }
    if (full.length === 8) {
      const num = parseInt(full, 16)
      if (!Number.isNaN(num)) return [(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
    }
    return [0, 0, 0, 255]
  }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (m) {
    return [
      parseInt(m[1]),
      parseInt(m[2]),
      parseInt(m[3]),
      Math.round((m[4] !== undefined ? parseFloat(m[4]) : 1) * 255),
    ]
  }
  return [0, 0, 0, 255]
}
import { useProjectStore } from '@/stores/project'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { fontRenderStyle } from '@/core/script/globals'
import {
  applyKeyframeParamsToCharacter,
  characterGlyphComponents,
  characterOrderedComponents,
  characterLayoutGrid,
  componentFillColor,
  createBakeClone,
  executeAllGlyphScriptsOnClone,
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
  // 单关键帧片段：无前后关键帧可交叉淡化，恒显即可
  if (keyframes.length === 1) return [{ t: fk, s: [100] }]
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

  // comp|k -> 形状数组（每轮廓一个 {c,v,i,o}）；null = 隐藏或无轮廓
  const shapeMap = new Map<string, Array<{ c: boolean; v: number[][]; i: number[][]; o: number[][] }> | null>()

  const totalWork = Math.max(1, kfs.length)
  let done = 0

  // 叶子信息：key（稳定身份）→ 组件 + 填充色；各关键帧按同一 key 对齐
  interface FlatLeaf {
    key: string
    comp: IComponent
    fill: string
    /** 累积的父字形 ox/oy 偏移（编辑坐标定位） */
    ox: number
    oy: number
  }
  const leafFills = new Map<string, string>()
  // 每关键帧的叶子出现顺序（用于确定最终图层 z 序）
  const kfKeyOrders: string[][] = []

  for (let k = 0; k < kfs.length; k++) {
    const kf = kfs[k]
    // 每个关键帧一次烘焙克隆（rekey 隔离 + 常量注入），结束即释放
    const session = createBakeClone(char)
    try {
      applyKeyframeParamsToCharacter(session.clone, kf, undefined, session.uuidMap)
      const hasCharAnim = kf.charParams && Object.keys(kf.charParams).length > 0
      session.runCharacterScript(hasCharAnim)
      // 执行字形脚本：生成子组件与颜色（脚本型字形的轮廓/颜色在运行时才有）
      executeAllGlyphScriptsOnClone(session.clone)

      // 从克隆展平叶子组件（脚本生成的子组件按名字对齐各关键帧）
      const leaves = new Map<string, FlatLeaf>()
      const nameCount = new Map<string, number>()
      const kfKeyOrder: string[] = []
      const seenInKf = new Set<string>()
      const flattenClone = (components: IComponent[], parentFill?: string, ox = 0, oy = 0, scope = '') => {
        for (const top of components) {
          if (top.type === 'glyph') {
            // 与转换器编辑路径一致：执行字形脚本后取实例的 components
            // （= 字形自身组件 + 脚本生成组件，脚本型字形只有后者）
            const glyphValue = top.value as ICustomGlyph | undefined
            if (glyphValue) {
              try {
                executeGlyphScript(glyphValue, top.uuid)
              } catch (err) {
                if (import.meta.env.DEV) {
                  console.warn('[lottieExporter] glyph script failed:', top.uuid, err)
                }
              }
            }
            const instance = instanceManager.acquireTemporaryInstance(
              top.uuid,
              () => new CustomGlyph(glyphValue as ICustomGlyph),
              'glyph',
            ) as unknown as { components?: IComponent[] } | null
            const subs = ((instance?.components ?? glyphValue?.components ?? []) as IComponent[]).filter(
              (c) => c != null,
            )
            const fill =
              (top as { fillColor?: string }).fillColor ||
              ((top as { value?: { fillColor?: string } }).value?.fillColor) ||
              parentFill
            // 字形组件定位只用 ox/oy（不含 x/y）
            const gx = (top as IGlyphComponent).ox ?? 0
            const gy = (top as IGlyphComponent).oy ?? 0
            // 身份作用域 = 祖先字形名链（名字跨关键帧/脚本重生成稳定）
            const gName =
              (top as { name?: string }).name ||
              ((glyphValue as { name?: string } | undefined)?.name) ||
              top.uuid
            const childScope = scope ? `${scope}/${gName}` : gName
            flattenClone(subs, fill, ox + gx, oy + gy, childScope)
            continue
          }
          // 叶子身份：字形作用域内的类型+域内序号（全局序号在叶子数变化时会跨字形串位，
          // 导致关键帧间错配、组件"漂移"）
          const leafScope = scope || 'root'
          const name = `${leafScope}::${top.type}`
          const n = (nameCount.get(name) ?? 0) + 1
          nameCount.set(name, n)
          const key = n > 1 ? `${name}#${n}` : name
          const fill =
            (top as { fillColor?: string }).fillColor ||
            ((top as { value?: { fillColor?: string } }).value?.fillColor) ||
            parentFill ||
            '#000'
          leaves.set(key, { key, comp: top, fill, ox, oy })
          if (!leafFills.has(key)) leafFills.set(key, fill)
          if (!seenInKf.has(key)) {
            seenInKf.add(key)
            kfKeyOrder.push(key)
          }
        }
      }
      // 字符级 z 序与应用渲染一致：按 orderedList（characterOrderedComponents），
      // 而非 components 原始数组顺序
      flattenClone(characterOrderedComponents(session.clone))
      kfKeyOrders.push(kfKeyOrder)

      for (const [key, leaf] of leaves) {
        // 整字符隐藏 → 无形状
        if (kf.hidden) {
          shapeMap.set(`${key}|${k}`, null)
          continue
        }
        const contours = withKeyframeConstantsMap(kf.constants, () =>
          ContourConverter.componentsToContoursEditing([leaf.comp], { x: leaf.ox, y: leaf.oy }),
        )
        const shapes: Array<{ c: boolean; v: number[][]; i: number[][]; o: number[][] }> = []
        for (const contour of contours) {
          const shape = contourToShapePoints(contour, metrics)
          if (shape) shapes.push(shape)
        }
        shapeMap.set(`${key}|${k}`, shapes.length > 0 ? shapes : null)
      }
    } finally {
      session.release()
    }
    done++
    onProgress?.(done, totalWork)
  }

  // 图层 z 序：取叶子数最多的关键帧的展平顺序为规范（= 应用在该帧的绘制顺序：
  // 字形内先画者在下）。「绽放」类动画首帧只有内层花瓣，若按首见顺序排，
  // 内层会沉到底层被后出现的外层花瓣盖住。
  let canonOrder = kfKeyOrders[0] ?? []
  for (const seq of kfKeyOrders) {
    if (seq.length > canonOrder.length) canonOrder = seq
  }
  const inCanon = new Set(canonOrder)
  const leafOrder = [...canonOrder]
  for (const seq of kfKeyOrders) {
    for (const key of seq) {
      if (!inCanon.has(key)) {
        inCanon.add(key)
        leafOrder.push(key)
      }
    }
  }

  // 组装图层：连续关键帧轮廓顶点数一一匹配 → 单个形变组（路径关键帧插值）；
  // 顶点数变化（拓扑变化）→ 交叉淡化回退；样式按轮廓/黑白/彩色填充或描边
  type Shape = { c: boolean; v: number[][]; i: number[][]; o: number[][] }
  const layers: unknown[] = []
  for (const key of leafOrder) {
    const layerName = key
    // 叶子填充色（首帧展平时记录；支持透明色 rgba/8 位 hex）
    const [fr, fg, fb, fa] = parseColorToRgba(leafFills.get(key) ?? '#000')
    const shapeAt = (k: number): Shape[] | null => shapeMap.get(`${key}|${k}`) ?? null

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
        : { ty: 'fl', c: { a: 0, k: [fr / 255, fg / 255, fb / 255, fa / 255] }, o: { a: 0, k: 100 }, r: 1 }

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
    // 组件数组顺序即 z 序（下标小者在底层）；参考播放器按数组顺序绘制（后绘者在上），
    // 因此保持原始顺序即可——背景组件在数组前部 = 最底层（此前 reverse 导致背景盖住前景）
    layers,
  }
  return JSON.stringify(json)
}
