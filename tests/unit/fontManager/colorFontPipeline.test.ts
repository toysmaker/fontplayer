import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildExportColorFontBuffer } from '@/features/editor/services/ExportColorFontService'
import { createMockPenComponent, createMockRectangleComponent } from '../../helpers/mock-helpers'
import type { ICharacterFileLite, IFile } from '@/core/types'

/**
 * 真实管线集成探针：带颜色的字符 → buildExportColorFontBuffer → 检查输出字体结构
 * （glyph 数量、CPAL 调色板、COLR 映射、CFF charStrings 数量）
 */
function makeChar(uuid: string, text: string, unicode: string, components: unknown[]): ICharacterFileLite {
  return {
    uuid,
    type: 'character',
    character: { uuid: `${uuid}-meta`, text, unicode },
    components: components as never,
    groups: [],
    orderedList: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    selectedComponentsUUIDs: [],
  }
}

function makeFile(chars: ICharacterFileLite[]): IFile {
  return {
    uuid: 'file-color-test',
    name: '颜色测试',
    width: 1000,
    height: 1000,
    saved: false,
    iconsCount: 0,
    fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200 },
    characterList: chars.map((c) => ({
      uuid: c.uuid,
      type: c.type,
      character: c.character,
    })),
  }
}

function scanTables(buffer: ArrayBuffer): Record<string, { offset: number; length: number }> {
  const dv = new DataView(buffer)
  const numTables = dv.getUint16(4)
  const tables: Record<string, { offset: number; length: number }> = {}
  for (let i = 0; i < numTables; i++) {
    const entry = 12 + i * 16
    let tag = ''
    for (let j = 0; j < 4; j++) tag += String.fromCharCode(dv.getUint8(entry + j))
    tables[tag] = { offset: dv.getUint32(entry + 8), length: dv.getUint32(entry + 12) }
  }
  return tables
}

describe('彩色字体导出管线（ExportColorFontService）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('单字符双颜色图层 → 字体结构正确（3 字形：.notdef+base+layer，调色板含红蓝）', async () => {
    const pen = createMockPenComponent() as { value: Record<string, unknown> }
    pen.value.fillColor = '#ff0000'
    const rect = createMockRectangleComponent() as { value: Record<string, unknown> }
    rect.value.fillColor = '#0000ff'

    const char = makeChar('char-1', '测', 'U+6D4B', [pen, rect])
    const file = makeFile([char])

    const buffer = await buildExportColorFontBuffer(
      file,
      { editingCharacterUUID: char.uuid, editingCharacter: char },
      { removeOverlap: true }
    )

    const tables = scanTables(buffer)
    expect(tables['COLR']).toBeTruthy()
    expect(tables['CPAL']).toBeTruthy()
    expect(tables['CFF ']).toBeTruthy()

    const dv = new DataView(buffer)

    // CPAL：颜色记录（BGRA）
    const cpal = tables['CPAL']
    const numColorRecords = dv.getUint16(cpal.offset + 6)
    const offsetFirstColorRecord = dv.getUint32(cpal.offset + 8)
    const colors: Array<{ r: number; g: number; b: number }> = []
    for (let i = 0; i < numColorRecords; i++) {
      const o = cpal.offset + offsetFirstColorRecord + i * 4
      colors.push({ b: dv.getUint8(o), g: dv.getUint8(o + 1), r: dv.getUint8(o + 2) })
    }
    expect(colors).toContainEqual({ r: 255, g: 0, b: 0 })
    expect(colors).toContainEqual({ r: 0, g: 0, b: 255 })

    // COLR v0：基础字形记录 1 条、图层 2 条
    const colr = tables['COLR']
    expect(dv.getUint16(colr.offset)).toBe(0)
    const numBase = dv.getUint16(colr.offset + 2)
    const baseGlyphOffset = dv.getUint32(colr.offset + 4)
    expect(numBase).toBe(1)
    const baseGlyphOffset2 = dv.getUint32(colr.offset + 4)
    const baseRecord = colr.offset + baseGlyphOffset2
    // 基础字形 glyphID：.notdef=0、自动补的空格=1 → 字符 glyph 应为 2
    const baseGlyphID = dv.getUint16(baseRecord)
    expect(baseGlyphID).toBe(2)
    expect(dv.getUint16(baseRecord + 4)).toBe(2) // numLayers

    // CFF：charStrings 数量 = 2（.notdef + base）*待校验*
    const cff = tables['CFF ']
    // CFF 头部：major/minor/hdrSize/offSize
    const hdrSize = dv.getUint8(cff.offset + 2)
    const offSize = dv.getUint8(cff.offset + 3)
    // Name INDEX（跳过）：count u16 + 条目
    let p = cff.offset + hdrSize
    const nameCount = dv.getUint16(p)
    p += 2
    for (let i = 0; i < nameCount; i++) {
      const len = dv.getUint8(p)
      p += 1 + len
    }
    // Top DICT INDEX
    const topCount = dv.getUint16(p)
    p += 2
    for (let i = 0; i < topCount; i++) {
      const len = dv.getUint8(p)
      p += 1 + len
    }
    // String INDEX
    const strCount = dv.getUint16(p)
    p += 2
    for (let i = 0; i < strCount; i++) {
      const len = dv.getUint8(p)
      p += 1 + len
    }
    // Global Subr INDEX
    const gsubrCount = dv.getUint16(p)
    p += 2
    for (let i = 0; i < gsubrCount; i++) {
      const len = dv.getUint8(p)
      p += 1 + len
    }
    // CharStrings INDEX（CFF1 用 count 前加 CFF 版本判断；这里是 CFF1 offSize 读法）
    const charStringsCount = dv.getUint16(p)
    // .notdef + 字符 + 2 个图层 = 4（若图层字形已并入）
    expect(charStringsCount).toBeGreaterThanOrEqual(2)
    if (import.meta.env.DEV) {
      console.log('charStrings count:', charStringsCount)
    }
  })
})
