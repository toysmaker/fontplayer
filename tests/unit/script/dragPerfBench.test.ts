/**
 * 拖拽性能基准(临时排查用)
 * 测量: 脚本生成几何规模 / 脚本执行耗时 / 吸附线收集 / 吸附评估
 */
import { describe, it, beforeAll, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { digits } from '@/templates/digits'
import { lowercaseLetters } from '@/templates/lowercase_letters'
import { collectStraightAxisLinesFromPenComponents, evaluateSnapReflineSticky } from '@/features/tools/glyphDragger/core/reflineSnap'

const PUBLIC_TEMPLATES = join(process.cwd(), 'public', 'templates')

let FP: any = null

beforeAll(async () => {
  setActivePinia(createPinia())
  await import('@/stores/character')
  const mod = await import('@/core/script/FPUtils')
  FP = mod.FP
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function makeMockGlyph(params: Record<string, any>) {
  const components: any[] = []
  const joints: any[] = []
  const reflines: any[] = []
  const glyph: any = {
    uuid: 'test-glyph',
    tempData: null,
    clear: () => { components.length = 0; joints.length = 0; reflines.length = 0 },
    getParam: (name: string) => params[name],
    getParamRange: () => ({ min: 0, max: 1000 }),
    setParam: (name: string, v: any) => { params[name] = v },
    addComponent: (c: any) => { components.push(c) },
    addJoint: (j: any) => { joints.push(j) },
    addRefLine: (r: any) => { reflines.push(r) },
    getJoints: () => joints,
    getRefLines: () => reflines,
    _components: components,
  }
  return glyph
}

function buildParams(tpl: any, overrides: Record<string, any> = {}): Record<string, any> {
  const result: Record<string, any> = {}
  for (const p of tpl.params) result[p.name] = p.value ?? p.default
  for (const p of tpl.globalParams) result[p.name] = p.value ?? p.default
  return { ...result, ...overrides }
}

function runScript(dir: string, name: string, params: Record<string, any>): { glyph: any; execMs: number } {
  const script = readFileSync(join(PUBLIC_TEMPLATES, dir, `${name}.js`), 'utf8')
  const glyph = makeMockGlyph(params)
  const code = `function script_entry(glyph, constants, FP) {\n${script}\n}\nscript_entry(g, c, f)`
  const t0 = performance.now()
  new Function('g', 'c', 'f', code)(glyph, {}, FP)
  const execMs = performance.now() - t0
  return { glyph, execMs }
}

function totalPoints(components: any[]): number {
  let pts = 0
  for (const c of components) {
    if (c?.type === 'glyph-pen' && Array.isArray(c.points)) pts += c.points.length
  }
  return pts
}

describe('drag perf bench', () => {
  it('measures geometry and snap costs', () => {
    const report: string[] = []
    const instances: any[] = []

    // 1. 脚本执行耗时 + 几何规模 (digits 8/3/0, lowercase t/a)
    const tplParams: Record<string, any> = {
      digits: { 8: digits.find((d: any) => d.name === '8'), 3: digits.find((d: any) => d.name === '3'), 0: digits.find((d: any) => d.name === '0') },
      lowercase_letters: { t: lowercaseLetters.find((l: any) => l.name === 't'), a: lowercaseLetters.find((l: any) => l.name === 'a') },
    }
    for (const [dir, names] of Object.entries(tplParams)) {
      for (const [name, tpl] of Object.entries(names)) {
        const { glyph, execMs } = runScript(dir, name, buildParams(tpl))
        instances.push(glyph)
        report.push(`${dir}/${name}: script=${execMs.toFixed(1)}ms components=${glyph._components.length} points=${totalPoints(glyph._components)} joints=${glyph.getJoints().length}`)
      }
    }

    // 2. 模拟复杂字符: 9 个同几何实例(自身 + 8 peer)的每 mousemove 吸附线收集
    const heaviest = instances[0]
    const t2 = performance.now()
    let ownLines: any[] = []
    for (let i = 0; i < 100; i++) {
      for (let p = 0; p < 9; p++) {
        ownLines = collectStraightAxisLinesFromPenComponents(heaviest._components, 10, 20)
      }
    }
    const collectMs = performance.now() - t2
    report.push(`collectStraightAxisLines x900 (9 peers): ${collectMs.toFixed(1)}ms total, ${(collectMs / 900).toFixed(4)}ms/call, own lines=${ownLines.length}`)

    // 3. evaluateSnapReflineSticky: keylines = 8 peers' lines
    const keylines: any[] = []
    for (let p = 0; p < 8; p++) keylines.push(...ownLines)
    const t3 = performance.now()
    for (let i = 0; i < 100; i++) {
      evaluateSnapReflineSticky(keylines, ownLines, 20, 24, null, null)
    }
    report.push(`evaluateSnapReflineSticky x100 (key=${keylines.length} ref=${ownLines.length}): ${(performance.now() - t3).toFixed(1)}ms, ${((performance.now() - t3) / 100).toFixed(4)}ms/call`)

    process.stdout.write('\n[BENCH]\n' + report.join('\n') + '\n')
    expect(report.length).toBeGreaterThan(0)
  })
})
