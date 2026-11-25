/**
 * 多钢笔骨架绑定测试:
 * - buildSampledBindData 为每支钢笔生成一条 componentSampleRanges,区间连续覆盖共享采样缓冲
 * - applyFittedSamplesToComponents 写回时两支钢笔的点都变化
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { glyphSkeletonBind } from '@/features/glyphSkeletonBind'
import { applyFittedSamplesToComponents, applyPolylineSamplesToComponents } from '@/features/skeletonFitting'
import { ParameterType } from '@/core/types'
import type { ICustomGlyph } from '@/core/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '../fixtures/shu_zhe_zhe_gou.json')

function makePenComponent(rawComp: any, uuid: string, offset: { x: number; y: number }) {
  return {
    uuid,
    type: 'pen',
    name: rawComp.name,
    value: {
      points: rawComp.points.map((p: any, i: number) => ({
        uuid: `${uuid}-p${i}`,
        x: p.x + offset.x,
        y: p.y + offset.y,
        type: i % 3 === 0 ? 'anchor' : 'control',
        origin: null,
        isShow: true,
      })),
      fillColor: rawComp.fillColor,
      strokeColor: '#000',
      closePath: rawComp.closePath,
    },
    x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
    visible: true, lock: false, usedInCharacter: true,
  }
}

function loadGlyphWithTwoPens(): ICustomGlyph {
  const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8'))
  const pen1 = makePenComponent(raw.components[0], 'pen-1', { x: 0, y: 0 })
  const pen2 = makePenComponent(raw.components[0], 'pen-2', { x: 300, y: 40 })
  const components = [pen1, pen2]
  const params = raw.params.map((p: any) => ({
    uuid: `param_${p.name}`, name: p.name, type: ParameterType.Number,
    value: p.value, min: p.min ?? 0, max: p.max ?? 1000,
  }))
  return {
    uuid: 'test-szzg-2pens', name: '竖折折钩', type: 'system',
    components: components as any, groups: [],
    orderedList: components.map((c: any) => ({ type: 'component', uuid: c.uuid })),
    selectedComponentsTree: [], selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params as any, joints: [], reflines: [], script: '', style: raw.style,
    skeleton: { type: raw.skeleton.type, ox: raw.skeleton.ox, oy: raw.skeleton.oy, dynamicWeight: raw.skeleton.dynamicWeight },
  } as unknown as ICustomGlyph
}

describe('multi-pen skeleton bind', () => {
  it('bindData 为每支钢笔生成区间且连续覆盖采样缓冲', () => {
    const g = loadGlyphWithTwoPens()
    const inst = new CustomGlyph(g)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)

    const bindData = (g.skeleton as any).skeletonBindData
    expect(bindData).toBeDefined()
    const ranges = bindData.componentPointRanges as Array<{ componentUUID: string; start: number; end: number }>
    expect(ranges.length).toBe(2)
    expect(ranges.map((r) => r.componentUUID).sort()).toEqual(['pen-1', 'pen-2'])
    // 区间连续覆盖共享采样缓冲
    expect(ranges[0].start).toBe(0)
    expect(ranges[0].end).toBe(ranges[1].start)
    const samplePoints = bindData._sampleBindData.samplePoints as Array<{ x: number; y: number }>
    expect(ranges[1].end).toBe(samplePoints.length / 2)
  })

  it('applyFittedSamplesToComponents 写回时两支钢笔的点都变化', () => {
    const g = loadGlyphWithTwoPens()
    const inst = new CustomGlyph(g)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)

    const bindData = (g.skeleton as any).skeletonBindData
    const before1 = JSON.stringify((g.components[0].value as any).points)
    const before2 = JSON.stringify((g.components[1].value as any).points)

    // 整体平移采样点(+25 y): outBuffer 与 samplePoints 同为扁平 (x,y) 对数组
    const src = bindData._sampleBindData.samplePoints as number[]
    const outBuffer = new Float64Array(src.length)
    for (let i = 0; i < src.length; i += 2) {
      outBuffer[i] = src[i]
      outBuffer[i + 1] = src[i + 1] + 25
    }
    const pens = (g.components || []).filter((c: any) => c.type === 'pen') as any[]
    // 折线写回是确定性的(控制点=端点), 适合断言"两支钢笔都被写回"
    // 注意: 写回函数消费的是 SampledSkeletonBindData(_sampleBindData), 不是存储包装对象
    const changed = applyPolylineSamplesToComponents(pens, outBuffer, bindData._sampleBindData)

    expect(changed).toBe(true)
    const after1 = JSON.stringify((g.components[0].value as any).points)
    const after2 = JSON.stringify((g.components[1].value as any).points)
    expect(after1).not.toBe(before1)
    expect(after2).not.toBe(before2)
  })
})
