/**
 * digits 模板渲染验证工具
 *
 * 用真实 FPUtils + mock glyph 实例执行 public/templates/digits 下的数字脚本，
 * 将生成的 PenComponent 轮廓序列化为 SVG 写入临时目录，供人工/自动检查字形。
 * 同时验证核心等价性：「弯曲度 = 1 时的三次贝塞尔描述」与「原二次 bend 描述」
 * 经过 getCurveContours2 生成的轮廓必须完全一致。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { digits } from '@/templates/digits'
import { useProjectStore } from '@/stores/project'
import { ParameterType } from '@/core/types'

const PUBLIC_TEMPLATES = join(process.cwd(), 'public', 'templates')
const OUT_DIR = join(os.tmpdir(), 'fontplayer-digits-render')

let FP: any = null

beforeAll(async () => {
  setActivePinia(createPinia())
  // 与 fputils-cycle.test.ts 一致的加载顺序，避免循环依赖 TDZ
  await import('@/stores/character')
  const mod = await import('@/core/script/FPUtils')
  FP = mod.FP
  // 脚本与 FP 内部有大量 DEV 日志，静音
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** mock glyph 实例：覆盖 digits 脚本用到的全部 API */
function makeMockGlyph(params: Record<string, any>) {
  const components: any[] = []
  const joints: any[] = []
  const reflines: any[] = []
  const glyph: any = {
    uuid: 'test-digit',
    tempData: null,
    clear: () => {
      components.length = 0
      joints.length = 0
      reflines.length = 0
    },
    getParam: (name: string) => params[name],
    getParamRange: () => ({ min: 0, max: 1000 }),
    setParam: (name: string, v: any) => {
      params[name] = v
    },
    addComponent: (c: any) => {
      components.push(c)
    },
    addJoint: (j: any) => {
      joints.push(j)
    },
    addRefLine: (r: any) => {
      reflines.push(r)
    },
    getJoints: () => joints,
    getRefLines: () => reflines,
    _components: components,
  }
  return glyph
}

/** 从 digits.ts 的参数定义构建脚本参数表 */
function buildParams(digit: any, overrides: Record<string, any> = {}): Record<string, any> {
  const result: Record<string, any> = {}
  for (const p of digit.params) {
    result[p.name] = p.value ?? p.default
  }
  for (const p of digit.globalParams) {
    result[p.name] = p.value ?? p.default
  }
  return { ...result, ...overrides }
}

/** 用参数覆盖执行某个数字脚本（脚本体内不依赖 window 全局，全部走函数参数） */
function runDigitScript(name: string, params: Record<string, any>): { glyph: any; joints: any[]; reflines: any[] } {
  const script = readFileSync(join(PUBLIC_TEMPLATES, 'digits', `${name}.js`), 'utf8')
  const glyph = makeMockGlyph(params)
  const code = `function script_digit(glyph, constants, FP) {\n${script}\n}\nscript_digit(g, c, f)`
  new Function('g', 'c', 'f', code)(glyph, {}, FP)
  return { glyph, joints: glyph.getJoints(), reflines: glyph.getRefLines() }
}

/** 将 PenComponent 序列化为 SVG path d（每段都是 [control, control, anchor] 三元组） */
function penToPathData(pen: any): string {
  const pts = pen.points
  if (!pts || pts.length < 4) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].type === 'anchor') {
      const c1 = pts[i - 2]
      const c2 = pts[i - 1]
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${pts[i].x} ${pts[i].y}`
    }
  }
  if (pen.isClosed) d += ' Z'
  return d
}

/** 计算所有轮廓点的包围盒 */
function bboxOf(pens: any[], joints: any[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const consider = (x: number, y: number) => {
    if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) return
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  for (const pen of pens) {
    for (const p of pen.points || []) consider(p.x, p.y)
  }
  for (const j of joints) consider(j.x, j.y)
  return { minX, minY, maxX, maxY }
}

function buildSvg(name: string, pens: any[], joints: any[], reflines: any[]): string {
  const { minX, minY, maxX, maxY } = bboxOf(pens, joints)
  const pad = 60
  const w = Math.max(maxX - minX, 1) + pad * 2
  const h = Math.max(maxY - minY, 1) + pad * 2
  const jointByName: Record<string, any> = {}
  for (const j of joints) jointByName[j.name] = j
  let body = ''
  for (const pen of pens) {
    body += `<path d="${penToPathData(pen)}" fill="#2b2b2b" fill-opacity="0.9" stroke="#0a5" stroke-width="2"/>\n`
  }
  for (const r of reflines) {
    const s = jointByName[r.start]
    const e = jointByName[r.end]
    if (s && e) body += `<line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="#08f" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.6"/>\n`
  }
  for (const j of joints) {
    body += `<circle cx="${j.x}" cy="${j.y}" r="4" fill="#e33" stroke="#fff" stroke-width="1"/>\n`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - pad} ${minY - pad} ${w} ${h}" width="640">
<rect x="${minX - pad}" y="${minY - pad}" width="${w}" height="${h}" fill="#fafafa"/>
${body}
<text x="${minX - pad + 10}" y="${minY - pad + 22}" font-size="20" fill="#333" font-family="sans-serif">${name}</text>
</svg>`
}

function renderDigit(name: string, params: Record<string, any>, label: string): void {
  const { glyph, joints, reflines } = runDigitScript(name, params)
  const svg = buildSvg(`${name} · ${label}`, glyph._components, joints, reflines)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${name}-${label}.svg`), svg)
  gallerySvgCache.set(`${name}-${label}`, svg)
}

/** 收集各「数字-标签」的 SVG，最后汇总为一个可整体浏览的画廊 HTML */
const gallerySvgCache = new Map<string, string>()

function writeGallery(): void {
  const curvLabels = ['serif0-curv-0.5', 'serif0-curv-0.8', 'serif0-curv-1', 'serif0-curv-1.5']
  const columns = [...curvLabels, 'serif1']
  const headers = [
    { main: '弯曲度 0.5', note: '更方', base: false },
    { main: '弯曲度 0.8', note: '当前默认', base: true },
    { main: '弯曲度 1', note: '原二次', base: false },
    { main: '弯曲度 1.5', note: '更圆', base: false },
    { main: '衬线类型1', note: '默认弯曲度', base: false },
  ]
  // SVG 内硬编码颜色替换为 CSS 变量，使试样瓷砖跟随页面主题
  const themeSvg = (svg: string) =>
    svg
      .replace('fill="#fafafa"', 'fill="var(--tile)"')
      .replace('fill="#2b2b2b"', 'fill="var(--ink)"')
      .replace('stroke="#0a5"', 'stroke="var(--contour)"')
      .replace('stroke="#08f"', 'stroke="var(--ref)"')
      .replace('fill="#e33"', 'fill="var(--joint)"')
      .replace('stroke="#fff"', 'stroke="var(--tile)"')
      .replace('fill="#333"', 'fill="var(--ink-soft)"')
      .replace('<svg ', '<svg style="display:block;width:100%;height:auto" ')
  let grid = ''
  for (const digit of digits) {
    grid += `<div class="row"><div class="row-label">${digit.name}</div>`
    for (const col of columns) {
      grid += `<div class="cell">${themeSvg(gallerySvgCache.get(`${digit.name}-${col}`) ?? '')}</div>`
    }
    grid += `</div>`
  }
  const headerCells = headers
    .map((h) => `<div class="${h.base ? 'base' : ''}">${h.main}${h.note ? `<span>${h.note}</span>` : ''}</div>`)
    .join('')
  const html = `<title>字玩数字试样</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>
/* 布局概念：字体试样页 —— 标尺矩阵，一行一个数字，列为弯曲度档位 */
:root {
  --paper: #f2f1ee; --tile: #fbfaf8; --ink: #20211f; --ink-soft: #5c5d58;
  --line: #dad8d2; --accent: #b3402a; --contour: #0d7a4f; --joint: #d6402a; --ref: #2a6bd6;
  --good: #1f7a4d;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #15161a; --tile: #1e2025; --ink: #e8e7e3; --ink-soft: #a5a69f;
    --line: #33343a; --accent: #e07a5f; --contour: #5fc98f; --joint: #ef7d5f; --ref: #7da7ef;
    --good: #6fc493;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --paper: #15161a; --tile: #1e2025; --ink: #e8e7e3; --ink-soft: #a5a69f;
  --line: #33343a; --accent: #e07a5f; --contour: #5fc98f; --joint: #ef7d5f; --ref: #7da7ef;
  --good: #6fc493;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 28px max(16px, env(safe-area-inset-left, 0px)) 48px max(16px, env(safe-area-inset-right, 0px));
  background: var(--paper); color: var(--ink);
  font-family: "IBM Plex Sans", "PingFang SC", system-ui, sans-serif;
  font-size: 15px; line-height: 1.55;
}
header { max-width: 1280px; margin: 0 auto 18px; }
h1 { font-size: 26px; font-weight: 600; margin: 0 0 6px; text-wrap: balance; }
.sub { color: var(--ink-soft); font-size: 14px; max-width: 64ch; margin: 0 0 14px; }
.meta {
  display: flex; flex-wrap: wrap; gap: 8px 18px; border-top: 1px solid var(--line);
  padding-top: 12px; font-family: "IBM Plex Mono", ui-monospace, "SF Mono", monospace;
  font-size: 12.5px; color: var(--ink-soft); font-variant-numeric: tabular-nums;
}
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.sw.c { background: var(--contour); }
.sw.j { background: var(--joint); }
.sw.r { background: var(--ref); }
.cols, .row { display: grid; grid-template-columns: 46px repeat(6, minmax(0, 1fr)); gap: 10px; max-width: 1280px; margin: 0 auto; }
.cols { margin-bottom: 6px; }
.cols div {
  font-size: 12.5px; color: var(--ink-soft); text-align: center;
  font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums;
}
.cols div span { display: block; font-size: 11px; opacity: 0.8; }
.cols div.base { color: var(--accent); font-weight: 500; }
.cols div.base::before { content: "●"; font-size: 9px; margin-right: 5px; }
.row { margin-bottom: 10px; align-items: start; }
.row-label { font-size: 22px; font-weight: 600; text-align: center; padding-top: 4px; }
.cell { background: var(--tile); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
@media (max-width: 900px) {
  .cols { display: none; }
  .row { grid-template-columns: 1fr 1fr; gap: 8px; }
  .row-label { grid-column: 1 / -1; text-align: left; font-size: 20px; }
}
</style>
<header>
  <h1>字玩数字试样</h1>
  <p class="sub">digits 模板渲染验证：10 个数字 × 4 档弯曲度（无衬线，当前默认弯曲度 0.8），最后一列为衬线类型 1 基准。弯曲度 1 的输出与原二次贝塞尔（bend）版本逐字节一致，弯曲度 0 为直角、2 为最饱满。</p>
  <div class="meta">
    <div class="legend"><span><i class="sw c"></i>轮廓</span><span><i class="sw j"></i>骨架关节</span><span><i class="sw r"></i>辅助线</span></div>
    <span>字身框 1000 · ascender 800 / descender −200 · 字重 40 · 衬线大小 2.0</span>
  </div>
</header>
<div class="cols"><div></div>${headerCells}</div>
${grid}`
  writeFileSync(join(OUT_DIR, 'gallery.html'), html)
}

/** 将 PenComponent 采样为多边形顶点数组（每段 40 采样） */
function penToPolygon(pen: any): Array<{ x: number; y: number }> {
  const pts = pen.points
  const poly: Array<{ x: number; y: number }> = []
  if (!pts || pts.length < 4) return poly
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].type !== 'anchor') continue
    // 找到上一个 anchor 作为曲线起点
    let prevAnchor = -1
    for (let j = i - 1; j >= 0; j--) {
      if (pts[j].type === 'anchor') {
        prevAnchor = j
        break
      }
    }
    if (prevAnchor < 0) continue
    const p0 = pts[prevAnchor]
    const c1 = pts[i - 2]
    const c2 = pts[i - 1]
    const p3 = pts[i]
    for (let t = 0; t <= 40; t++) {
      const u = t / 40
      const v = 1 - u
      poly.push({
        x: v * v * v * p0.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * p3.x,
        y: v * v * v * p0.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * p3.y,
      })
    }
  }
  if (pen.isClosed) poly.push(poly[0])
  return poly
}

/** 单个多边形在某 y 高度的水平覆盖区间（偶数环绕规则，简单闭合形状即填充区） */
function intervalsAtY(poly: Array<{ x: number; y: number }>, y: number): Array<[number, number]> {
  const xs: number[] = []
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]
    const b = poly[i + 1]
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
  }
  xs.sort((m, n) => m - n)
  const out: Array<[number, number]> = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]])
  return out
}

/** 多个多边形覆盖区间的并集 */
function unionIntervals(list: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...list].sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const [s, e] of sorted) {
    if (!out.length || s > out[out.length - 1][1]) out.push([s, e])
    else if (e > out[out.length - 1][1]) out[out.length - 1][1] = e
  }
  return out
}

/** 生成数字轮廓剖面报告：包围盒 + 关键高度切片（区间数与宽度），用于视错修正的数值验证 */
function profileDigits(): string {
  const lines: string[] = []
  const fmt = (v: number) => (Math.round(v * 100) / 100).toString()
  for (const digit of digits) {
    const base = buildParams(digit)
    for (const serifType of [1, 0]) {
      const { glyph } = runDigitScript(digit.name, { ...base, 衬线类型: serifType })
      const polys = glyph._components.map(penToPolygon)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of polys) {
        for (const pt of p) {
          minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x)
          minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y)
        }
      }
      lines.push(`--- ${digit.name} serif${serifType} bbox [${fmt(minX)},${fmt(minY)}]→[${fmt(maxX)},${fmt(maxY)}] w=${fmt(maxX - minX)} h=${fmt(maxY - minY)} center_x=${fmt((minX + maxX) / 2)}`)
      for (const y of [40, 60, 120, 250, 400, 425, 450, 550, 600, 700, 780, 795, 815]) {
        const ints = unionIntervals(polys.flatMap((p) => intervalsAtY(p, y)))
        const width = ints.reduce((s, [a, b]) => s + (b - a), 0)
        const detail = ints.map(([a, b]) => `[${fmt(a)},${fmt(b)}]`).join(' ')
        lines.push(`  y=${y}: n=${ints.length} width=${fmt(width)} ${detail}`)
      }
    }
  }
  return lines.join('\n')
}

/** 逐笔画覆盖诊断：输出每个 PenComponent 在指定高度的覆盖区间 */
function debugPerPen(name: string, serifType: number, ys: number[]): string {
  const base = buildParams(digits.find((d) => d.name === name)!)
  const { glyph } = runDigitScript(name, { ...base, 衬线类型: serifType })
  const lines: string[] = []
  const fmt = (v: number) => (Math.round(v * 100) / 100).toString()
  for (const y of ys) {
    lines.push(`y=${y}:`)
    glyph._components.forEach((pen: any, i: number) => {
      const ints = intervalsAtY(penToPolygon(pen), y)
      lines.push(`  pen${i}: ${ints.map(([a, b]) => `[${fmt(a)},${fmt(b)}]`).join(' ') || '(none)'}`)
    })
  }
  return lines.join('\n')
}

/** 直连诊断：单段直线骨架 + heitiPressure，打印拟合前/后的真实笔画厚度 */
function probePressure(): string {
  const lines: string[] = []
  const seg = [{ start: { x: 0, y: 0 }, end: { x: 0, y: 750 } }]
  const r = FP.getCurveContours2('s', seg, 40, {
    weightsVariation: 'bezier',
    weightsVariationFnType: 'heitiPressure',
    startWeight: 40,
    endWeight: 26,
  })
  const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y)
  const fmt = (v: number) => Math.round(v * 100) / 100
  const inPts = r.in_s_points
  const outPts = r.out_s_points
  lines.push(`points=${inPts.length}`)
  const sample = (i: number) => fmt(dist(inPts[i], outPts[i]))
  lines.push(`thickness@t0=${sample(0)} t0.25=${sample(Math.floor(inPts.length * 0.25))} t0.5=${sample(Math.floor(inPts.length * 0.5))} t0.75=${sample(Math.floor(inPts.length * 0.75))} t1=${sample(inPts.length - 1)}`)
  // 拟合后曲线带：in/out 曲线成对的距离不易直接对应，打印拟合曲线数量与两端点距离
  if (r.in_s_curves.length && r.out_s_curves.length) {
    const ic = r.in_s_curves
    const oc = r.out_s_curves
    lines.push(`curves in=${ic.length} out=${oc.length}`)
    lines.push(`fitted@start=${fmt(dist(ic[0].start, oc[0].start))} fitted@end=${fmt(dist(ic[ic.length - 1].end, oc[oc.length - 1].end))}`)
  }
  return lines.join('\n')
}

describe('digits 模板渲染验证', () => {
  it('弯曲度=1 的三次贝塞尔描述与二次 bend 描述轮廓完全一致', () => {
    const toCubic = (start: any, bend: any, end: any, curvature: number) => {
      const k = (2 / 3) * curvature
      return {
        start,
        control1: { x: start.x + k * (bend.x - start.x), y: start.y + k * (bend.y - start.y) },
        control2: { x: end.x + k * (bend.x - end.x), y: end.y + k * (bend.y - end.y) },
        end,
      }
    }
    const joints = [
      { x: 500, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 500 },
      { x: 500, y: 800 }, { x: 700, y: 600 }, { x: 600, y: 200 },
    ]
    const [j0, j1, j2, j3, j4, j5] = joints
    const bendSegments = [
      { start: j0, bend: j1, end: j2 },
      { start: j2, bend: j3, end: j4 },
      { start: j4, bend: j5, end: j0 },
    ]
    const cubicSegments = bendSegments.map((s) => toCubic(s.start, s.bend, s.end, 1))
    const rBend = FP.getCurveContours2('s', bendSegments, 40)
    const rCubic = FP.getCurveContours2('s', cubicSegments, 40)
    expect(rCubic.out_s_points).toEqual(rBend.out_s_points)
    expect(rCubic.in_s_points).toEqual(rBend.in_s_points)
    expect(rCubic.out_s_curves).toEqual(rBend.out_s_curves)
    expect(rCubic.in_s_curves).toEqual(rBend.in_s_curves)
  })

  it('弯曲度越大，转角圆弧越贴近转角顶点（几何单调性）', () => {
    const start = { x: 500, y: 50 }
    const bend = { x: 320, y: 50 }
    const end = { x: 320, y: 425 }
    const toCubic = (curvature: number) => {
      const k = (2 / 3) * curvature
      return {
        start,
        control1: { x: start.x + k * (bend.x - start.x), y: start.y + k * (bend.y - start.y) },
        control2: { x: end.x + k * (bend.x - end.x), y: end.y + k * (bend.y - end.y) },
        end,
      }
    }
    // 三次贝塞尔曲线中点 B(0.5) = (P0 + 3C1 + 3C2 + P3) / 8
    const midpoint = (seg: any) => ({
      x: (seg.start.x + 3 * seg.control1.x + 3 * seg.control2.x + seg.end.x) / 8,
      y: (seg.start.y + 3 * seg.control1.y + 3 * seg.control2.y + seg.end.y) / 8,
    })
    const distToBend = (p: any) => Math.hypot(p.x - bend.x, p.y - bend.y)
    let prev = Infinity
    for (const c of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
      const d = distToBend(midpoint(toCubic(c)))
      expect(d).toBeLessThanOrEqual(prev + 1e-9)
      prev = d
    }
    // 弯曲度=1 时中点与二次贝塞尔（bend）中点解析一致：(P0 + 2B + P2) / 4
    const m1 = midpoint(toCubic(1))
    const quadMid = { x: (start.x + 2 * bend.x + end.x) / 4, y: (start.y + 2 * bend.y + end.y) / 4 }
    expect(m1.x).toBeCloseTo(quadMid.x, 10)
    expect(m1.y).toBeCloseTo(quadMid.y, 10)
    // 弯曲度=2 时中点恰好落在转角顶点上
    const m2 = midpoint(toCubic(2))
    expect(m2.x).toBeCloseTo(bend.x, 10)
    expect(m2.y).toBeCloseTo(bend.y, 10)
  })

  it('短笔画厚度分布探针（1 旗形 / 7 顶横）', () => {
    const lines: string[] = []
    const fmt = (v: number) => Math.round(v * 100) / 100
    // 垂直切片：量笔画多边形在 x 处的 y 覆盖范围（画出来的真实带厚）
    const extentAtX = (poly: Array<{ x: number; y: number }>, x: number) => {
      const ys: number[] = []
      for (let i = 0; i < poly.length - 1; i++) {
        const a = poly[i]
        const b = poly[i + 1]
        if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
          ys.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y))
        }
      }
      ys.sort((m, n) => m - n)
      if (ys.length < 2) return null
      return ys[ys.length - 1] - ys[0]
    }
    for (const name of ['1', '7', '5']) {
      const base = buildParams(digits.find((d) => d.name === name)!)
      const { glyph } = runDigitScript(name, { ...base, 衬线类型: 0 })
      const pens = glyph._components as any[]
      lines.push(`--- ${name} pens=${pens.length}`)
      pens.forEach((pen, pi) => {
        const poly = penToPolygon(pen)
        if (!poly.length) return
        const minX = Math.min(...poly.map((p: any) => p.x))
        const maxX = Math.max(...poly.map((p: any) => p.x))
        const fracs = [0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95]
        const parts = fracs.map((f) => {
          const x = minX + f * (maxX - minX)
          const e = extentAtX(poly, x)
          return e === null ? `${f}=?` : `${f}=${fmt(e)}`
        })
        lines.push(`  pen${pi} x-range=[${fmt(minX)},${fmt(maxX)}]: ${parts.join(' ')}`)
      })
    }
    const report = lines.join('\n')
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(join(OUT_DIR, 'short-stroke-probe.txt'), report)
    expect(report.length).toBeGreaterThan(0)
  })

  it('笔压探针：heitiPressure 的真实厚度分布', () => {
    const report = probePressure()
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(join(OUT_DIR, 'pressure-probe.txt'), report)
    expect(report.length).toBeGreaterThan(0)
  })

  it('逐笔画覆盖诊断（debug）', () => {
    const report = debugPerPen('1', 0, [780, 782, 784, 786, 788, 790, 792, 794, 796, 798, 800])
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(join(OUT_DIR, 'debug.txt'), report)
    expect(report.length).toBeGreaterThan(0)
  })

  it('输出轮廓剖面报告（切片测厚，用于视错修正验证）', () => {
    const report = profileDigits()
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(join(OUT_DIR, 'profile.txt'), report)
    expect(report.length).toBeGreaterThan(0)
  })

  it('渲染全部 digits 到 SVG（含衬线/无衬线 × 多档弯曲度）', () => {
    for (const digit of digits) {
      const base = buildParams(digit)
      for (const curv of [0.5, 0.8, 1, 1.5]) {
        renderDigit(digit.name, { ...base, 衬线类型: 0, 弯曲度: curv }, `serif0-curv-${curv}`)
      }
      renderDigit(digit.name, { ...base, 衬线类型: 1 }, 'serif1')
    }
    writeGallery()
    expect(true).toBe(true)
  })

  it('完整管线对照：executeGlyphScript 与直跑脚本生成的轮廓完全一致', async () => {
    const digit = digits.find((d) => d.name === '3')!
    const params = buildParams(digit)
    const script = readFileSync(join(PUBLIC_TEMPLATES, 'digits', '3.js'), 'utf8')

    // 直跑路径（本工具一直在用的方式）
    const direct = runDigitScript('3', params)
    const directPens = direct.glyph._components.map((p: any) => p.points)

    // App 完整管线路径
    const { createBaseGlyph } = await import('@/features/editor/menus/templatesHandlers')
    const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
    const { instanceManager } = await import('@/core/instance/InstanceManager')
    const projectStore = useProjectStore()
    const file: any = { uuid: 'file-pipeline-test', name: 't', glyphs: [], stroke_glyphs: [], radical_glyphs: [], comp_glyphs: [], components: [] }
    projectStore.addFile(file)
    projectStore.selectFile(file.uuid)

    // 与 templatesHandlers.buildLetterOrDigitParams 相同的参数构造（该函数未导出）
    const parameters: any[] = []
    for (const p of digit.params) {
      parameters.push({ uuid: `p-${p.name}`, name: p.name, type: ParameterType.Number, value: p.value ?? p.default, min: p.min ?? 0, max: p.max ?? 1000 })
    }
    for (const p of digit.globalParams) {
      if ((p as any).type === ParameterType.Enum) {
        parameters.push({ uuid: `g-${p.name}`, name: p.name, type: (p as any).type, value: p.value ?? p.default, options: (p as any).options })
      } else {
        parameters.push({ uuid: `g-${p.name}`, name: p.name, type: (p as any).type ?? ParameterType.Number, value: p.value ?? p.default, min: p.min ?? 0, max: p.max ?? 1000 })
      }
    }
    const glyphData: any = createBaseGlyph('3', 'pipeline-test', `function script_glyph_pipeline_3 (glyph, constants, FP) {\n\t${script}\n}`, parameters)
    glyphData.uuid = 'glyph-pipeline-3'
    executeGlyphScript(glyphData)

    const inst: any = instanceManager.acquireTemporaryInstance(
      'glyph-pipeline-3',
      () => { throw new Error('instance not pooled') },
      'glyph'
    )
    expect(inst).toBeTruthy()
    const pipelinePens = (inst._components || []).map((p: any) => p.points)

    expect(pipelinePens.length).toBe(directPens.length)
    for (let i = 0; i < directPens.length; i++) {
      expect(pipelinePens[i].length).toBe(directPens[i].length)
      for (let j = 0; j < directPens[i].length; j++) {
        expect(pipelinePens[i][j].x).toBeCloseTo(directPens[i][j].x, 6)
        expect(pipelinePens[i][j].y).toBeCloseTo(directPens[i][j].y, 6)
      }
    }
  })

  it('所有 digits 脚本输出轮廓点无 NaN 且落在合理包围盒内', () => {
    for (const digit of digits) {
      const base = buildParams(digit)
      for (const curv of [0, 0.5, 0.8, 1, 1.5, 2]) {
        appendFileSync(join(OUT_DIR, 'bisect.txt'), digit.name + ' ' + curv + '\n')
        const { glyph } = runDigitScript(digit.name, { ...base, 衬线类型: 1, 弯曲度: curv })
        expect(glyph._components.length).toBeGreaterThan(0)
        for (const pen of glyph._components) {
          for (const p of pen.points || []) {
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) >= 2000 || Math.abs(p.y) >= 2000) {
              const pts = (pen.points || []).map((q: any, i: number) => `${i}:${q.type === 'anchor' ? 'A' : 'C'}(${Math.round(q.x)},${Math.round(q.y)})`).join(' ')
              appendFileSync(join(OUT_DIR, 'wild.txt'), `digit=${digit.name} curv=${curv} penType=${pen.type} x=${p.x} y=${p.y}\n${pts}\n`)
            }
            expect(Number.isFinite(p.x)).toBe(true)
            expect(Number.isFinite(p.y)).toBe(true)
            expect(Math.abs(p.x)).toBeLessThan(2000)
            expect(Math.abs(p.y)).toBeLessThan(2000)
          }
        }
      }
    }
  })
})
