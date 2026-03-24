import { describe, it, expect, vi } from 'vitest'
import { PathType, getMetrics, drawByOption, drawByFont } from '@/fontManager/character'

describe('fontManager character', () => {
  const lineContour = [
    {
      type: PathType.LINE,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      fill: true,
    },
    {
      type: PathType.LINE,
      start: { x: 100, y: 0 },
      end: { x: 100, y: 200 },
    },
    {
      type: PathType.LINE,
      start: { x: 100, y: 200 },
      end: { x: 0, y: 200 },
    },
    {
      type: PathType.LINE,
      start: { x: 0, y: 200 },
      end: { x: 0, y: 0 },
    },
  ]

  it('getMetrics with lines', () => {
    const m = getMetrics({
      unicode: 65,
      contours: [lineContour],
      contourNum: 1,
      advanceWidth: 500,
    })
    expect(m.xMin).toBe(0)
    expect(m.xMax).toBe(100)
    expect(m.yMin).toBe(0)
    expect(m.yMax).toBe(200)
  })

  it('getMetrics empty contours uses finite fallbacks', () => {
    const m = getMetrics({
      unicode: 32,
      contours: [],
      contourNum: 0,
      advanceWidth: 400,
    })
    expect(m.xMax).toBe(400)
  })

  it('getMetrics quadratic and cubic control points', () => {
    const m = getMetrics({
      unicode: 66,
      contours: [
        [
          {
            type: PathType.QUADRATIC_BEZIER,
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
            control: { x: 5, y: 20 },
          },
        ],
        [
          {
            type: PathType.CUBIC_BEZIER,
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
            control1: { x: 2, y: 5 },
            control2: { x: 8, y: 5 },
          },
        ],
      ],
      contourNum: 2,
      advanceWidth: 200,
    })
    expect(m.yMax).toBeGreaterThanOrEqual(20)
  })

  it('drawByOption runs without throw', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    expect(() =>
      drawByOption([lineContour], { unitsPerEm: 1000, descender: -200, advanceWidth: 500 }, canvas),
    ).not.toThrow()
  })

  it('drawByFont skips when character missing', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d') as any
    const clearSpy = vi.spyOn(ctx, 'clearRect')
    drawByFont(
      {
        characters: [],
        settings: { unitsPerEm: 1000, ascender: 800 },
      } as any,
      999,
      canvas,
    )
    expect(clearSpy).not.toHaveBeenCalled()
  })

  it('drawByFont runs when character exists', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    expect(() =>
      drawByFont(
        {
          characters: [
            {
              unicode: 65,
              advanceWidth: 500,
              contours: [lineContour],
            },
          ],
          settings: { unitsPerEm: 1000, ascender: 800 },
        } as any,
        65,
        canvas,
      ),
    ).not.toThrow()
  })
})
