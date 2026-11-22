import { describe, it, expect, beforeAll, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { capitalLetters } from '@/templates/capital_letters'
import { lowercaseLetters } from '@/templates/lowercase_letters'

const PUBLIC_TEMPLATES = join(process.cwd(), 'public', 'templates')
const OUT_DIR = join(os.tmpdir(), 'fontplayer-digits-render')
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

function runLetter(dir: string, name: string): any {
  const letters = dir === 'capital_letters' ? capitalLetters : lowercaseLetters
  const letter = (letters as any[]).find((l) => l.name === name)!
  const params: Record<string, any> = {}
  for (const p of letter.params) params[p.name] = p.value ?? p.default
  for (const p of letter.globalParams) params[p.name] = p.value ?? p.default
  const script = readFileSync(join(PUBLIC_TEMPLATES, dir, `${name}.js`), 'utf8')
  const glyph: any = {
    uuid: 't', tempData: null, clear: () => {},
    getParam: (n: string) => params[n],
    getParamRange: () => ({ min: 0, max: 1000 }),
    setParam: () => {},
    addComponent: (c: any) => glyph._components.push(c),
    addJoint: (j: any) => glyph._joints.push(j),
    addRefLine: () => {},
    getJoints: () => glyph._joints,
    getRefLines: () => [],
    _components: [], _joints: [],
  }
  const code = `function script_letter(glyph, constants, FP) {\n${script}\n}\nscript_letter(g, c, f)`
  new Function('g', 'c', 'f', code)(glyph, {}, FP)
  return glyph
}

function bbox(glyph: any) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const pen of glyph._components) {
    for (const p of pen.points || []) {
      if (p.x === undefined || p.y === undefined || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
  }
  return { minX: Math.round(minX), minY: Math.round(minY), maxX: Math.round(maxX), maxY: Math.round(maxY) }
}

describe('骨架审计', () => {
  it('所有字母骨架与轮廓范围', () => {
    const lines: string[] = []
    for (const [dir, letters, kind] of [
      ['capital_letters', capitalLetters, '大写'],
      ['lowercase_letters', lowercaseLetters, '小写'],
    ] as any[]) {
      lines.push(`=== ${kind}`)
      for (const letter of letters) {
        const glyph = runLetter(dir, letter.name)
        const b = bbox(glyph)
        const joints = glyph._joints
        let jMinY = Infinity, jMaxY = -Infinity
        for (const j of joints) { jMinY = Math.min(jMinY, j.y); jMaxY = Math.max(jMaxY, j.y) }
        // 骨架 y 关键点
        const jys = [...new Set(joints.map((j: any) => j.y))].sort((a: number, b: number) => a - b)
        lines.push(`${letter.name}: 轮廓y[${b.minY},${b.maxY}] 骨架y[${Math.round(jMinY)},${Math.round(jMaxY)}] (${jys.map((v: number) => Math.round(v)).join(',')})`)
      }
    }
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(join(OUT_DIR, 'skeleton-audit.txt'), lines.join('\n'))
    expect(lines.length).toBeGreaterThan(0)
  })
})
