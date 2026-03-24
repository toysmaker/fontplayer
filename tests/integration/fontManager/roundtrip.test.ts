import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { create, parse, toArrayBuffer, hasChar, getBytes } from '@/fontManager'
import { PathType } from '@/fontManager'

/**
 * create → toArrayBuffer → parse 闭环（与设计文档「导出字体」对应）
 */
describe('fontManager integration roundtrip', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('roundtrip-minimal: single glyph A', async () => {
    const contour = [
      { type: PathType.LINE, start: { x: 0, y: 0 }, end: { x: 300, y: 0 } },
      { type: PathType.LINE, start: { x: 300, y: 0 }, end: { x: 300, y: 500 } },
      { type: PathType.LINE, start: { x: 300, y: 500 }, end: { x: 0, y: 500 } },
      { type: PathType.LINE, start: { x: 0, y: 500 }, end: { x: 0, y: 0 } },
    ]
    const font = await create(
      [
        {
          unicode: 65,
          contourNum: 1,
          contours: [contour],
          advanceWidth: 600,
        },
      ],
      {
        familyName: 'RoundtripFont',
        styleName: 'Regular',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
      },
    )
    const buf = toArrayBuffer(font)
    expect(buf?.byteLength).toBeGreaterThan(0)
    const parsed = parse(buf!)
    expect(parsed.settings?.unitsPerEm).toBe(1000)
    expect(hasChar(parsed, 'A')).toBe(true)
    if (parsed.tables?.length && buf) {
      const slices = getBytes(buf, parsed.tables)
      expect(slices.length).toBe(parsed.tables.length)
      expect(slices.every((s) => (s.bytes as ArrayBuffer).byteLength > 0)).toBe(true)
    }
  })
})
