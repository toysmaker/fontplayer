import { describe, expect, it } from 'vitest'
import { useAppCanvasEditor } from '@/features/applications/canvas/useAppCanvasEditor'
import type { ICardAppData, IAppComponent } from '@/features/applications/types'

function makeComp(id: string): IAppComponent {
  return { kind: 'image', id, x: 0, y: 0, width: 10, height: 10, source: { kind: 'pattern', patternId: 'dots' } }
}

function makeData(ids: string[]) {
  return { canvas: { width: 100, height: 100, background: '#fff' }, components: ids.map(makeComp) }
}

function idsOf(data: ICardAppData): string[] {
  return data.components.map((c) => c.id)
}

describe('useAppCanvasEditor 图层排序', () => {
  it('moveLayer：+1 前移（z 序更高、数组靠后），-1 后移', () => {
    const data = makeData(['a', 'b', 'c'])
    const editor = useAppCanvasEditor(() => data)
    editor.moveLayer('a', 1)
    expect(idsOf(data)).toEqual(['b', 'a', 'c'])
    editor.moveLayer('c', -1)
    expect(idsOf(data)).toEqual(['b', 'c', 'a'])
  })

  it('moveComponentToDisplayIndex：显示位置 0 = 最上层（数组末尾）', () => {
    const data = makeData(['a', 'b', 'c'])
    const editor = useAppCanvasEditor(() => data)
    editor.moveComponentToDisplayIndex('a', 0)
    expect(idsOf(data)).toEqual(['b', 'c', 'a'])
    // 再拖 c 到显示位置 0（当前数组 [b,c,a]，c 在 index 1 → 目标 index 2）
    editor.moveComponentToDisplayIndex('c', 0)
    expect(idsOf(data)).toEqual(['b', 'a', 'c'])
  })

  it('向下拖（显示位置增大）语义一致', () => {
    const data = makeData(['a', 'b', 'c'])
    const editor = useAppCanvasEditor(() => data)
    // a 在显示位置 2（最底），拖到显示位置 0 再拖回 1
    editor.moveComponentToDisplayIndex('a', 0)
    expect(idsOf(data)).toEqual(['b', 'c', 'a'])
    editor.moveComponentToDisplayIndex('a', 1)
    expect(idsOf(data)).toEqual(['b', 'a', 'c'])
  })
})
