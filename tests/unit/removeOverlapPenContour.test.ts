import { describe, it, expect } from 'vitest'
import { genPenContour } from '@/core/utils/contour'

/**
 * 去重叠后 path → pen 点列 → genPenContour：点列须为链式钢笔格式，否则多段曲线会只剩第一段
 * （表现为局部变直，如「入」字撇的上弧丢失）。
 */
describe('remove overlap pen → contour indexing', () => {
  const twoSegmentPenPoints = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
    { x: 30, y: 30 },
    { x: 40, y: 40 },
    { x: 50, y: 50 },
    { x: 60, y: 60 },
  ]

  it('genPenContour expects chained points (overlap at segment joints), not i+=4 chunks', () => {
    const wrongFlat: { x: number; y: number }[] = []
    for (let i = 0; i + 3 < twoSegmentPenPoints.length; i += 4) {
      wrongFlat.push(
        { x: twoSegmentPenPoints[i].x, y: twoSegmentPenPoints[i].y },
        { x: twoSegmentPenPoints[i + 1].x, y: twoSegmentPenPoints[i + 1].y },
        { x: twoSegmentPenPoints[i + 2].x, y: twoSegmentPenPoints[i + 2].y },
        { x: twoSegmentPenPoints[i + 3].x, y: twoSegmentPenPoints[i + 3].y }
      )
    }
    expect(wrongFlat.length).toBe(4)
    expect(genPenContour(wrongFlat, false).length).toBe(1)

    const rightFlat = twoSegmentPenPoints.map((p) => ({ x: p.x, y: p.y }))
    expect(genPenContour(rightFlat, false).length).toBe(2)
  })
})
