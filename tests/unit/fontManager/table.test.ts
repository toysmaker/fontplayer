import { describe, it, expect } from 'vitest'
import { tableTool } from '@/fontManager/table'

describe('fontManager table', () => {
  it('tableTool maps expected OpenType table tags', () => {
    expect(tableTool.head).toBeDefined()
    expect(tableTool.hhea).toBeDefined()
    expect(tableTool['OS/2']).toBeDefined()
    expect(tableTool.maxp).toBeDefined()
    expect(tableTool.name).toBeDefined()
    expect(tableTool.post).toBeDefined()
    expect(tableTool.cmap).toBeDefined()
    expect(tableTool.hmtx).toBeDefined()
    expect(tableTool.glyf).toBeDefined()
    expect(tableTool.loca).toBeDefined()
    expect(tableTool['CFF ']).toBeDefined()
    expect(tableTool.fvar).toBeDefined()
    expect(tableTool.gvar).toBeDefined()
    expect(tableTool.STAT).toBeDefined()
    expect(tableTool.COLR).toBeDefined()
    expect(tableTool.CPAL).toBeDefined()
  })
})
