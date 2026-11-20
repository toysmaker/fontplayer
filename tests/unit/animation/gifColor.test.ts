import { describe, it, expect } from 'vitest'
import { createGifWriter } from '@/features/animation/gifEncoder'

function parseHeader(bytes: Uint8Array): { palette: Array<[number, number, number]> } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // GIF89a(6) + LSD(7) = 13 字节后是 GCT
  const palette: Array<[number, number, number]> = []
  for (let i = 0; i < 256; i++) {
    palette.push([dv.getUint8(13 + i * 3), dv.getUint8(13 + i * 3 + 1), dv.getUint8(13 + i * 3 + 2)])
  }
  return { palette }
}

describe('彩色 GIF 编码器', () => {
  it('彩色模式使用 216 色立方调色板（含红绿蓝）', () => {
    const writer = createGifWriter(2, 1, 10, false, true)
    const bytes = writer.finish()
    const { palette } = parseHeader(bytes)
    // 首 216 色为 6×6×6 立方：索引 0 = 黑，索引 215 = 白
    expect(palette[0]).toEqual([0, 0, 0])
    expect(palette[215]).toEqual([255, 255, 255])
    // 纯红 (255,0,0) → rl=5,gl=0,bl=0 → 索引 5*36=180
    expect(palette[180]).toEqual([255, 0, 0])
    // 纯绿 → gl=5 → 索引 5*6=30
    expect(palette[30]).toEqual([0, 255, 0])
    // 纯蓝 → bl=5 → 索引 5
    expect(palette[5]).toEqual([0, 0, 255])
  })

  it('灰度模式保持灰度渐变调色板', () => {
    const writer = createGifWriter(2, 1, 10, false, false)
    const bytes = writer.finish()
    const { palette } = parseHeader(bytes)
    expect(palette[0]).toEqual([0, 0, 0])
    expect(palette[255]).toEqual([255, 255, 255])
    expect(palette[128]).toEqual([128, 128, 128])
  })

  it('彩色模式 writeFrame 接收 RGBA 并完成编码（不抛错、含 trailer）', () => {
    const writer = createGifWriter(2, 1, 10, false, true)
    writer.writeFrame(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255])) // 红 + 绿
    const bytes = writer.finish()
    expect(bytes[0]).toBe(0x47) // 'G'
    expect(bytes[bytes.length - 1]).toBe(0x3b) // trailer
  })
})
