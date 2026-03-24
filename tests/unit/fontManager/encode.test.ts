import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encoder, setByesAt } from '@/fontManager/encode'

describe('fontManager encode', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uint8 / int8', () => {
    expect(encoder.uint8(10)).toEqual([10])
    expect(encoder.uint8(300)).toBe(false)
    expect(encoder.int8(-10)).toEqual([-10])
    expect(encoder.int8(0)).toEqual([0])
  })

  it('uint16 endian', () => {
    expect(encoder.uint16(0x0102)).toEqual([1, 2])
  })

  it('int16 with LIMIT16 wrap branch', () => {
    const b = encoder.int16(32767)
    expect(Array.isArray(b)).toBe(true)
    expect(b!.length).toBe(2)
  })

  it('uint24 / uint32 / int32', () => {
    expect(encoder.uint24(0x010203)).toEqual([1, 2, 3])
    expect(encoder.uint32(0x01020304)).toEqual([1, 2, 3, 4])
    expect(Array.isArray(encoder.int32(-1))).toBe(true)
    expect(encoder.uint24('x' as any)).toBe(false)
  })

  it('Fixed', () => {
    const r = encoder.Fixed(1.0)
    expect(Array.isArray(r)).toBe(true)
    expect(r!.length).toBe(4)
  })

  it('Tag string and ITag object', () => {
    expect(encoder.Tag('cmap')).toEqual([99, 109, 97, 112])
    expect(
      encoder.Tag({ tagStr: 'head', tagArr: [0, 0, 0, 0] } as any),
    ).toEqual([104, 101, 97, 100])
    expect(encoder.Tag('no')).toBe(false)
  })

  it('String / utf16 / Name', () => {
    expect(encoder.String('AB')).toEqual([65, 66])
    expect(encoder.Name('x')).toEqual([120])
    expect(encoder.utf16('A')).toEqual([0, 65])
  })

  it('number / number16 / number32', () => {
    expect(encoder.number(0)).toEqual([139])
    expect(encoder.number(200)).toHaveLength(2)
    expect(encoder.number16(1000)).toEqual([28, 3, 232])
    expect(encoder.number32(0x01020304)).toEqual([29, 1, 2, 3, 4])
    expect(encoder.number16('x' as any)).toEqual([])
  })

  it('Operand branches', () => {
    expect(encoder.Operand(1, 'SID')).toBeTruthy()
    expect(encoder.Operand(4, 'offset')).toBeTruthy()
    expect(encoder.Operand(2, 'number')).toBeTruthy()
    expect(encoder.Operand(1.5, 'real')).toBeTruthy()
    expect(encoder.Operand(1, 'Fixed')).toBeTruthy()
    expect(encoder.Operand(1, 'number16')).toBeTruthy()
    expect(encoder.Operand(1, 'number32')).toBeTruthy()
    expect(() => encoder.Operand(1, 'unknown' as any)).toThrow('Unknown operand type')
    expect(
      encoder.Operand([1, 2] as any, ['number', 'number'] as any),
    ).toBeTruthy()
  })

  it('Operator', () => {
    expect(encoder.Operator(10)).toEqual([10])
    expect(encoder.Operator(1200)).toEqual([12, 0])
  })

  it('setByesAt', () => {
    const data = [0, 0, 0, 0]
    setByesAt(data, [9, 8], 1)
    expect(data).toEqual([0, 9, 8, 0])
  })

  it('Version16Dot16', () => {
    const v = encoder.Version16Dot16(0x00010000)
    expect(v).toEqual([0, 1, 0, 0])
  })
})
