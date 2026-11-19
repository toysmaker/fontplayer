/**
 * RenderEngine.renderPreview 测试
 * 重点覆盖彩色模式下的填充单元分组：
 * 同一组件（同一 fillUnit）内同色轮廓必须合并为一次 compound fill('nonzero')，
 * 否则反方向轮廓无法形成镂空；不同单元的轮廓即使同色也独立填充。
 */

import { describe, it, expect, vi } from 'vitest'
import { RenderEngine } from '@/core/font/renderer'
import { PathType } from '@/core/font/types'
import type { IContours, IContour } from '@/core/font/types'

/** 生成一个闭合方形轮廓（LINE 段 + closePath 收尾） */
function square(x: number, y: number, size: number): IContour {
  return [
    { type: PathType.LINE, start: { x, y }, end: { x: x + size, y } },
    { type: PathType.LINE, start: { x: x + size, y }, end: { x: x + size, y: y + size } },
    { type: PathType.LINE, start: { x: x + size, y: y + size }, end: { x, y: y + size } },
  ]
}

/** 创建可断言的 mock 2d context */
function createMockCtx() {
  const ctx: any = {
    fillStyle: '',
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }
  ctx.fill = vi.fn((rule?: string) => {
    ctx.fillCalls.push({ style: ctx.fillStyle, rule })
  })
  ctx.fillCalls = [] as Array<{ style: string; rule?: string }>
  return ctx
}

function renderWith(
  ctx: any,
  contours: IContours,
  options: Parameters<typeof RenderEngine.renderPreview>[2]
): void {
  const canvas = document.createElement('canvas')
  canvas.width = 100
  canvas.height = 100
  ;(canvas as any).getContext = () => ctx
  RenderEngine.renderPreview(canvas, contours, options)
}

describe('RenderEngine.renderPreview', () => {
  it('彩色模式：同一单元内同色轮廓合并为一次 compound fill（镂空依赖此行为）', () => {
    const ctx = createMockCtx()
    const outer = square(10, 10, 60)
    const inner = square(25, 25, 30) // 反方向轮廓，在复合路径中形成镂空
    renderWith(ctx, [outer, inner], {
      previewStyle: 'color',
      fillColors: ['#f00', '#f00'],
      fillUnits: ['glyph-u1', 'glyph-u1'],
    })
    // 1 个 beginPath，两个子路径（2 次 moveTo），最后只 fill 一次
    expect(ctx.beginPath).toHaveBeenCalledTimes(1)
    expect(ctx.moveTo).toHaveBeenCalledTimes(2)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
    expect(ctx.fillCalls[0]).toEqual({ style: '#f00', rule: 'nonzero' })
  })

  it('彩色模式：同一单元内不同颜色分别填充', () => {
    const ctx = createMockCtx()
    renderWith(ctx, [square(10, 10, 20), square(40, 10, 20)], {
      previewStyle: 'color',
      fillColors: ['#f00', '#0f0'],
      fillUnits: ['glyph-u1', 'glyph-u1'],
    })
    expect(ctx.beginPath).toHaveBeenCalledTimes(2)
    expect(ctx.fill).toHaveBeenCalledTimes(2)
    expect(ctx.fillCalls.map(c => c.style)).toEqual(['#f00', '#0f0'])
  })

  it('彩色模式：不同单元即使同色也独立填充（无法确认复用关系，不合并）', () => {
    const ctx = createMockCtx()
    renderWith(ctx, [square(10, 10, 20), square(40, 10, 20)], {
      previewStyle: 'color',
      fillColors: ['#f00', '#f00'],
      fillUnits: ['comp-a', 'comp-b'],
    })
    expect(ctx.beginPath).toHaveBeenCalledTimes(2)
    expect(ctx.fill).toHaveBeenCalledTimes(2)
    expect(ctx.fillCalls.map(c => c.style)).toEqual(['#f00', '#f00'])
  })

  it('彩色模式：未提供 fillUnits 时退化为按颜色分组（字形列表场景）', () => {
    const ctx = createMockCtx()
    renderWith(ctx, [square(10, 10, 60), square(25, 25, 30)], {
      previewStyle: 'color',
      fillColors: [],
    })
    expect(ctx.beginPath).toHaveBeenCalledTimes(1)
    expect(ctx.moveTo).toHaveBeenCalledTimes(2)
    expect(ctx.fillCalls.map(c => c.style)).toEqual(['#000'])
  })

  it('黑色模式：所有轮廓仍合并为一次 fill（保持原有镂空行为）', () => {
    const ctx = createMockCtx()
    renderWith(ctx, [square(10, 10, 60), square(25, 25, 30)], {
      previewStyle: 'black',
      fillUnits: ['comp-a', 'comp-b'],
    })
    expect(ctx.beginPath).toHaveBeenCalledTimes(1)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
    expect(ctx.fillCalls[0]).toEqual({ style: '#000', rule: 'nonzero' })
  })

  it('彩色模式：实心轮廓按自身颜色单独填充并覆盖在最上方', () => {
    const ctx = createMockCtx()
    renderWith(ctx, [square(10, 10, 60)], {
      previewStyle: 'color',
      fillColors: ['#f00'],
      fillUnits: ['comp-a'],
      solidContours: [square(20, 20, 10)],
      solidFillColors: ['#00f'],
    })
    // Pass 1（nonzero 组）+ Pass 2（实心）
    expect(ctx.fillCalls.map(c => c.style)).toEqual(['#f00', '#00f'])
  })

  it('黑色模式：实心轮廓仍用统一黑色填充', () => {
    const ctx = createMockCtx()
    renderWith(ctx, [square(10, 10, 60)], {
      previewStyle: 'black',
      solidContours: [square(20, 20, 10)],
      solidFillColors: ['#00f'],
    })
    expect(ctx.fillCalls.map(c => c.style)).toEqual(['#000', '#000'])
  })
})
