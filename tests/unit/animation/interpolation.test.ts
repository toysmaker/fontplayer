/**
 * 动效关键帧插值测试：验证字符参数（charParams）在长间隔（10s）下的插值行为
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { IAnimationKeyframe, ICharacterFileLite } from '@/core/types'
import { ParameterType } from '@/core/types'
import { expandKeyframeSnapshot, interpolateKeyframes } from '@/features/animation/vectorRender'
import { useProjectStore } from '@/stores/project'

function makeChar(): ICharacterFileLite {
  return {
    uuid: 'char-1',
    type: 'icon',
    character: { uuid: 'char-inner-1', text: '图标' },
    components: [],
    groups: [],
    orderedList: [],
    parameters: [
      { uuid: 'p-hue', name: '色相', type: ParameterType.Number, value: 0, min: -1, max: 1 },
      { uuid: 'p-sat', name: '饱和度', type: ParameterType.Number, value: 0, min: -1, max: 1 },
      { uuid: 'p-enum', name: '模式', type: ParameterType.Enum, value: 0, min: 0, max: 1, options: [{ label: 'a', value: 0 }, { label: 'b', value: 1 }] },
    ],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    selectedComponentsUUIDs: [],
  } as unknown as ICharacterFileLite
}

function makeKf(id: string, time: number, charParams?: Record<string, number>): IAnimationKeyframe {
  return { id, time, hidden: false, params: {}, charParams }
}

describe('animation keyframe interpolation (char params)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('expands keyframes into full snapshots using current char values', () => {
    const char = makeChar()
    const a = makeKf('a', 0) // 未修改：使用字符当前值
    const b = makeKf('b', 10, { 'p-hue': 1 })

    const fa = expandKeyframeSnapshot(char, a)
    const fb = expandKeyframeSnapshot(char, b)

    expect(fa.charParams?.['p-hue']).toBe(0)
    expect(fa.charParams?.['p-sat']).toBe(0)
    expect(fb.charParams?.['p-hue']).toBe(1)
    expect(fb.charParams?.['p-sat']).toBe(0)
  })

  it('lerps char params gradually across a 10s interval', () => {
    const char = makeChar()
    const a = makeKf('a', 0)
    const b = makeKf('b', 10, { 'p-hue': 1 })

    const at01 = interpolateKeyframes(char, a, b, 0.1) // t=1s 处
    const at05 = interpolateKeyframes(char, a, b, 0.5) // t=5s 处
    const at09 = interpolateKeyframes(char, a, b, 0.9)

    expect(at01.charParams?.['p-hue']).toBeCloseTo(0.1, 5)
    expect(at05.charParams?.['p-hue']).toBeCloseTo(0.5, 5)
    expect(at09.charParams?.['p-hue']).toBeCloseTo(0.9, 5)
  })

  it('lerps enum char params as numbers too (no nearest-side handling for charParams)', () => {
    const char = makeChar()
    const a = makeKf('a', 0)
    const b = makeKf('b', 10, { 'p-enum': 1 })
    const mid = interpolateKeyframes(char, a, b, 0.5)
    // 组件参数对 enum 有就近端处理；charParams 用 lerpNumbers 直接数值插值
    expect(mid.charParams?.['p-enum']).toBeCloseTo(0.5, 5)
  })
})
