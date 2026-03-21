import { describe, it, expect } from 'vitest'
import { findContoursCCOMP_TS, hierarchyParent, rgbaToBinaryMask, reversePixelsData } from '@/features/image-import'

function solidSquareMask(size: number, inset: number): Uint8Array {
  const w = size
  const h = size
  const m = new Uint8Array(w * h)
  for (let y = inset; y < size - inset; y++) {
    for (let x = inset; x < size - inset; x++) {
      m[y * w + x] = 255
    }
  }
  return m
}

describe('findContoursCCOMP_TS', () => {
  it('single filled square has one outer contour with parent -1', () => {
    const w = 12
    const m = solidSquareMask(w, 2)
    const { contours, hierarchy } = findContoursCCOMP_TS(m, w, w)
    expect(contours.length).toBeGreaterThanOrEqual(1)
    const outers = contours.map((_, i) => hierarchyParent(hierarchy, i)).filter((p) => p === -1)
    expect(outers.length).toBeGreaterThanOrEqual(1)
  })

  it('ring has inner contour with non-negative parent', () => {
    const w = 24
    const m = solidSquareMask(w, 2)
    // carve hole
    for (let y = 9; y <= 14; y++) {
      for (let x = 9; x <= 14; x++) {
        m[y * w + x] = 0
      }
    }
    const { contours, hierarchy } = findContoursCCOMP_TS(m, w, w)
    expect(contours.length).toBe(2)
    const parents = contours.map((_, i) => hierarchyParent(hierarchy, i))
    expect(parents.filter((p) => p === -1).length).toBe(1)
    expect(parents.some((p) => p >= 0)).toBe(true)
  })
})

describe('pipeline rgba mask', () => {
  it('reverse + gray threshold yields contours', () => {
    const w = 8
    const h = 8
    const rgba = new Uint8ClampedArray(w * h * 4)
    for (let y = 2; y < 6; y++) {
      for (let x = 2; x < 6; x++) {
        const i = (y * w + x) * 4
        rgba[i] = 255
        rgba[i + 1] = 255
        rgba[i + 2] = 255
        rgba[i + 3] = 1
      }
    }
    const rev = reversePixelsData(rgba, w, h)
    const mask = rgbaToBinaryMask(rev, w, h, 120)
    const { contours } = findContoursCCOMP_TS(mask, w, h)
    expect(contours.length).toBeGreaterThanOrEqual(1)
  })
})
