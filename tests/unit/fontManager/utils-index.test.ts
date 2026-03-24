import { describe, it, expect } from 'vitest'
import {
  getTag,
  getVersion,
  getStorageString,
  computeCheckSum,
  hasChineseChar,
  isChineseChar,
} from '@/fontManager/utils'

describe('fontManager utils/index', () => {
  it('getTag', () => {
    const buf = new ArrayBuffer(8)
    const dv = new DataView(buf)
    dv.setUint8(0, 99)
    dv.setUint8(1, 109)
    dv.setUint8(2, 97)
    dv.setUint8(3, 112)
    const t = getTag(dv, 0)
    expect(t.tagStr).toBe('cmap')
    expect(t.tagArr).toEqual([99, 109, 97, 112])
  })

  it('getVersion', () => {
    const buf = new ArrayBuffer(4)
    const dv = new DataView(buf)
    dv.setUint16(0, 1, false)
    dv.setUint16(2, 0, false)
    expect(getVersion(dv, 0)).toBeGreaterThan(0)
  })

  it('getStorageString', () => {
    const buf = new ArrayBuffer(6)
    const dv = new DataView(buf)
    dv.setUint16(0, 65, false)
    dv.setUint16(2, 66, false)
    dv.setUint16(4, 67, false)
    expect(getStorageString(dv, 0, 6)).toBe('ABC')
  })

  it('computeCheckSum pads to multiple of 4', () => {
    expect(computeCheckSum([1, 2, 3])).toBe(computeCheckSum([1, 2, 3, 0]))
    expect(typeof computeCheckSum([0, 0, 0, 0])).toBe('number')
    expect(computeCheckSum([1, 2, 3, 4], true)).toBeGreaterThanOrEqual(0)
  })

  it('isChineseChar / hasChineseChar', () => {
    expect(isChineseChar('字')).toBe(true)
    expect(isChineseChar('A')).toBe(false)
    expect(hasChineseChar('ab字')).toBe(true)
    expect(hasChineseChar('ab')).toBe(false)
  })
})
