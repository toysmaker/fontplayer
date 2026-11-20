/**
 * 图标数据集 SVG 填充语义：contourGroupsToSvgPaths
 * 同一「填充单元 + 颜色」的轮廓必须合并为一条 <path>（fill-rule="nonzero"），
 * 反方向轮廓才能通过非零环绕规则形成镂空；逐轮廓单独填充会把镂空填实。
 * （回归：花瓶把手镂空被填实的问题）
 */
import { describe, it, expect } from 'vitest'
import { PathType, type IContour } from '@/core/font/types'
import { contourGroupsToSvgPaths } from '@/features/editor/services/ExportIconDatasetService'

type Seg = {
  type: PathType
  start: { x: number; y: number }
  end: { x: number; y: number }
  control?: { x: number; y: number }
  control1?: { x: number; y: number }
  control2?: { x: number; y: number }
}

function line(start: { x: number; y: number }, end: { x: number; y: number }): Seg {
  return { type: PathType.LINE, start, end }
}

/** 逆时针方形（y-up 坐标系正面积） */
function ccwSquare(): IContour {
  return [
    line({ x: 0, y: 0 }, { x: 100, y: 0 }),
    line({ x: 100, y: 0 }, { x: 100, y: 100 }),
    line({ x: 100, y: 100 }, { x: 0, y: 100 }),
    line({ x: 0, y: 100 }, { x: 0, y: 0 }),
  ] as never
}

/** 顺时针方形（y-up 坐标系负面积，与外轮廓反向 → 镂空） */
function cwSquare(): IContour {
  return [
    line({ x: 25, y: 25 }, { x: 25, y: 75 }),
    line({ x: 25, y: 75 }, { x: 75, y: 75 }),
    line({ x: 75, y: 75 }, { x: 75, y: 25 }),
    line({ x: 75, y: 25 }, { x: 25, y: 25 }),
  ] as never
}

const empty: IContour = []

describe('contourGroupsToSvgPaths', () => {
  it('彩色：同单元同色的正反轮廓合并为一条 path（nonzero 镂空），实心轮廓最后单独绘制', () => {
    const paths = contourGroupsToSvgPaths(
      [ccwSquare(), cwSquare(), ccwSquare()],
      [false, false, true],
      ['#3e3328', '#3e3328', '#788d3a'],
      ['glyph-u1', 'glyph-u1', 'comp-rect'],
      true,
    )
    // 前两条同色同单元合并为一条 path，包含两个子路径
    expect(paths).toHaveLength(2)
    expect(paths[0]).toContain('fill="#3e3328"')
    expect(paths[0]).toContain('fill-rule="nonzero"')
    const d0 = paths[0]
    const subPaths = (d0.match(/M \d+ \d+/g) || []).length
    expect(subPaths).toBe(2)
    // 实心轮廓独立成 path 且排在其后
    expect(paths[1]).toContain('fill="#788d3a"')
    expect(paths[1].indexOf('<path')).toBeGreaterThan(-1)
  })

  it('彩色：不同填充单元即使同色也不合并（避免无关组件误合并出洞）', () => {
    const paths = contourGroupsToSvgPaths(
      [ccwSquare(), ccwSquare()],
      [false, false],
      ['#ff0000', '#ff0000'],
      ['comp-a', 'comp-b'],
      true,
    )
    expect(paths).toHaveLength(2)
    for (const p of paths) {
      expect((p.match(/M \d+ \d+/g) || []).length).toBe(1)
    }
  })

  it('黑白：所有非实心轮廓合并为一条黑色 path，实心轮廓最后单独绘制', () => {
    const paths = contourGroupsToSvgPaths(
      [ccwSquare(), cwSquare(), ccwSquare()],
      [false, false, true],
      ['#000', '#000', '#000'],
      ['comp-a', 'comp-b', 'comp-rect'],
      false,
    )
    expect(paths).toHaveLength(2)
    expect(paths[0]).toContain('fill="#000000"')
    expect((paths[0].match(/M \d+ \d+/g) || []).length).toBe(2)
    expect(paths[1]).toContain('fill="#000000"')
    expect((paths[1].match(/M \d+ \d+/g) || []).length).toBe(1)
  })

  it('空轮廓被过滤，不产生空 path', () => {
    const paths = contourGroupsToSvgPaths(
      [empty, ccwSquare()],
      [false, false],
      ['#000', '#000'],
      ['comp-a', 'comp-b'],
      false,
    )
    expect(paths).toHaveLength(1)
    expect((paths[0].match(/M \d+ \d+/g) || []).length).toBe(1)
  })

  it('彩色：无颜色轮廓回退黑色', () => {
    const paths = contourGroupsToSvgPaths(
      [ccwSquare()],
      [false],
      ['#000'],
      ['comp-a'],
      true,
    )
    expect(paths[0]).toContain('fill="#000000"')
  })
})
