import { describe, expect, it, vi } from 'vitest'
import {
  findFreeTextCharIndexAt,
  findGridCellIndexAt,
  freeTextCaretRect,
  gridCellRect,
} from '@/features/applications/canvas/AppCanvasRenderer'
import type { ICharGridComponent, IFreeTextComponent } from '@/features/applications/types'

function makeCtx(): CanvasRenderingContext2D {
  return document.createElement('canvas').getContext('2d') as unknown as CanvasRenderingContext2D
}

/** 等宽字体模拟：每字宽 = fontSize */
function mockMonoWidth(ctx: CanvasRenderingContext2D, fontSize = 100) {
  ;(ctx.measureText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => ({
    width: text.length * fontSize,
  }))
}

const freeText: IFreeTextComponent = {
  kind: 'freeText',
  id: 't1',
  x: 100,
  y: 200,
  width: 500,
  height: 300,
  text: '新年快乐',
  fontSize: 100,
  direction: 'horizontal',
  color: '#000',
  align: 'left',
  lineHeight: 1.2,
}

describe('findFreeTextCharIndexAt', () => {
  it('按字符位置命中（左半=该字前，右半=该字后）', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    expect(findFreeTextCharIndexAt(freeText, 100, 220, ctx, 'f')).toBe(0)
    expect(findFreeTextCharIndexAt(freeText, 160, 220, ctx, 'f')).toBe(1)
    expect(findFreeTextCharIndexAt(freeText, 210, 220, ctx, 'f')).toBe(1)
    expect(findFreeTextCharIndexAt(freeText, 260, 220, ctx, 'f')).toBe(2)
  })

  it('组件内但字符外 → 末尾', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    expect(findFreeTextCharIndexAt(freeText, 800, 220, ctx, 'f')).toBe(4)
  })
})

describe('findGridCellIndexAt', () => {
  const grid: ICharGridComponent = {
    kind: 'charGrid',
    id: 'g1',
    x: 0,
    y: 0,
    width: 220,
    height: 220,
    cols: 2,
    rows: 2,
    gapX: 20,
    gapY: 20,
    content: '甲乙丙丁',
    fontSize: 80,
    color: '#000',
  }

  it('单元格命中（行优先）', () => {
    expect(findGridCellIndexAt(grid, 30, 30)).toBe(0)
    expect(findGridCellIndexAt(grid, 130, 30)).toBe(1)
    expect(findGridCellIndexAt(grid, 30, 130)).toBe(2)
    expect(findGridCellIndexAt(grid, 130, 130)).toBe(3)
  })

  it('越界点击收敛到范围内', () => {
    expect(findGridCellIndexAt(grid, 900, 900)).toBe(3)
  })

  it('点击的格子可超出内容长度（点哪格返回哪格）', () => {
    const shortGrid = { ...grid, content: '甲乙' }
    expect(findGridCellIndexAt(shortGrid, 130, 130)).toBe(3)
  })
})

describe('freeTextCaretRect', () => {
  it('末尾光标 = 最后字符之后', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const rect = freeTextCaretRect(freeText, 4, ctx, 'f')
    expect(rect).toMatchObject({ x: 500, y: 200, height: 100 })
  })

  it('空文本光标在左上角', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const rect = freeTextCaretRect({ ...freeText, text: '' }, 0, ctx, 'f')
    expect(rect).toMatchObject({ x: 100, y: 200, height: 100 })
  })
})

describe('gridCellRect', () => {
  it('单元格矩形中心对齐字号', () => {
    const grid: ICharGridComponent = {
      kind: 'charGrid',
      id: 'g1',
      x: 0,
      y: 0,
      width: 220,
      height: 220,
      cols: 2,
      rows: 2,
      gapX: 20,
      gapY: 20,
      content: '甲乙',
      fontSize: 80,
      color: '#000',
    }
    const rect = gridCellRect(grid, 1)
    expect(rect).toMatchObject({ x: 130, y: 10, width: 80, height: 80 })
  })

  it('非法下标返回 null', () => {
    const grid: ICharGridComponent = {
      kind: 'charGrid',
      id: 'g1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cols: 2,
      rows: 2,
      gapX: 0,
      gapY: 0,
      content: '甲',
      fontSize: 20,
      color: '#000',
    }
    expect(gridCellRect(grid, -1)).toBeNull()
  })
})
