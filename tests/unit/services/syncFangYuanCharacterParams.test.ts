/**
 * 临时代码验证：syncFangYuanCharacterComponentParamsToLatest_private_v1
 * 将字符组件参数同步为最新笔画规则（补全缺失参数 + 合并 Enum options，保留原值）。
 */
import { describe, it, expect } from 'vitest'
import type { IComponent, ICustomGlyph } from '@/core/types'
import {
  syncFangYuanCharacterComponentParamsToLatest_private_v1,
  syncFangYuanGlyphParamsToLatest_private_v1,
} from '@/features/temporaryScripts/fileProcessing'

function glyphComp(
  name: string,
  style: string,
  params: Array<{ name: string; type: number; value: number; min?: number; max?: number; options?: Array<{ value: number; label: string }> }>,
): IComponent {
  const value = {
    uuid: `value-${name}`,
    name,
    type: 'system',
    style,
    components: [],
    groups: [],
    orderedList: [],
    selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params.map((p) => ({
      uuid: `${name}-${p.name}`,
      name: p.name,
      type: p.type,
      value: p.value,
      min: p.min ?? 0,
      max: p.max ?? 1000,
      options: p.options?.map((o) => ({ ...o })),
    })),
    joints: [],
  } as unknown as ICustomGlyph
  return {
    uuid: `comp-${name}`,
    type: 'glyph',
    name,
    lock: false,
    visible: true,
    usedInCharacter: true,
    x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
    ox: 0, oy: 0,
    value,
  }
}

function paramsOf(comp: IComponent): Array<{ name: string; type: number; value: number; min?: number; max?: number; options?: Array<{ value: number; label: string }> }> {
  return ((comp.value as ICustomGlyph).parameters as any[]) as any
}

describe('syncFangYuanCharacterComponentParamsToLatest_private_v1', () => {
  it('补全缺失参数并保留已有参数值（竖折折钩旧数据 → 最新规则）', () => {
    const comp = glyphComp('竖折折钩', '字玩方圆黑体', [
      { name: '竖-竖直延伸', type: 0, value: 300 },
      { name: '字重', type: 0, value: 60 },
    ])

    syncFangYuanCharacterComponentParamsToLatest_private_v1([comp])

    const params = paramsOf(comp)
    const byName = new Map(params.map((p) => [p.name, p]))
    // 新增：折1/折2/钩 系列 + 通用参数 + 字重比率
    expect(byName.has('折1-水平延伸')).toBe(true)
    expect(byName.has('折2-竖直延伸')).toBe(true)
    expect(byName.has('钩-水平延伸')).toBe(true)
    expect(byName.has('钩-竖直延伸')).toBe(true)
    expect(byName.has('钩-弯曲度')).toBe(true)
    expect(byName.has('字重比率')).toBe(true)
    expect(byName.has('参考位置')).toBe(true)
    expect(byName.has('收笔风格')).toBe(true)
    // 保留原值
    expect(byName.get('竖-竖直延伸')!.value).toBe(300)
    expect(byName.get('字重')!.value).toBe(60)
    // 新增参数使用最新默认值与范围
    expect(byName.get('钩-弯曲度')!.value).toBe(1.5)
    expect(byName.get('钩-弯曲度')!.min).toBe(1)
    expect(byName.get('钩-弯曲度')!.max).toBe(2)
  })

  it('Enum 参数合并最新 options（收笔风格补上弯笔收笔=6），保留原值', () => {
    const comp = glyphComp('竖折折钩', '字玩方圆黑体', [
      {
        name: '收笔风格',
        type: 1,
        value: 4,
        options: [
          { value: 3, label: '圆切' },
          { value: 4, label: '斜切' },
        ],
      },
    ])

    syncFangYuanCharacterComponentParamsToLatest_private_v1([comp])

    const shoubi = paramsOf(comp).find((p) => p.name === '收笔风格')!
    expect(shoubi.value).toBe(4)
    const values = shoubi.options!.map((o) => o.value)
    expect(values).toContain(3)
    expect(values).toContain(4)
    expect(values).toContain(6) // 弯笔收笔
    expect(shoubi.options!.find((o) => o.value === 6)!.label).toBe('弯笔收笔')
  })

  it('重复调用幂等：参数不重复添加', () => {
    const comp = glyphComp('横折钩', '字玩方圆黑体', [])

    syncFangYuanCharacterComponentParamsToLatest_private_v1([comp])
    const first = paramsOf(comp).length
    syncFangYuanCharacterComponentParamsToLatest_private_v1([comp])
    const second = paramsOf(comp).length

    expect(first).toBeGreaterThan(0)
    expect(second).toBe(first)
  })

  it('非方圆黑体风格的组件不处理', () => {
    const comp = glyphComp('竖折折钩', '字玩标准黑体', [
      { name: '竖-竖直延伸', type: 0, value: 300 },
    ])

    syncFangYuanCharacterComponentParamsToLatest_private_v1([comp])

    expect(paramsOf(comp).length).toBe(1)
  })

  it('stroke_glyphs 列表同步：补全缺失参数并保留原值', () => {
    const comp = glyphComp('横折钩', '字玩方圆黑体', [
      { name: '横-水平延伸', type: 0, value: 400 },
      {
        name: '收笔风格',
        type: 1,
        value: 4,
        options: [{ value: 4, label: '斜切' }],
      },
    ])
    const strokeGlyphs = [comp.value as ICustomGlyph]

    syncFangYuanGlyphParamsToLatest_private_v1(strokeGlyphs)

    const params = (strokeGlyphs[0].parameters as any[]) as any[]
    const byName = new Map(params.map((p) => [p.name, p]))
    expect(byName.has('折-竖直延伸')).toBe(true)
    expect(byName.has('钩-水平延伸')).toBe(true)
    expect(byName.has('钩-竖直延伸')).toBe(true)
    expect(byName.has('钩-弯曲度')).toBe(true)
    expect(byName.has('字重比率')).toBe(true)
    expect(byName.get('横-水平延伸')!.value).toBe(400)
    const shoubi = byName.get('收笔风格')!
    expect(shoubi.value).toBe(4)
    expect(shoubi.options.map((o: any) => o.value)).toContain(6)
  })
})
