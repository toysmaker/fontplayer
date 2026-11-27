/**
 * OpenType 字段设置导出回归：
 * - head.fontRevision 为 16.16 原始值直写（65542 = 0x00010006，此前 Fixed ×0x10000 溢出截断成 6.0）
 * - OS/2 usMaxContext 透传用户设置（此前硬编码 0）
 * - name 表：用户编辑过的条目（default:false）保留原值；
 *   default:true 条目按工程名同步（0x804 中文 / 0x409 拼音）
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { create, toArrayBuffer, parse } from '@/fontManager'
import { PathType } from '@/fontManager'

describe('OpenType field settings export', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it('writes raw 16.16 fontRevision, usMaxContext, and respects name entry edits', async () => {
    const contour = [
      { type: PathType.LINE, start: { x: 0, y: 0 }, end: { x: 300, y: 0 } },
      { type: PathType.LINE, start: { x: 300, y: 0 }, end: { x: 300, y: 500 } },
      { type: PathType.LINE, start: { x: 300, y: 500 }, end: { x: 0, y: 500 } },
      { type: PathType.LINE, start: { x: 0, y: 500 }, end: { x: 0, y: 0 } },
    ]
    const font = await create(
      [
        { unicode: 0, name: '.notdef', contourNum: 0, contours: [[]], advanceWidth: 1000 },
        { unicode: 0x31, name: '1', contourNum: 1, contours: [contour], advanceWidth: 1000 },
      ],
      {
        familyName: '测试111',
        styleName: 'Regular',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        contourStorage: 'cff',
        tables: {
          head: {
            majorVersion: 5,
            minorVersion: 10,
            fontRevision: 65542, // 16.16 原始值 0x00010006
            lowestRecPPEM: 9,
            fontDirectionHint: 4,
          },
          os2: {
            version: 5,
            usMaxContext: 1,
            usLowerOpticalPointSize: 9,
            usUpperOpticalPointSize: 73,
          },
          name: [
            // 用户编辑过的条目（default:false）必须保留原值
            { nameID: 1, platformID: 3, encodingID: 1, langID: 0x804, value: '测试222', default: false },
            { nameID: 1, platformID: 3, encodingID: 1, langID: 0x409, value: 'test222', default: false },
            // default:true 条目按工程名同步（0x804 中文 / 0x409 拼音）
            { nameID: 4, platformID: 3, encodingID: 1, langID: 0x804, value: '旧值', default: true },
            { nameID: 4, platformID: 3, encodingID: 1, langID: 0x409, value: '旧值', default: true },
            { nameID: 6, platformID: 3, encodingID: 1, langID: 0x409, value: '旧值', default: true },
          ],
        },
      } as any,
    )
    const buf = (await toArrayBuffer(font)) as ArrayBuffer
    expect(buf.byteLength).toBeGreaterThan(0)

    const parsed = parse(buf)
    const headTable = (parsed.tables as any)?.find((t: any) => t.name === 'head')?.table
    expect(headTable.majorVersion).toBe(5)
    expect(headTable.minorVersion).toBe(10)
    // 16.16 原始值直写：0x00010006（≈1.00009），不再被 ×0x10000 溢出截断成 6.0
    expect(headTable.fontRevision).toBe(0x00010006)
    expect(headTable.lowestRecPPEM).toBe(9)
    expect(headTable.fontDirectionHint).toBe(4)

    const os2Table = (parsed.tables as any)?.find((t: any) => t.name === 'OS/2')?.table
    expect(os2Table.usMaxContext, 'usMaxContext must pass through user value').toBe(1)
    expect(os2Table.usLowerOpticalPointSize).toBe(9)
    expect(os2Table.usUpperOpticalPointSize).toBe(73)

    const nameTable = (parsed.tables as any)?.find((t: any) => t.name === 'name')?.table
    const rec = (nid: number, lang: number) =>
      nameTable?.nameRecord?.find((r: any) => r.nameID === nid && r.languageID === lang)?.str
    expect(rec(1, 0x804), 'user-edited zh family must be kept').toBe('测试222')
    expect(rec(1, 0x409), 'user-edited en family must be kept').toBe('test222')
    expect(rec(4, 0x804), 'default zh fullName synced with raw project name').toBe('测试111 常规体')
    expect(rec(4, 0x409), 'default en fullName synced with pinyin').toBe('CESHI111 Regular')
    expect(rec(6, 0x409), 'default postScriptName synced with pinyin').toBe('CESHI111-Regular')
  })
})
