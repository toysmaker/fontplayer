/**
 * 导出侧 CFF 名称 ASCII 净化回归：
 * 1. 中文家族名导出的 CFF Name INDEX 必须全为可打印 ASCII
 * 2. 用户录入的中文 PostScript 名（nameID 6）在 name 表中被净化
 * 背景：PostScript 名含中文时 encoder.String 逐字节截断产生非法 CFF（fontTools/Windows 拒绝）
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { create, toArrayBuffer, parse } from '@/fontManager'
import { PathType } from '@/fontManager'
import { writeFileSync } from 'node:fs'

describe('CFF name ASCII sanitization', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it('exports valid ASCII CFF names with Chinese familyName and Chinese nameID-6 entry', async () => {
    const contour = [
      { type: PathType.LINE, start: { x: 0, y: 0 }, end: { x: 300, y: 0 } },
      { type: PathType.LINE, start: { x: 300, y: 0 }, end: { x: 300, y: 500 } },
      { type: PathType.LINE, start: { x: 300, y: 500 }, end: { x: 0, y: 500 } },
      { type: PathType.LINE, start: { x: 0, y: 500 }, end: { x: 0, y: 0 } },
    ]
    const font = await create(
      [
        { unicode: 0, name: '.notdef', contourNum: 0, contours: [[]], advanceWidth: 600 },
        { unicode: 65, contourNum: 1, contours: [contour], advanceWidth: 600 },
      ],
      {
        familyName: '字玩测试字体',
        styleName: 'Regular',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        contourStorage: 'cff',
        tables: {
          name: [
            // 模拟用户在更多设置中录入的非 default 中文 PostScript 名
            { nameID: 6, nameLabel: 'postScriptName', platformID: 3, encodingID: 1, langID: 0x409, value: '字WANBIAO准HEITI-Regular', default: false },
            { nameID: 1, nameLabel: 'fontFamily', platformID: 3, encodingID: 1, langID: 0x409, value: '字玩测试字体', default: true },
          ],
        },
      } as any,
    )
    const buf = (await toArrayBuffer(font)) as ArrayBuffer
    expect(buf.byteLength).toBeGreaterThan(0)

    // 扫描 SFNT 目录找到 CFF 表，解析其 Name INDEX，断言全部 ASCII
    const dv = new DataView(buf)
    const numTables = dv.getUint16(4)
    let cffOffset = -1
    let cffLength = 0
    for (let i = 0; i < numTables; i++) {
      const entry = 12 + i * 16
      let tag = ''
      for (let j = 0; j < 4; j++) tag += String.fromCharCode(dv.getUint8(entry + j))
      if (tag === 'CFF ') {
        cffOffset = dv.getUint32(entry + 8)
        cffLength = dv.getUint32(entry + 12)
      }
    }
    expect(cffOffset).toBeGreaterThan(0)

    // CFF header 4 字节后是 Name INDEX：count(uint16) + offSize(uint8) + offsets + strings
    const count = dv.getUint16(cffOffset + 4)
    const offSize = dv.getUint8(cffOffset + 6)
    let p = cffOffset + 7
    const offsets: number[] = []
    for (let i = 0; i < count + 1; i++) {
      let v = 0
      for (let k = 0; k < offSize; k++) v = (v << 8) | dv.getUint8(p + k)
      offsets.push(v)
      p += offSize
    }
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      const start = p + offsets[i] - 1
      const len = offsets[i + 1] - offsets[i]
      let s = ''
      for (let k = 0; k < len; k++) {
        const code = dv.getUint8(start + k)
        // 关键断言：CFF 名称必须为可打印 ASCII
        expect(code, `CFF name[${i}] byte ${k} should be printable ASCII`).toBeGreaterThanOrEqual(0x20)
        expect(code).toBeLessThanOrEqual(0x7e)
        s += String.fromCharCode(code)
      }
      names.push(s)
    }
    expect(names.length).toBe(1)
    expect(names[0]).toContain('-Regular')

    // 回读 name 表：nameID 6 被净化（无中文）
    const parsed = parse(buf)
    const nameTable = (parsed.tables as any)?.find((t: any) => t.name === 'name')?.table
    const psRecords = nameTable?.nameRecord?.filter((r: any) => r.nameID === 6) ?? []
    expect(psRecords.length).toBeGreaterThan(0)
    for (const r of psRecords) {
      expect(r.str, `nameID 6 record should be ASCII, got: ${r.str}`).toMatch(/^[\x21-\x7E]*$/)
    }

    // 供外部 fontTools 校验（可选产物，仅当可写时）
    try {
      writeFileSync('/tmp/fp_export_check.otf', new Uint8Array(buf))
    } catch {
      /* 只读环境忽略 */
    }
  })
})
