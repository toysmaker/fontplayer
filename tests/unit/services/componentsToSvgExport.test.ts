/**
 * 菜单「导出 SVG」（componentsToSvg）填充语义：
 * 与图标数据集导出/预览渲染一致 —— glyph 组件的 fillColor 继承到子组件；
 * 同帧同色轮廓合并为一条 <path>（fill-rule="nonzero"），反方向轮廓形成镂空。
 * （回归：字形组件导出全黑、镂空被填实的问题）
 */
import { describe, expect, it } from 'vitest'
import { componentsToSvg } from '@/features/svg'

/** 脚本多边形组件：x/y/w/h 与点集包围盒一致（与脚本生成组件一致） */
function glyphPolygon(points: Array<{ x: number; y: number }>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    type: 'glyph-polygon',
    points,
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    rotation: 0,
    strokeColor: '#000',
    closePath: true,
    ...extra,
  }
}

function glyphComponent(
  fillColor: string | undefined,
  children: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uuid: `g-${Math.random().toString(36).slice(2)}`,
    type: 'glyph',
    name: 'glyph',
    lock: false,
    visible: true,
    fillColor,
    value: { uuid: 'glyphDef', name: 'glyphDef', components: children },
    ...extra,
  }
}

/** 逆时针方形（正面积） */
const ccwSquare = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]
/** 顺时针方形（与外轮廓反向 → 镂空） */
const cwSquare = [
  { x: 25, y: 25 },
  { x: 25, y: 75 },
  { x: 75, y: 75 },
  { x: 75, y: 25 },
]

function pathElementsOf(svg: string, fill: string): string[] {
  const re = new RegExp(`<path fill="${fill}"[^>]*/>`, 'g')
  return svg.match(re) ?? []
}

function dOf(el: string): string {
  const m = el.match(/d="([^"]*)"/)
  return m ? m[1] : ''
}

describe('componentsToSvg（默认模式）', () => {
  it('glyph 组件 fillColor 继承到子组件（不再全黑），默认模式不带描边', () => {
    const svg = componentsToSvg(
      [glyphComponent('#3e3328', [glyphPolygon(ccwSquare)])] as never,
      1000,
      1000,
      'default',
    )
    const els = pathElementsOf(svg, '#3e3328')
    expect(els).toHaveLength(1)
    expect(dOf(els[0])).toContain('M 0,0')
    expect(svg).not.toContain('fill="#000000"')
    expect(svg).not.toContain('stroke=')
  })

  it('同帧同色正反轮廓合并为一条 path（nonzero 镂空）', () => {
    const svg = componentsToSvg(
      [glyphComponent('#3e3328', [glyphPolygon(ccwSquare), glyphPolygon(cwSquare)])] as never,
      1000,
      1000,
      'default',
    )
    const els = pathElementsOf(svg, '#3e3328')
    expect(els).toHaveLength(1)
    expect(els[0]).toContain('fill-rule="nonzero"')
    // 一条 path 内包含两个子路径，且第二个子路径坐标未因变换缩放
    const d = dOf(els[0])
    expect((d.match(/M \d+,\d+/g) || []).length).toBe(2)
    expect(d).toContain('M 25,25')
    expect(d).toContain('L 75,25')
  })

  it('子组件自设颜色时单独分组，不与继承色合并', () => {
    const svg = componentsToSvg(
      [
        glyphComponent('#3e3328', [
          glyphPolygon(ccwSquare),
          glyphPolygon(cwSquare, { fillColor: '#ff0000' }),
        ]),
      ] as never,
      1000,
      1000,
      'default',
    )
    expect(pathElementsOf(svg, '#3e3328')).toHaveLength(1)
    expect(pathElementsOf(svg, '#ff0000')).toHaveLength(1)
  })

  it('嵌套 glyph 逐级继承：父字形颜色传到孙级无设色子组件', () => {
    const svg = componentsToSvg(
      [
        glyphComponent('#788d3a', [
          glyphComponent(undefined, [glyphPolygon(ccwSquare)]),
        ]),
      ] as never,
      1000,
      1000,
      'default',
    )
    expect(pathElementsOf(svg, '#788d3a')).toHaveLength(1)
    expect(svg).not.toContain('fill="#000000"')
  })

  it('字形帧定位仅使用 ox/oy 偏移（不缩放、不旋转、不叠加 x/y）', () => {
    const svg = componentsToSvg(
      [
        glyphComponent('#406443', [glyphPolygon(ccwSquare)], {
          ox: 36,
          oy: -241,
          x: 500,
          y: 500,
          w: 0,
          h: 0,
        }),
      ] as never,
      1000,
      1000,
      'default',
    )
    expect(svg).toContain('<g transform="translate(36, -241)">')
    expect(svg).not.toContain('translate(536')
  })

  it('脚本组件输出原始点：不应用其 x/y/w/h/rotation（与 updateData 一致）', () => {
    // 脚本多边形：点集与 x/y/w/h/rotation 不一致时，导出仍是原始点坐标
    const svg = componentsToSvg(
      [
        glyphComponent('#406443', [
          glyphPolygon(ccwSquare, { x: 300, y: 300, w: 20, h: 20, rotation: 45 }),
        ]),
      ] as never,
      1000,
      1000,
      'default',
    )
    const els = pathElementsOf(svg, '#406443')
    const d = dOf(els[0])
    // 原始点：0..100 方形；若错误应用了放置变换会出现 300/旋转后坐标
    expect(d).toContain('M 0,0')
    expect(d).toContain('L 100,0')
    expect(d).not.toContain('300')
  })

  it('顶层钢笔组件使用 value.fillColor', () => {
    const svg = componentsToSvg(
      [
        {
          uuid: 'pen-1',
          type: 'pen',
          name: 'pen',
          lock: false,
          visible: true,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          rotation: 0,
          value: {
            points: [
              { x: 0, y: 0 },
              { x: 33, y: 0 },
              { x: 66, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
              { x: 0, y: 0 },
            ],
            strokeColor: '#000',
            fillColor: '#406443',
            closePath: true,
          },
        },
      ] as never,
      1000,
      1000,
      'default',
    )
    expect(pathElementsOf(svg, '#406443')).toHaveLength(1)
  })

  it('顶层钢笔组件绕原始包围盒中心旋转（transformPoints 语义，而非放置后中心）', () => {
    const svg = componentsToSvg(
      [
        {
          uuid: 'pen-rot',
          type: 'pen',
          name: 'pen',
          lock: false,
          visible: true,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          rotation: 90,
          value: {
            points: [
              { x: 0, y: 0 },
              { x: 33, y: 0 },
              { x: 66, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
              { x: 0, y: 0 },
            ],
            strokeColor: '#000',
            fillColor: '#406443',
            closePath: true,
          },
        },
      ] as never,
      1000,
      1000,
      'default',
    )
    const els = pathElementsOf(svg, '#406443')
    // (0,0) 绕包围盒中心 (50,50) 旋转 90° → (100,0)（浮点误差在 1e-9 内）
    expect(dOf(els[0])).toMatch(/^M 100,-?\d(\.\d+)?e?-?\d* /)
  })
})

describe('componentsToSvg（轮廓模式）', () => {
  it('保持逐组件输出：fill 为空、带 transform、保留描边、不做合并', () => {
    const svg = componentsToSvg(
      [glyphComponent('#3e3328', [glyphPolygon(ccwSquare), glyphPolygon(cwSquare)])] as never,
      1000,
      1000,
      'contour',
    )
    expect(svg).toContain('fill=""')
    expect(svg).toContain('transform="translate(')
    expect(svg).toContain('stroke="#000"')
    expect(svg).not.toContain('fill-rule')
  })
})
