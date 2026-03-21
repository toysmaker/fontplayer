import { describe, it, expect } from 'vitest'
import { toBlackWhiteBitMap } from '@/features/image-import/binarize'

describe('toBlackWhiteBitMap', () => {
  it('thresholds rgb per channel', () => {
    const w = 2
    const h = 2
    const data = new Uint8ClampedArray(w * h * 4)
    // (0,0): dark
    // (1,0): r high
    data[4] = 200
    data[5] = 0
    data[6] = 0
    data[7] = 1
    const out = toBlackWhiteBitMap(data, { r: 128, g: 128, b: 128 }, { x: 0, y: 0, size: -1, width: w, height: h })
    expect(out[0]).toBe(0)
    expect(out[4]).toBe(255)
    expect(out[7]).toBe(1)
  })
})
