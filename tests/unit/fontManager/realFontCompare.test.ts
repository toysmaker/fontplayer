/**
 * 与 fontTools 的交叉验证：逐码点对比 cmap 映射（glyph index）与 advanceWidth。
 * 参考数据由 scripts 外部的 fontTools 生成（/tmp/fontmaps/all_gid.json），
 * 文件缺失时自动跳过（CI 安全）。生成方式见 realFontImport.test.ts 注释。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse } from '@/fontManager'

const FONT_DIR = join(homedir(), 'Documents', '字体测试')
const REF_PATH = '/tmp/fontmaps/all_gid.json'
const hasRef = existsSync(REF_PATH)

function listFonts(): string[] {
  if (!existsSync(FONT_DIR)) return []
  return readdirSync(FONT_DIR).filter((f) => /\.(ttf|otf)$/i.test(f))
}

describe('cmap cross-validation against fontTools', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it.skipIf(!hasRef)('every mapped codepoint matches fontTools bestCmap', { timeout: 600_000 }, () => {
    const ref = JSON.parse(readFileSync(REF_PATH, 'utf-8')) as Record<
      string,
      { cmap: Record<string, number>; advance: Record<string, number>; lsb: Record<string, number> }
    >

    for (const name of listFonts()) {
      const expected = ref[name]
      if (!expected) continue // fontTools 无法解析的字库（旧版导出的非法 CFF）跳过
      const path = join(FONT_DIR, name)
      const buffer = readFileSync(path)
      const font = parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)

      // 我方的码点 → glyph index 映射（cmap 表内部数据）
      const cmapTable = (font.tables as any)?.find((t: any) => t.name === 'cmap')?.table
      const myMap: Record<string, number> = cmapTable?.glyphIndexMap ?? {}

      // 1. 字符数量一致（双方都排除 glyph 0）
      expect(font.characters.length, `${name}: character count`).toBe(Object.keys(expected.cmap).length)

      // 2. 逐码点 glyph index 一致
      let mismatch = 0
      for (const [cp, gid] of Object.entries(expected.cmap)) {
        if (myMap[cp] !== gid) {
          mismatch++
          if (mismatch <= 5) {
            process.stdout.write(
              `  ${name} cp=${cp}: fontTools gid=${gid} vs mine=${myMap[cp]}\n`,
            )
          }
        }
      }
      expect(mismatch, `${name}: cmap glyph-index mismatches`).toBe(0)

      // 3. advanceWidth 一致
      let advMismatch = 0
      for (const [cp, aw] of Object.entries(expected.advance)) {
        const ch = font.characters.find((c: any) => c.unicode === Number(cp))
        if (!ch || ch.advanceWidth !== aw) {
          advMismatch++
          if (advMismatch <= 5) {
            process.stdout.write(
              `  ${name} cp=${cp}: fontTools aw=${aw} vs mine=${ch ? ch.advanceWidth : 'MISSING'}\n`,
            )
          }
        }
      }
      expect(advMismatch, `${name}: advanceWidth mismatches`).toBe(0)

      // 4. leftSideBearing（lsb）一致
      let lsbMismatch = 0
      for (const [cp, lsbExpected] of Object.entries(expected.lsb)) {
        const ch = font.characters.find((c: any) => c.unicode === Number(cp))
        if (!ch || (ch.leftSideBearing ?? 0) !== lsbExpected) {
          lsbMismatch++
          if (lsbMismatch <= 5) {
            process.stdout.write(
              `  ${name} cp=${cp}: fontTools lsb=${lsbExpected} vs mine=${ch ? ch.leftSideBearing : 'MISSING'}\n`,
            )
          }
        }
      }
      expect(lsbMismatch, `${name}: leftSideBearing mismatches`).toBe(0)
    }
  })
})
