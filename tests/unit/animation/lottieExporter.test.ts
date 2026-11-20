import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildLottieJson } from '@/features/animation/lottieExporter'
import { getCharacterMetrics } from '@/features/animation/render'
import { ContourConverter } from '@/core/font/converter'
import type { IAnimationClip, IAnimationKeyframe, ICharacterFileLite } from '@/core/types'

function makeKf(time: number, hidden = false): IAnimationKeyframe {
  return { id: `kf-${time}`, time, hidden, params: {}, charParams: {} }
}

function makeClip(keyframes: IAnimationKeyframe[]): IAnimationClip {
  return { id: 'clip-1', name: '测试片段', keyframes, fps: 30, createdAt: 0, updatedAt: 0 }
}

/** 字形组件（非脚本型：子组件在 value.components），带 ox/oy 偏移 */
function makeChar(): ICharacterFileLite {
  const pen = {
    type: 'pen',
    uuid: 'pen-1',
    name: 'p1',
    x: 10,
    y: 20,
    w: 30,
    h: 20,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    value: {
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 20 },
        { x: 0, y: 20 },
      ],
    },
  }
  const glyphComp = {
    type: 'glyph',
    uuid: 'glyph-1',
    name: 'G',
    ox: 50,
    oy: 70,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    fillColor: '#ff0000',
    value: {
      uuid: 'g1',
      name: 'G',
      components: [pen],
      orderedList: [{ type: 'pen', uuid: 'pen-1' }],
      groups: [],
      parameters: [],
    },
  }
  return {
    uuid: 'char-1',
    type: 'font',
    character: { text: 'A', unicode: 65 },
    components: [glyphComp],
    groups: [],
    orderedList: [{ type: 'component', uuid: 'glyph-1' }],
    parameters: [],
    script: undefined,
    info: { metrics: { advanceWidth: 1000, lsb: 0 } },
  } as unknown as ICharacterFileLite
}

interface LottieAnim {
  layers: Array<{
    nm: string
    shapes: Array<{ nm: string; it: Array<Record<string, unknown>> }>
  }>
  w: number
  h: number
}

function build(clip: IAnimationClip, char: ICharacterFileLite): LottieAnim {
  const json = buildLottieJson({
    clip,
    char,
    metrics: getCharacterMetrics(),
    style: 'color',
  })
  return JSON.parse(json) as LottieAnim
}

describe('lottieExporter 展平（真实管线）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('字形组件内普通组件展平为图层，顶点带 ox/oy 偏移且与转换器一致', () => {
    const char = makeChar()
    const anim = build(makeClip([makeKf(0), makeKf(1)]), char)
    expect(anim.layers.length).toBeGreaterThan(0)
    const pen = (char.components[0] as unknown as { value: { components: unknown[] } }).value
      .components[0]
    // 转换器编辑路径：字形分支用 childOffset = ox/oy 递归，与导出器一致
    const expected = ContourConverter.componentsToContoursEditing([pen as never], { x: 50, y: 70 })
    const shape = anim.layers[0].shapes[0]
    const shItem = shape.it.find((i) => i.ty === 'sh') as
      | { ks: { a: number; k: { v: number[][] } | Array<{ s: Array<{ v: number[][] }> }> } }
      | undefined
    expect(shItem).toBeTruthy()
    // 顶点数一致 → 形变组（a=1，k 为关键帧数组）；单帧 → 静态（a=0）
    const ks = shItem!.ks
    const v = ks.a === 0 ? (ks.k as { v: number[][] }).v : (ks.k as Array<{ s: Array<{ v: number[][] }> }>)[0].s[0].v
    expect(v.length).toBe(expected[0].length)
    expect(v[0]).toEqual([Math.round(expected[0][0].start.x * 100) / 100, Math.round(expected[0][0].start.y * 100) / 100])
  })

  it('父 glyph fillColor 继承到子组件图层（红色填充）', () => {
    const char = makeChar()
    const anim = build(makeClip([makeKf(0), makeKf(1)]), char)
    const fl = anim.layers[0].shapes[0].it.find((i) => i.ty === 'fl') as { c: { k: number[] } }
    expect(fl.c.k[0]).toBe(1)
    expect(fl.c.k[1]).toBe(0)
    expect(fl.c.k[2]).toBe(0)
  })

  it('单关键帧片段不抛错且导出图层', () => {
    const char = makeChar()
    const anim = build(makeClip([makeKf(0)]), char)
    expect(anim.layers.length).toBeGreaterThan(0)
    expect(anim.layers[0].shapes.length).toBeGreaterThan(0)
  })

  it('字符级 z 序按 orderedList 而非 components 数组顺序', () => {
    const penA = {
      type: 'pen',
      uuid: 'pen-a',
      name: 'A',
      x: 0,
      y: 0,
      w: 30,
      h: 20,
      rotation: 0,
      flipX: false,
      flipY: false,
      usedInCharacter: true,
      value: {
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 20 },
          { x: 0, y: 20 },
        ],
      },
    }
    const penB = { ...penA, uuid: 'pen-b', name: 'B', x: 100, y: 0, value: { points: penA.value.points } }
    const char = {
      uuid: 'char-2',
      type: 'font',
      character: { text: 'B', unicode: 66 },
      components: [penA, penB],
      groups: [],
      // 列表顺序与数组顺序相反：B 在下（先画），A 在上
      orderedList: [
        { type: 'component', uuid: 'pen-b' },
        { type: 'component', uuid: 'pen-a' },
      ],
      parameters: [],
      script: undefined,
      info: { metrics: { advanceWidth: 1000, lsb: 0 } },
    } as unknown as ICharacterFileLite
    const anim = build(makeClip([makeKf(0)]), char)
    expect(anim.layers.length).toBe(2)
    // layers[0] = 先画 = B（x=100）
    const sh0 = anim.layers[0].shapes[0].it.find((i) => i.ty === 'sh') as {
      ks: { a: number; k: { v: number[][] } }
    }
    expect(sh0.ks.a).toBe(0)
    expect(sh0.ks.k.v[0][0]).toBe(100)
    const sh1 = anim.layers[1].shapes[0].it.find((i) => i.ty === 'sh') as {
      ks: { a: number; k: { v: number[][] } }
    }
    expect(sh1.ks.k.v[0][0]).toBe(0)
  })

  it('首帧整字符 hidden 仍导出图层（全帧并集），透明度关键帧从 0 开始', () => {
    const char = makeChar()
    const anim = build(makeClip([makeKf(0, true), makeKf(1)]), char)
    expect(anim.layers.length).toBeGreaterThan(0)
    const grp = anim.layers[0].shapes[0] as unknown as { o: { k: Array<{ t: number; s: number[] }> } }
    expect(grp.o.k[0].s[0]).toBe(0)
    // 结束时完全可见
    const last = grp.o.k[grp.o.k.length - 1]
    expect(last.s[0]).toBe(100)
  })
})
