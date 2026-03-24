import { describe, it, expect, beforeEach } from 'vitest'
import { start, end, decoder, getOffset, setOffset } from '@/fontManager/decode'

function viewFromBytes(bytes: number[]) {
  const buf = new ArrayBuffer(bytes.length)
  const u8 = new Uint8Array(buf)
  bytes.forEach((b, i) => {
    u8[i] = b
  })
  return new DataView(buf)
}

describe('fontManager decode', () => {
  beforeEach(() => {
    end()
  })

  it('uint8 / int8', () => {
    start(viewFromBytes([0xfe, 0x02]), 0)
    expect(decoder.uint8()).toBe(0xfe)
    expect(decoder.int8()).toBe(2)
    expect(getOffset()).toBe(2)
  })

  it('uint16 / int16', () => {
    start(viewFromBytes([0x01, 0x02, 0xff, 0xfe]), 0)
    expect(decoder.uint16()).toBe(0x0102)
    expect(decoder.int16()).toBe(-2)
  })

  it('uint24 / uint32 / int32', () => {
    const bytes = [1, 2, 3, 4, 5, 6, 7, 8, 0xff, 0xff, 0xff, 0xff]
    start(viewFromBytes(bytes), 0)
    expect(decoder.uint24()).toBe(0x010203)
    expect(decoder.uint32()).toBe(0x04050607)
    expect(typeof decoder.int32()).toBe('number')
  })

  it('bigInt / Fixed / FWORD / UFWORD / F2DOT14', () => {
    const buf = new ArrayBuffer(32)
    const dv = new DataView(buf)
    dv.setBigInt64(0, BigInt(40), false)
    start(dv, 0)
    expect(decoder.bigInt()).toBe(BigInt(40))
    dv.setInt32(0, 0x00010000, false)
    start(dv, 0)
    expect(decoder.Fixed()).toBe(0x00010000)
    dv.setInt16(0, -5, false)
    start(dv, 0)
    expect(decoder.FWORD()).toBe(-5)
    dv.setUint16(0, 500, false)
    start(dv, 0)
    expect(decoder.UFWORD()).toBe(500)
    dv.setInt16(0, 8192, false)
    start(dv, 0)
    expect(decoder.F2DOT14()).toBeCloseTo(0.5, 5)
  })

  it('LONGDATETIME / Tag / offsets / Version16Dot16 / Card', () => {
    const buf = new ArrayBuffer(64)
    const dv = new DataView(buf)
    dv.setBigInt64(0, BigInt(2082844801), false)
    start(dv, 0)
    expect(typeof decoder.LONGDATETIME()).toBe('number')
    const tagBytes = [99, 109, 97, 112]
    start(viewFromBytes(tagBytes), 0)
    const tag = decoder.Tag()
    expect(tag.tagStr).toBe('cmap')
    start(viewFromBytes([0, 7]), 0)
    expect(decoder.Offset16()).toBe(7)
    start(viewFromBytes([0, 0, 0, 9]), 0)
    expect(decoder.Offset32()).toBe(9)
    dv.setUint16(0, 1, false)
    dv.setUint16(2, 0, false)
    start(dv, 0)
    expect(decoder.Version16Dot16()).toBeGreaterThan(0)
    start(viewFromBytes([3]), 0)
    expect(decoder.Card8()).toBe(3)
    start(viewFromBytes([0, 4]), 0)
    expect(decoder.Card16()).toBe(4)
    start(viewFromBytes([2]), 0)
    expect(decoder.OffSize()).toBe(2)
    start(viewFromBytes([0, 5]), 0)
    expect(decoder.SID()).toBe(5)
  })

  it('setOffset and end reset', () => {
    start(viewFromBytes([1, 2, 3]), 0)
    setOffset(2)
    expect(getOffset()).toBe(2)
    end()
    expect(getOffset()).toBe(0)
  })
})
