import { describe, it, expect } from 'vitest'
import { PathType } from '@/fontManager/character'
import {
  convertContoursToQuadratic,
  convertCubicToQuadraticSimple,
} from '@/fontManager/utils/cubicToQuadratic'

describe('fontManager cubicToQuadratic', () => {
  const cubic: any = {
    type: PathType.CUBIC_BEZIER,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    control1: { x: 30, y: 50 },
    control2: { x: 70, y: 50 },
  }

  it('convertCubicToQuadraticSimple returns segments', () => {
    const out = convertCubicToQuadraticSimple(cubic)
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBeGreaterThan(0)
  })

  it('convertContoursToQuadratic maps contours', () => {
    const line = {
      type: PathType.LINE,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    }
    const q1 = convertContoursToQuadratic([[line]], 0.5, true)
    expect(q1[0].length).toBeGreaterThan(0)
    const q2 = convertContoursToQuadratic([[cubic]], 0.5, false)
    expect(q2[0].length).toBeGreaterThan(0)
  })
})
