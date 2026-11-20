import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseRgba } from '@/fontManager/tables/cpal'
import { create, toArrayBuffer, PathType } from '@/fontManager'

describe('parseRgba（彩色字体颜色解析）', () => {
  it('hex #RRGGBB', () => {
    expect(parseRgba('#ff0000')).toEqual({ red: 255, green: 0, blue: 0, alpha: 255 })
    expect(parseRgba('#00ff00')).toEqual({ red: 0, green: 255, blue: 0, alpha: 255 })
  })

  it('hex #RGB 与 #RRGGBBAA', () => {
    expect(parseRgba('#f00')).toEqual({ red: 255, green: 0, blue: 0, alpha: 255 })
    expect(parseRgba('#ff000080')).toEqual({ red: 255, green: 0, blue: 0, alpha: 128 })
  })

  it('rgba / rgb', () => {
    expect(parseRgba('rgba(255, 0, 0, 1)')).toEqual({ red: 255, green: 0, blue: 0, alpha: 255 })
    expect(parseRgba('rgb(0, 128, 255)')).toEqual({ red: 0, green: 128, blue: 255, alpha: 255 })
    expect(parseRgba('rgba(10, 20, 30, 0.5)')).toEqual({ red: 10, green: 20, blue: 30, alpha: 128 })
  })

  it('非法输入回退黑色', () => {
    expect(parseRgba('')).toEqual({ red: 0, green: 0, blue: 0, alpha: 255 })
    expect(parseRgba('not-a-color')).toEqual({ red: 0, green: 0, blue: 0, alpha: 255 })
  })
})

describe('彩色字体端到端（hex 颜色 → COLR/CPAL）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function triangle(offset: number): Array<{
    type: PathType
    start: { x: number; y: number }
    end: { x: number; y: number }
    control?: { x: number; y: number }
    control1?: { x: number; y: number }
    control2?: { x: number; y: number }
  }> {
    return [
      { type: PathType.LINE, start: { x: offset, y: 0 }, end: { x: offset + 200, y: 0 } },
      { type: PathType.LINE, start: { x: offset + 200, y: 0 }, end: { x: offset + 100, y: 200 } },
      { type: PathType.LINE, start: { x: offset + 100, y: 200 }, end: { x: offset, y: 0 } },
    ]
  }

  it('hex 颜色的图层生成正确的 CPAL 调色板', async () => {
    const char = {
      unicode: 0x41,
      name: 'A',
      contours: triangle(0) as never,
      contourNum: 1,
      advanceWidth: 500,
      leftSideBearing: 0,
      layers: [
        { fillColor: '#ff0000', contours: [triangle(0)] as never, contourNum: 1 },
        { fillColor: '#00ff00', contours: [triangle(100)] as never, contourNum: 1 },
      ],
    }
    const font = await create([char] as never, {
      familyName: 'ColorTest',
      styleName: 'Regular',
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      contourStorage: 'cff',
      isColorFont: true,
      tables: undefined,
    } as never)
    const buffer = toArrayBuffer(font) as ArrayBuffer

    // 直接扫描 SFNT 表目录（parse 不导出 CPAL/COLR）
    const dv = new DataView(buffer)
    const numTables = dv.getUint16(4)
    const tables: Record<string, { offset: number; length: number }> = {}
    for (let i = 0; i < numTables; i++) {
      const entry = 12 + i * 16
      let tag = ''
      for (let j = 0; j < 4; j++) tag += String.fromCharCode(dv.getUint8(entry + j))
      tables[tag] = {
        offset: dv.getUint32(entry + 8),
        length: dv.getUint32(entry + 12),
      }
    }
    expect(tables['CPAL']).toBeTruthy()
    expect(tables['COLR']).toBeTruthy()

    // CPAL：numColorRecords + 颜色记录（BGRA）
    const cpal = tables['CPAL']
    const numColorRecords = dv.getUint16(cpal.offset + 6)
    const offsetFirstColorRecord = dv.getUint32(cpal.offset + 8)
    const colors: Array<{ r: number; g: number; b: number; a: number }> = []
    for (let i = 0; i < numColorRecords; i++) {
      const o = cpal.offset + offsetFirstColorRecord + i * 4
      colors.push({
        b: dv.getUint8(o),
        g: dv.getUint8(o + 1),
        r: dv.getUint8(o + 2),
        a: dv.getUint8(o + 3),
      })
    }
    expect(colors.map((c) => ({ r: c.r, g: c.g, b: c.b }))).toContainEqual({ r: 255, g: 0, b: 0 })
    expect(colors.map((c) => ({ r: c.r, g: c.g, b: c.b }))).toContainEqual({ r: 0, g: 255, b: 0 })

    // COLR v0：numBaseGlyphRecords + 基础字形记录 numLayers
    const colr = tables['COLR']
    expect(dv.getUint16(colr.offset)).toBe(0)
    const numBase = dv.getUint16(colr.offset + 2)
    expect(numBase).toBeGreaterThan(0)
    const baseGlyphOffset = dv.getUint32(colr.offset + 4)
    const layerOffset = dv.getUint32(colr.offset + 8)
    const baseRecord = colr.offset + baseGlyphOffset
    expect(dv.getUint16(baseRecord)).toBe(0) // glyphID 0
    expect(dv.getUint16(baseRecord + 4)).toBe(2) // numLayers = 2
    const numLayerRecords = dv.getUint16(colr.offset + 12)
    expect(numLayerRecords).toBe(2)
    // 首个 layerRecord 的 paletteIndex 应为红色
    const layerRecord = colr.offset + layerOffset
    const redPaletteIndex = colors.findIndex((c) => c.r === 255 && c.g === 0 && c.b === 0)
    expect(dv.getUint16(layerRecord + 2)).toBe(redPaletteIndex)
  })
})
