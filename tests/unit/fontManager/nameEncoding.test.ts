/**
 * name 表多平台/多编码解码测试：
 * Windows（UTF-16BE、GBK、ShiftJIS、Big5）与 Mac（Roman、GB2312）记录均须正确解码，
 * 期望值由 iconv-lite 生成（仅测试环境依赖，浏览器运行时代码不依赖 iconv/Buffer）。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import iconv from 'iconv-lite'
import { getStorageString } from '@/fontManager/utils'

function makeView(bytes: number[], padBefore = 0): { dv: DataView; offset: number } {
  const total = padBefore + bytes.length
  const ab = new ArrayBuffer(total)
  const u8 = new Uint8Array(ab)
  for (let i = 0; i < bytes.length; i++) u8[padBefore + i] = bytes[i]
  return { dv: new DataView(ab), offset: padBefore }
}

const toBytes = (b: Buffer | Uint8Array): number[] => Array.from(b)

describe('name table multi-platform decoding', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it('decodes Windows Unicode (3,1) UTF-16BE', () => {
    const text = '字玩标准黑体 Regular'
    const bytes: number[] = []
    for (const ch of text) {
      const c = ch.charCodeAt(0)
      bytes.push((c >> 8) & 0xff, c & 0xff)
    }
    const { dv, offset } = makeView(bytes, 3)
    expect(getStorageString(dv, offset, bytes.length, 3, 1)).toBe(text)
  })

  it('decodes Windows GBK (3,3)', () => {
    for (const text of ['中文测试', '山海国潮字体']) {
      const bytes = toBytes(iconv.encode(text, 'gbk'))
      const { dv, offset } = makeView(bytes)
      expect(getStorageString(dv, offset, bytes.length, 3, 3)).toBe(text)
    }
  })

  it('decodes Windows Shift-JIS (3,2)', () => {
    const text = '日本語テスト'
    const bytes = toBytes(iconv.encode(text, 'shift_jis'))
    const { dv, offset } = makeView(bytes)
    expect(getStorageString(dv, offset, bytes.length, 3, 2)).toBe(text)
  })

  it('decodes Windows Big5 (3,4)', () => {
    const text = '繁體中文測試'
    const bytes = toBytes(iconv.encode(text, 'big5'))
    const { dv, offset } = makeView(bytes)
    expect(getStorageString(dv, offset, bytes.length, 3, 4)).toBe(text)
  })

  it('decodes Mac Roman (1,0) high bytes', () => {
    const bytes = [0x8e, 0x91, 0xa9, 0xca] // é í © nbsp
    const expected = iconv.decode(Buffer.from(bytes), 'macintosh')
    const { dv, offset } = makeView(bytes)
    expect(getStorageString(dv, offset, bytes.length, 1, 0)).toBe(expected)
  })

  it('decodes Mac Simplified Chinese (1,25) GB2312/GBK', () => {
    const text = '字体测试'
    const bytes = toBytes(iconv.encode(text, 'gbk'))
    const { dv, offset } = makeView(bytes)
    expect(getStorageString(dv, offset, bytes.length, 1, 25)).toBe(text)
  })

  it('guards out-of-bounds reads', () => {
    const { dv } = makeView([0x41, 0x42])
    expect(getStorageString(dv, 0, 100, 3, 1)).toBe('')
    expect(getStorageString(dv, -1, 2, 3, 1)).toBe('')
    expect(getStorageString(dv, 1, 2, 3, 1)).toBe('')
  })

  it('built-in Mac Roman fallback table matches WHATWG TextDecoder for all 256 bytes', () => {
    // 1. 正常路径（TextDecoder 可用）与 WHATWG 参考一致
    const bytes = Array.from({ length: 256 }, (_, i) => i)
    const expected = new TextDecoder('macintosh').decode(new Uint8Array(bytes))
    const { dv } = makeView(bytes)
    expect(getStorageString(dv, 0, bytes.length, 1, 0)).toBe(expected)

    // 2. 禁用 TextDecoder('macintosh') 后走内置回退表，结果仍与 WHATWG 一致
    //    （注意：iconv-lite 的 macintosh 与 WHATWG 在 0xBD/0xDB/0xF0 三处不一致，
    //    内置表以 WHATWG 为准，与浏览器 TextDecoder 行为对齐）
    const OriginalTextDecoder = globalThis.TextDecoder
    const throwingDecoder = function (label?: string) {
      if (label === 'macintosh') throw new Error('macintosh unsupported in this env')
      return new OriginalTextDecoder(label)
    } as unknown as typeof TextDecoder
    ;(globalThis as any).TextDecoder = throwingDecoder
    try {
      expect(getStorageString(dv, 0, bytes.length, 1, 0)).toBe(expected)
    } finally {
      ;(globalThis as any).TextDecoder = OriginalTextDecoder
    }
  })

  it('decodes without Node Buffer global (browser-like)', () => {
    const saved = (globalThis as any).Buffer
    ;(globalThis as any).Buffer = undefined
    try {
      const bytes = toBytes(iconv.encode('中文', 'gbk'))
      const { dv, offset } = makeView(bytes)
      expect(getStorageString(dv, offset, bytes.length, 3, 3)).toBe('中文')
      const macBytes = [0x8e]
      const { dv: dv2 } = makeView(macBytes)
      expect(getStorageString(dv2, 0, macBytes.length, 1, 0)).toBe('é')
    } finally {
      ;(globalThis as any).Buffer = saved
    }
  })
})
