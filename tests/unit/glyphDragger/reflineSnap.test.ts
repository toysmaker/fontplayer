/**
 * reflineSnap 单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  collectStraightAxisLinesFromPenComponents,
  evaluateSnapReflineSticky,
  getSnapRefline,
  mergeSnapAxisLines,
} from '@/features/tools/glyphDragger/core/reflineSnap'

describe('reflineSnap', () => {
  describe('collectStraightAxisLinesFromPenComponents', () => {
    it('extracts horizontal line from degenerate cubic segment', () => {
      const components = [
        {
          type: 'glyph-pen',
          points: [
            { x: 0, y: 100 },
            { x: 0, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 100 },
          ],
        },
      ]
      const lines = collectStraightAxisLinesFromPenComponents(components, 10, 5)
      const h = lines.filter((l) => l.type === 'horizontal')
      expect(h.length).toBe(1)
      expect(h[0].coord).toBeCloseTo(105)
    })

    it('extracts vertical line from degenerate cubic segment', () => {
      const components = [
        {
          type: 'glyph-pen',
          points: [
            { x: 50, y: 0 },
            { x: 50, y: 0 },
            { x: 50, y: 300 },
            { x: 50, y: 300 },
          ],
        },
      ]
      const lines = collectStraightAxisLinesFromPenComponents(components, 0, 0)
      const v = lines.filter((l) => l.type === 'vertical')
      expect(v.length).toBe(1)
      expect(v[0].coord).toBeCloseTo(50)
    })

    it('returns empty for non-pen or short points', () => {
      expect(collectStraightAxisLinesFromPenComponents([], 0, 0)).toEqual([])
      expect(
        collectStraightAxisLinesFromPenComponents(
          [{ type: 'glyph-pen', points: [{ x: 0, y: 0 }] }],
          0,
          0,
        ),
      ).toEqual([])
    })
  })

  describe('getSnapRefline', () => {
    it('returns null when no pair within distance', () => {
      expect(
        getSnapRefline(
          [{ type: 'horizontal', coord: 0 }],
          [{ type: 'horizontal', coord: 100 }],
          20,
        ),
      ).toBeNull()
    })

    it('returns dy for horizontal snap', () => {
      const snap = getSnapRefline(
        [{ type: 'horizontal', coord: 100 }],
        [{ type: 'horizontal', coord: 92 }],
        20,
      )
      expect(snap).toEqual({ dx: 0, dy: 8 })
    })

    it('returns dx for vertical snap', () => {
      const snap = getSnapRefline(
        [{ type: 'vertical', coord: 500 }],
        [{ type: 'vertical', coord: 488 }],
        20,
      )
      expect(snap).toEqual({ dx: 12, dy: 0 })
    })

    it('picks closest pair when multiple match', () => {
      const snap = getSnapRefline(
        [
          { type: 'horizontal', coord: 100 },
          { type: 'horizontal', coord: 105 },
        ],
        [{ type: 'horizontal', coord: 103 }],
        20,
      )
      expect(snap).toEqual({ dx: 0, dy: 2 })
    })

    it('combines best horizontal and vertical snaps independently', () => {
      const snap = getSnapRefline(
        [
          { type: 'horizontal', coord: 100 },
          { type: 'vertical', coord: 50 },
        ],
        [
          { type: 'horizontal', coord: 104 },
          { type: 'vertical', coord: 52 },
        ],
        20,
      )
      expect(snap).toEqual({ dx: -2, dy: -4 })
    })
  })

  describe('evaluateSnapReflineSticky', () => {
    it('keeps same horizontal key target until ref pulls past snapOut', () => {
      const key = [{ type: 'horizontal' as const, coord: 100 }]
      const refNear = [{ type: 'horizontal' as const, coord: 85 }]
      const r0 = evaluateSnapReflineSticky(key, refNear, 20, 24, null, null)
      expect(r0.lockHNext).toBe(100)
      expect(r0.dy).toBe(15)

      const refMid = [{ type: 'horizontal' as const, coord: 78 }]
      const r1 = evaluateSnapReflineSticky(key, refMid, 20, 24, 100, null)
      expect(r1.lockHNext).toBe(100)
      expect(r1.dy).toBe(22)

      const refOut = [{ type: 'horizontal' as const, coord: 75 }]
      const r2 = evaluateSnapReflineSticky(key, refOut, 20, 24, 100, null)
      expect(r2.lockHNext).toBeNull()
    })
  })

  describe('mergeSnapAxisLines', () => {
    it('dedupes merged groups', () => {
      const merged = mergeSnapAxisLines([
        [
          { type: 'horizontal', coord: 1 },
          { type: 'horizontal', coord: 1 },
        ],
        [{ type: 'vertical', coord: 2 }],
      ])
      expect(merged).toHaveLength(2)
    })
  })
})
