import { describe, it, expect } from 'vitest'
import { validators } from '@/fontManager/validators'

describe('fontManager validators', () => {
  it('uint8', () => {
    expect(validators.uint8(0)).toBe(true)
    expect(validators.uint8(255)).toBe(true)
    expect(validators.uint8(-1)).toBe(false)
    expect(validators.uint8(256)).toBe(false)
    expect(validators.uint8('x')).toBe(false)
  })

  it('int8', () => {
    expect(validators.int8(-128)).toBe(true)
    expect(validators.int8(127)).toBe(true)
    expect(validators.int8(-129)).toBe(false)
    expect(validators.int8(128)).toBe(false)
  })

  it('numeric types accept numbers only', () => {
    expect(validators.uint16(0)).toBe(true)
    expect(validators.uint16('a')).toBe(false)
    expect(validators.int16(0)).toBe(true)
    expect(validators.int16(null as any)).toBe(false)
    expect(validators.uint24(0)).toBe(true)
    expect(validators.uint32(0)).toBe(true)
    expect(validators.int32(0)).toBe(true)
    expect(validators.Fixed(1.5)).toBe(true)
    expect(validators.FWORD(0)).toBe(true)
    expect(validators.UFWORD(0)).toBe(true)
  })

  it('LONGDATETIME', () => {
    expect(validators.LONGDATETIME(2082844801)).toBe(true)
    expect(validators.LONGDATETIME('x' as any)).toBe(false)
  })

  it('Tag', () => {
    expect(validators.Tag('head')).toBe(true)
    expect(validators.Tag('abc')).toBe(false)
    expect(validators.Tag('toolong')).toBe(false)
  })
})
