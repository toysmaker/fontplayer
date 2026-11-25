/**
 * PenSelectTool 多钢笔骨架自由编辑: mousedown 命中切换 active 钢笔、拖拽只动命中钢笔
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PenSelectTool, editModeFixedBounds } from '@/features/tools/select/PenSelectTool'
import { createMockCanvas } from '../../helpers/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'

vi.mock('@/stores/character', () => ({
  useCharacterStore: vi.fn(),
}))
vi.mock('@/stores/glyph', () => ({
  useGlyphStore: vi.fn(),
}))
vi.mock('@/stores/project', () => ({
  useProjectStore: vi.fn(),
}))

/** 构造一支带 enrich 属性的钢笔(锚点/控制点齐全的矩形轮廓) */
function makePen(uuid: string, anchorUuids: string[], offsetX: number): any {
  // 矩形: A(100,100) B(200,100) C(200,200) D(100,200),闭合
  const anchors = [
    { x: 100 + offsetX, y: 100, uuid: anchorUuids[0] },
    { x: 200 + offsetX, y: 100, uuid: anchorUuids[1] },
    { x: 200 + offsetX, y: 200, uuid: anchorUuids[2] },
    { x: 100 + offsetX, y: 200, uuid: anchorUuids[3] },
  ]
  const points: any[] = []
  for (let i = 0; i < 4; i++) {
    const a = anchors[i]
    const b = anchors[(i + 1) % 4]
    points.push({ x: a.x, y: a.y, type: 'anchor', uuid: a.uuid, origin: null, isShow: true })
    points.push({ x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3, type: 'control', uuid: `${uuid}-c${i}a`, origin: a.uuid, isShow: false })
    points.push({ x: a.x + ((b.x - a.x) * 2) / 3, y: a.y + ((b.y - a.y) * 2) / 3, type: 'control', uuid: `${uuid}-c${i}b`, origin: b.uuid, isShow: false })
  }
  // 闭合: 末尾重复起始锚点
  points.push({ x: anchors[0].x, y: anchors[0].y, type: 'anchor', uuid: `${uuid}-close`, origin: null, isShow: true })
  return {
    penUUID: uuid,
    penComponent: { points, closePath: true, editMode: true } as any,
  }
}

function makeMouseEvent(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }) as MouseEvent
}

describe('PenSelectTool multi-pen free edit', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = createMockCanvas(500, 500)
    vi.mocked(useCharacterStore).mockReturnValue({ selectedComponent: null, updateComponent: vi.fn(), editingCharacter: { components: [] } } as any)
    vi.mocked(useGlyphStore).mockReturnValue({ selectedComponent: null, updateComponent: vi.fn(), editingGlyph: { components: [] } } as any)
    vi.mocked(useProjectStore).mockReturnValue({ selectedFile: { fontSettings: { unitsPerEm: 1000 } } } as any)
    PenSelectTool.reset()
    editModeFixedBounds.clear()
  })

  afterEach(() => {
    PenSelectTool.reset()
    editModeFixedBounds.clear()
    PenSelectTool.skeletonFreeEditContext = null
  })

  it('mousedown 命中笔 B 锚点切换 active 并只拖笔 B', () => {
    const penA = makePen('penA', ['a0', 'a1', 'a2', 'a3'], 0)
    const penB = makePen('penB', ['b0', 'b1', 'b2', 'b3'], 400)
    PenSelectTool.skeletonFreeEditContext = {
      glyphComponent: { uuid: 'g1', type: 'glyph', ox: 0, oy: 0, w: 800, h: 800, rotation: 0 } as any,
      pens: [penA, penB],
      activePenUUID: 'penA',
    }

    const tool = PenSelectTool.getInstance(canvas, {
      canvas,
      mode: 'glyph' as const,
      getCoord: (c: number) => c,
      onRender: vi.fn(),
    } as any)
    tool.activate()

    // 命中笔 B 的 b0 锚点(500,100)
    tool.onMouseDown(makeMouseEvent('mousedown', 500, 100))
    expect(PenSelectTool.skeletonFreeEditContext!.activePenUUID).toBe('penB')
    expect((tool as any).selectAnchor).toBe('b0')

    // 拖拽: 只动笔 B 的点
    const beforeA = JSON.stringify(penA.penComponent.points)
    tool.onMouseMove(makeMouseEvent('mousemove', 520, 120))
    const afterB = penB.penComponent.points.find((p: any) => p.uuid === 'b0')
    expect(afterB.x).toBeCloseTo(520, 0)
    expect(afterB.y).toBeCloseTo(120, 0)
    expect(JSON.stringify(penA.penComponent.points)).toBe(beforeA)

    tool.onMouseUp(makeMouseEvent('mouseup', 520, 120))
    expect((tool as any).mousedown).toBe(false)

    // 再点笔 A 的 a0 锚点: active 切回 penA
    tool.onMouseDown(makeMouseEvent('mousedown', 100, 100))
    expect(PenSelectTool.skeletonFreeEditContext!.activePenUUID).toBe('penA')
    expect((tool as any).selectAnchor).toBe('a0')
  })
})
