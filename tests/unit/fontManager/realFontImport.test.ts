/**
 * 真实字库导入解析诊断测试
 * 测试字库位于 ~/Documents/字体测试/，缺失时自动跳过（CI 安全）。
 * 用于：复现导入 bug、验证解析修复、观察各字体解析耗时。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse } from '@/fontManager'

const FONT_DIR = join(homedir(), 'Documents', '字体测试')
const SKIP_DIR = !existsSync(FONT_DIR)

function listFonts(): Array<{ name: string; path: string }> {
  if (SKIP_DIR) return []
  return readdirSync(FONT_DIR)
    .filter((f) => /\.(ttf|otf)$/i.test(f))
    .map((f) => ({ name: f, path: join(FONT_DIR, f) }))
}

describe('real font import diagnostics', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it.skipIf(SKIP_DIR)('composite glyphs and sample contours are correct', { timeout: 600_000 }, () => {
    const read = (name: string) => {
      const path = join(FONT_DIR, name)
      if (!existsSync(path)) return null
      const buffer = readFileSync(path)
      return parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
    }

    // Verdana Italic：复合字形为主，验证 é/à/ü 等由组件合成的字符轮廓非空
    const verdana = read('Verdana Italic.ttf')
    if (verdana) {
      for (const cp of [0xe9, 0xe0, 0xfc, 0x41, 0x20]) {
        const ch = verdana.characters.find((c: any) => c.unicode === cp)
        const segCount = ch ? ch.contours.reduce((s: number, ct: any[]) => s + ct.length, 0) : -1
        const glyfTb = (verdana as any).tables?.find((t: any) => t.name === 'glyf')?.table
        const rawGlyph = ch && glyfTb?.glyphTables?.[ch.index]
        process.stdout.write(
          `Verdana U+${cp.toString(16).toUpperCase()}: ${ch ? `contours=${ch.contourNum} segs=${segCount} aw=${ch.advanceWidth}` : 'MISSING'} | rawGlyph#${ch?.index} contours=${rawGlyph?.numberOfContours} isComposite=${rawGlyph?.isComposite} comps=${rawGlyph?.components?.length ?? 0}\n`,
        )
        expect(ch, `Verdana U+${cp.toString(16)} should exist`).toBeTruthy()
        if (cp !== 0x20) expect(segCount, `Verdana U+${cp.toString(16)} composite contours`).toBeGreaterThan(0)
      }
    }

    // 山海国潮：验证中文字符轮廓与宽度
    const shanhai = read('山海国潮 45W.ttf')
    if (shanhai) {
      for (const cp of [0x4e2d, 0x56fd, 0x4eba]) {
        const ch = shanhai.characters.find((c: any) => c.unicode === cp)
        const segCount = ch ? ch.contours.reduce((s: number, ct: any[]) => s + ct.length, 0) : -1
        process.stdout.write(
          `山海国潮 U+${cp.toString(16).toUpperCase()}: ${ch ? `contours=${ch.contourNum} segs=${segCount} aw=${ch.advanceWidth}` : 'MISSING'}\n`,
        )
        expect(ch, `山海国潮 U+${cp.toString(16)} should exist`).toBeTruthy()
        expect(segCount, `山海国潮 U+${cp.toString(16)} contours`).toBeGreaterThan(0)
        expect(ch!.advanceWidth, `山海国潮 U+${cp.toString(16)} advanceWidth`).toBeGreaterThan(0)
      }
    }

    // 思源黑体：验证非 BMP 字符（扩展区）与基本字符
    const sourceHan = read('SourceHanSansSC-Regular.otf')
    if (sourceHan) {
      const bmp = sourceHan.characters.find((c: any) => c.unicode === 0x4e2d)
      const nonBmp = sourceHan.characters.filter((c: any) => c.unicode > 0xffff)
      const extSample = nonBmp[0]
      process.stdout.write(
        `思源黑体 U+4E2D: ${bmp ? `contours=${bmp.contourNum} aw=${bmp.advanceWidth}` : 'MISSING'}, nonBMP count=${nonBmp.length}, first nonBMP: U+${extSample ? extSample.unicode.toString(16).toUpperCase() : 'none'}\n`,
      )
      expect(bmp).toBeTruthy()
      expect(bmp!.advanceWidth).toBeGreaterThan(0)
      if (extSample) {
        process.stdout.write(
          `  非BMP样本 U+${extSample.unicode.toString(16).toUpperCase()}: contours=${extSample.contourNum} aw=${extSample.advanceWidth}\n`,
        )
        expect(extSample.contours.length).toBeGreaterThan(0)
      }
    }
  })

  it.skipIf(SKIP_DIR || listFonts().length === 0)('parses every font in the test dir', { timeout: 600_000 }, () => {
    const report: Array<Record<string, unknown>> = []
    for (const { name, path } of listFonts()) {
      const buffer = readFileSync(path)
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const t0 = Date.now()
      try {
        const font = parse(ab as ArrayBuffer)
        const chars = font.characters
        const bmp = chars.filter((c: any) => c.unicode > 0 && c.unicode <= 0xffff).length
        const nonBmp = chars.filter((c: any) => c.unicode > 0xffff).length
        report.push({
          name,
          status: 'OK',
          ms: Date.now() - t0,
          chars: chars.length,
          bmp,
          nonBmp,
          unitsPerEm: font.settings.unitsPerEm,
          ascender: font.settings.ascender,
          descender: font.settings.descender,
        })
      } catch (e) {
        report.push({ name, status: 'ERROR', ms: Date.now() - t0, error: String(e instanceof Error ? e.stack ?? e.message : e) })
      }
    }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    for (const r of report) {
      expect(r.status, `${r.name}: ${String(r.error ?? '')}`).toBe('OK')
    }
  })

  it.skipIf(SKIP_DIR || listFonts().length === 0)('parses every font WITHOUT Node Buffer global (browser-like)', { timeout: 600_000 }, () => {
    // 模拟浏览器环境：移除 Node Buffer 全局，暴露对 Buffer 的隐式依赖
    // （此前 Mac name 表解码用 iconv-lite + Buffer 在浏览器崩溃）
    const savedBuffer = (globalThis as any).Buffer
    ;(globalThis as any).Buffer = undefined
    try {
      for (const { name, path } of listFonts()) {
        const buffer = readFileSync(path)
        const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        const font = parse(ab as ArrayBuffer)
        expect(font.characters.length, `${name}: should parse without Buffer`).toBeGreaterThan(0)
      }
    } finally {
      ;(globalThis as any).Buffer = savedBuffer
    }
  })
})
