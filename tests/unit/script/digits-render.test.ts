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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { digits } from '@/templates/digits'

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
  const curvLabels = ['serif1-curv-0', 'serif1-curv-0.5', 'serif1-curv-1', 'serif1-curv-1.5', 'serif1-curv-2']
  const columns = [...curvLabels, 'serif0']
  const headers = [
    { main: '弯曲度 0', note: '直角', base: false },
    { main: '弯曲度 0.5', note: '', base: false },
    { main: '弯曲度 1', note: '与原二次一致', base: true },
    { main: '弯曲度 1.5', note: '', base: false },
    { main: '弯曲度 2', note: '最饱满', base: false },
    { main: '无衬线', note: '弯曲度 1', base: false },
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
  <p class="sub">digits 模板弯曲度改造验证：10 个数字 × 5 档弯曲度（衬线类型 1），最后一列为无衬线基准。弯曲度 1 的输出与原二次贝塞尔（bend）版本逐字节一致，弯曲度 0 为直角、2 为最饱满。</p>
  <div class="meta">
    <div class="legend"><span><i class="sw c"></i>轮廓</span><span><i class="sw j"></i>骨架关节</span><span><i class="sw r"></i>辅助线</span></div>
    <span>字身框 1000 · ascender 800 / descender −200 · 字重 40 · 衬线大小 2.0</span>
  </div>
</header>
<div class="cols"><div></div>${headerCells}</div>
${grid}`
  writeFileSync(join(OUT_DIR, 'gallery.html'), html)
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

  it('渲染全部 digits 到 SVG（含衬线/无衬线 × 多档弯曲度）', () => {
    for (const digit of digits) {
      const base = buildParams(digit)
      for (const curv of [0, 0.5, 1, 1.5, 2]) {
        renderDigit(digit.name, { ...base, 衬线类型: 1, 衬线大小: 2.0, 弯曲度: curv }, `serif1-curv-${curv}`)
      }
      renderDigit(digit.name, { ...base, 衬线类型: 0, 衬线大小: 2.0, 弯曲度: 1 }, 'serif0')
    }
    writeGallery()
    expect(true).toBe(true)
  })

  it('所有 digits 脚本输出轮廓点无 NaN 且落在合理包围盒内', () => {
    for (const digit of digits) {
      const base = buildParams(digit)
      for (const curv of [0, 0.5, 1, 1.5, 2]) {
        const { glyph } = runDigitScript(digit.name, { ...base, 衬线类型: 1, 弯曲度: curv })
        expect(glyph._components.length).toBeGreaterThan(0)
        for (const pen of glyph._components) {
          for (const p of pen.points || []) {
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
