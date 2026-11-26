/**
 * 导入→导出 坐标往返测试（几何级对比）：
 * 解析字体轮廓 → contoursToComponents（导入路径）→ componentsToContours（导出路径），
 * 输出轮廓与原始轮廓在曲线几何上必须完全一致（二次贝塞尔转三次后控制点不同，
 * 但曲线上任意 t 处的采样点必须相同）。
 * 用于回归「导入字符在编辑器/导出中整体偏移」问题。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse, PathType } from '@/fontManager'
import { ContourConverter } from '@/core/font/converter'
import {
  buildCharacterFilesFromParsedFont,
  resolveImportFontMetrics,
} from '@/features/editor/services/FontLibraryImportService'

const FONT_DIR = join(homedir(), 'Documents', '字体测试')

function loadFont(name: string): ReturnType<typeof parse> | null {
  const p = join(FONT_DIR, name)
  if (!existsSync(p)) return null
  const buffer = readFileSync(p)
  return parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
}

/** 在 t 处采样一条线段 */
function sampleLine(seg: any, t: number) {
  return {
    x: seg.start.x + (seg.end.x - seg.start.x) * t,
    y: seg.start.y + (seg.end.y - seg.start.y) * t,
  }
}

/** 在 t 处采样一条二次贝塞尔 */
function sampleQuad(seg: any, t: number) {
  const mt = 1 - t
  return {
    x: mt * mt * seg.start.x + 2 * mt * t * seg.control.x + t * t * seg.end.x,
    y: mt * mt * seg.start.y + 2 * mt * t * seg.control.y + t * t * seg.end.y,
  }
}

/** 在 t 处采样一条三次贝塞尔 */
function sampleCubic(seg: any, t: number) {
  const mt = 1 - t
  return {
    x:
      mt * mt * mt * seg.start.x +
      3 * mt * mt * t * seg.control1.x +
      3 * mt * t * t * seg.control2.x +
      t * t * t * seg.end.x,
    y:
      mt * mt * mt * seg.start.y +
      3 * mt * mt * t * seg.control1.y +
      3 * mt * t * t * seg.control2.y +
      t * t * t * seg.end.y,
  }
}

const sampleSeg = (seg: any, t: number) => {
  if (seg.type === PathType.LINE) return sampleLine(seg, t)
  if (seg.type === PathType.QUADRATIC_BEZIER) return sampleQuad(seg, t)
  return sampleCubic(seg, t)
}

describe('import→export coordinate roundtrip (geometry)', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it('roundtrip curve geometry is exact for sample glyphs of all test fonts', { timeout: 300_000 }, () => {
    const samples: Record<string, number[]> = {
      '山海国潮 45W.ttf': [0x4e2d, 0x4f1d, 0x4eba],
      'Skia.ttf': [0x41, 0x42, 0x20],
      'Verdana Italic.ttf': [0x41, 0xe9, 0x20],
      'Tahoma Bold.ttf': [0x41, 0x20],
      'SourceHanSansSC-Regular.otf': [0x4e2d],
      '字玩标准黑体.otf': [0x4e2d],
    }
    for (const [name, codepoints] of Object.entries(samples)) {
      const font = loadFont(name)
      if (!font) continue
      const upm = font.settings.unitsPerEm ?? 1000
      const desc = font.settings.descender ?? -200
      for (const cp of codepoints) {
        const ch = font.characters.find((c: any) => c.unicode === cp)
        if (!ch) continue
        if (!ch.contours.some((c: any[]) => c.length)) continue

        // 导入 = 导出逆运算 + upm 缩放到工程标准 1000（与 FontLibraryImportService 一致，
        // 含 em 盒超 1000 时的垂直居中 descender 调整）
        const metrics = resolveImportFontMetrics(font.settings)
        const scale = metrics.scale
        const scaledDesc = metrics.descender
        const scaleSeg = (seg: any): any => ({
          ...seg,
          start: { x: seg.start.x * scale, y: seg.start.y * scale },
          end: { x: seg.end.x * scale, y: seg.end.y * scale },
          control: seg.control ? { x: seg.control.x * scale, y: seg.control.y * scale } : undefined,
          control1: seg.control1 ? { x: seg.control1.x * scale, y: seg.control1.y * scale } : undefined,
          control2: seg.control2 ? { x: seg.control2.x * scale, y: seg.control2.y * scale } : undefined,
        })

        // 1. 导入路径（与 FontLibraryImportService 一致：真实 advanceWidth 居中）
        const scaledAdvance = Math.round((ch.advanceWidth ?? upm) * scale)
        const components = ContourConverter.contoursToComponents(
          ch.contours.map((c: any[]) => c.map(scaleSeg)),
          {
            unitsPerEm: 1000,
            descender: scaledDesc,
            advanceWidth: scaledAdvance,
          },
        )

        // 显示居中验证：每个组件（对应一个轮廓）的编辑器 xMin =
        // floor(该轮廓左缘×scale) + c，c = (1000 - advance)/2（advance 盒居中显示）
        const expectedCentering = (1000 - scaledAdvance) / 2
        for (let ci = 0; ci < components.length; ci++) {
          const pts = (components[ci].value as any).points as Array<{ x: number }> | undefined
          if (!pts?.length) continue
          const xMin = Math.min(...pts.map((p) => p.x))
          let contourXMin = Infinity
          for (const seg of ch.contours[ci]) {
            contourXMin = Math.min(contourXMin, seg.start.x, seg.end.x)
          }
          const expectedXMin = Math.floor(contourXMin * scale) + expectedCentering
          expect(Math.abs(xMin - expectedXMin), `${name} U+${cp.toString(16)} contour[${ci}] display centering`).toBeLessThan(1)
        }

        // 2. 导出路径（与 ExportFontService 对 imported 字符一致：用真实 advanceWidth 还原）
        const exported = ContourConverter.componentsToContours(
          components,
          { unitsPerEm: 1000, descender: scaledDesc, advanceWidth: scaledAdvance, preview: false, forceUpdate: true },
          { x: 0, y: 0 },
        )

        // 3. 几何对比：每段在 t=0/0.25/0.5/0.75/1 处采样必须一致
        // 参照 = 原始轮廓缩放到 1000 后按 app 惯例 floor（导入入口 floor，幂等）
        const fl = (v: number) => Math.floor(v * scale)
        const floorSeg = (seg: any): any => ({
          ...seg,
          start: { x: fl(seg.start.x), y: fl(seg.start.y) },
          end: { x: fl(seg.end.x), y: fl(seg.end.y) },
          control: seg.control ? { x: fl(seg.control.x), y: fl(seg.control.y) } : undefined,
          control1: seg.control1 ? { x: fl(seg.control1.x), y: fl(seg.control1.y) } : undefined,
          control2: seg.control2 ? { x: fl(seg.control2.x), y: fl(seg.control2.y) } : undefined,
        })
        expect(exported.length, `${name} U+${cp.toString(16)} contour count`).toBe(ch.contours.length)
        let maxErr = 0
        let maxErrInfo = ''
        for (let ci = 0; ci < ch.contours.length; ci++) {
          let src = ch.contours[ci].map(floorSeg)
          // CFF 轮廓的闭合边是隐式的（charstring 结束点连回首点），
          // 导入路径会补上该闭合段，参照侧同样补上（否则段数对不上）
          const firstStart = src[0]?.start
          const lastEnd = src[src.length - 1]?.end
          if (firstStart && lastEnd && (firstStart.x !== lastEnd.x || firstStart.y !== lastEnd.y)) {
            src = [...src, { type: PathType.LINE, start: lastEnd, end: firstStart } as any]
          }
          const out = exported[ci]
          expect(out.length, `${name} U+${cp.toString(16)} contour[${ci}] segment count`).toBe(src.length)
          for (let si = 0; si < src.length; si++) {
            for (const t of [0, 0.25, 0.5, 0.75, 1]) {
              const a = sampleSeg(src[si], t)
              const b = sampleSeg(out[si], t)
              const err = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
              if (err > maxErr) {
                maxErr = err
                maxErrInfo = `contour[${ci}] seg[${si}] t=${t} src=${JSON.stringify(a)} out=${JSON.stringify(b)} srcSeg=${JSON.stringify(src[si])} outSeg=${JSON.stringify(out[si])}`
              }
            }
          }
        }
        process.stdout.write(
          `${name} U+${cp.toString(16).toUpperCase()}: contours=${ch.contours.length} maxGeomErr=${maxErr.toFixed(4)} upm=${upm} desc=${desc}\n`,
        )
        if (maxErr >= 1) process.stdout.write(`  worst: ${maxErrInfo}\n`)
        // 阈值 <1：app 对字体坐标的既定量化惯例（genPenContour 导出时 Math.floor），
        // 二次→三次转换的分数控制点在导出时会被 floor 一次，量化误差 ≤1 单位；
        // 这是工程自身字符导出同样存在的行为（对 1000 upm 视觉上不可见）
        expect(maxErr, `${name} U+${cp.toString(16)} geometry drift`).toBeLessThan(1)
      }
    }
  })

  it('imported character files carry font metrics (lsb/advanceWidth)', { timeout: 120_000 }, async () => {
    const font = loadFont('山海国潮 45W.ttf')
    if (!font) return
    // 数字 '1'：窄字符，lsb/advanceWidth 与汉字差异大，最能暴露度量缺失问题
    const one = font.characters.find((c: any) => c.unicode === 0x31)
    expect(one, 'U+0031 should exist').toBeTruthy()

    const scale = 1000 / (font.settings.unitsPerEm ?? 1000)
    const files = await buildCharacterFilesFromParsedFont(
      { characters: [one!], settings: font.settings },
      1000,
    )
    expect(files.length).toBe(1)
    const metrics = files[0].info?.metrics
    expect(metrics, 'imported character must carry info.metrics').toBeTruthy()
    expect(metrics!.advanceWidth, 'advanceWidth must come from the font (scaled)').toBe(
      Math.round((one!.advanceWidth ?? 1000) * scale),
    )
    expect(metrics!.lsb, 'lsb must come from the font (scaled)').toBe(
      Math.floor((one!.leftSideBearing ?? 0) * scale),
    )
    expect(metrics!.useDefaultValues).toBe(false)
    process.stdout.write(
      `  山海国潮 U+0031: advanceWidth=${metrics!.advanceWidth} lsb=${metrics!.lsb}\n`,
    )
  })
})
