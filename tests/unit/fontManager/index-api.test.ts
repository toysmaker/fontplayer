import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseUrl, getBytes, PathType } from '@/fontManager'

describe('fontManager public API (index)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getBytes slices table ranges from ArrayBuffer', () => {
    const buf = new ArrayBuffer(20)
    const u8 = new Uint8Array(buf)
    for (let i = 0; i < 20; i++) u8[i] = i
    const tables = [
      {
        name: 'a',
        table: null,
        config: { offset: 5, length: 3, checkSum: 0, tableTag: { tagStr: 'aaaa' } },
      },
    ] as any
    const parts = getBytes(buf, tables)
    expect(parts[0].name).toBe('a')
    expect(Array.from(new Uint8Array(parts[0].bytes as ArrayBuffer))).toEqual([5, 6, 7])
  })

  it('parseUrl uses fetch', async () => {
    const small = new Uint8Array([0, 1, 2]).buffer
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(small),
      }),
    )
    await expect(parseUrl('https://example/font.ttf')).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it('PathType is re-exported', () => {
    expect(PathType.LINE).toBe(0)
  })
})
