import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  wrapTextLines,
  computeFreeTextCharPositions,
  computeCharGridCharPositions,
  computeAllCharPositions,
} from '@/features/applications/canvas/AppCanvasRenderer'
import type { ICharGridComponent, IFreeTextComponent } from '@/features/applications/types'

function makeCtx(): CanvasRenderingContext2D {
  return document.createElement('canvas').getContext('2d') as unknown as CanvasRenderingContext2D
}

/** 模拟等宽字体：每字宽度 = fontSize */
function mockMonoWidth(ctx: CanvasRenderingContext2D, fontSize = 100) {
  ;(ctx.measureText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => ({
    width: text.length * fontSize,
  }))
}

describe('wrapTextLines', () => {
  beforeEach(() => {
    mockMonoWidth(makeCtx(), 100)
  })

  it('宽度足够时单行', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const lines = wrapTextLines(ctx, '新年快乐', 1000)
    expect(lines).toEqual(['新年快乐'])
  })

  it('宽度不足时逐字换行', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const lines = wrapTextLines(ctx, '新年快乐', 200)
    expect(lines).toEqual(['新年', '快乐'])
  })

  it('手动换行符生效', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const lines = wrapTextLines(ctx, '新年\n快乐', 1000)
    expect(lines).toEqual(['新年', '快乐'])
  })
})

describe('computeFreeTextCharPositions', () => {
  const family = 'fp-test'

  it('横向：换行后 y 递增、x 回行首', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const comp: IFreeTextComponent = {
      kind: 'freeText',
      id: 't1',
      x: 10,
      y: 20,
      width: 200,
      height: 400,
      text: '新年快乐',
      fontSize: 100,
      direction: 'horizontal',
      color: '#000',
      align: 'left',
      lineHeight: 1.5,
    }
    const positions = computeFreeTextCharPositions(comp, ctx, family)
    expect(positions.map((p) => p.char)).toEqual(['新', '年', '快', '乐'])
    expect(positions[0]).toMatchObject({ x: 10, y: 20 })
    expect(positions[2]).toMatchObject({ x: 10, y: 20 + 150 })
    expect(positions[1].x).toBe(110)
  })

  it('竖向：逐字一行，y 递增，x 居中', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const comp: IFreeTextComponent = {
      kind: 'freeText',
      id: 't2',
      x: 0,
      y: 0,
      width: 300,
      height: 1000,
      text: '新年快乐',
      fontSize: 100,
      direction: 'vertical',
      color: '#000',
      lineHeight: 1.2,
    }
    const positions = computeFreeTextCharPositions(comp, ctx, family)
    expect(positions.map((p) => p.char)).toEqual(['新', '年', '快', '乐'])
    expect(positions[0]).toMatchObject({ x: 100, y: 0 })
    expect(positions[1].y).toBe(120)
  })
})

describe('computeCharGridCharPositions', () => {
  it('2x2 网格单元格居中，行优先', () => {
    const comp: ICharGridComponent = {
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
    const positions = computeCharGridCharPositions(comp)
    expect(positions.map((p) => p.char)).toEqual(['甲', '乙', '丙', '丁'])
    // 单元格 100x100，字号 80，居中偏移 (100-80)/2 = 10
    expect(positions[0]).toMatchObject({ x: 10, y: 10 })
    // 第二列 x = 100 + 20 + 10
    expect(positions[1]).toMatchObject({ x: 130, y: 10 })
    // 第二行 y = 100 + 20 + 10
    expect(positions[2]).toMatchObject({ x: 10, y: 130 })
  })

  it('内容不足时截断', () => {
    const comp: ICharGridComponent = {
      kind: 'charGrid',
      id: 'g2',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      cols: 3,
      rows: 3,
      gapX: 0,
      gapY: 0,
      content: '甲乙',
      fontSize: 20,
      color: '#000',
    }
    expect(computeCharGridCharPositions(comp)).toHaveLength(2)
  })
})

describe('computeAllCharPositions', () => {
  it('多个组件时取首个出现位置', () => {
    const ctx = makeCtx()
    mockMonoWidth(ctx, 100)
    const freeText: IFreeTextComponent = {
      kind: 'freeText',
      id: 't1',
      x: 0,
      y: 0,
      width: 500,
      height: 300,
      text: '新年',
      fontSize: 100,
      direction: 'horizontal',
      color: '#000',
    }
    const grid: ICharGridComponent = {
      kind: 'charGrid',
      id: 'g1',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      cols: 1,
      rows: 1,
      gapX: 0,
      gapY: 0,
      content: '新',
      fontSize: 50,
      color: '#000',
    }
    const map = computeAllCharPositions(
      { canvas: { width: 100, height: 100, background: '#fff' }, components: [freeText, grid] },
      ctx,
      'fp-test'
    )
    expect(map.get('新')).toMatchObject({ x: 0, y: 0, fontSize: 100 })
    expect(map.get('年')?.x).toBe(100)
  })
})
