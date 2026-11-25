/**
 * 钢笔组件位置变换烘焙测试:
 * - 平移/旋转烘焙进 points 并归一化组件
 * - 无需烘焙时保持原样
 * - 写回后归一化不被破坏
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { glyphSkeletonBind } from '@/features/glyphSkeletonBind'
import { applyPolylineSamplesToComponents } from '@/features/skeletonFitting'
import { bakeComponentTransformIntoPoints, getBound, rotatePoint } from '@/core/utils/math'
import { ParameterType } from '@/core/types'
import type { ICustomGlyph } from '@/core/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '../fixtures/shu_zhe_zhe_gou.json')

interface PenBox {
  x?: number
  y?: number
  w?: number
  h?: number
  rotation?: number
  flipX?: boolean
  flipY?: boolean
}

function loadGlyph(boxOverride?: PenBox): ICustomGlyph {
  const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8'))
  const comp = {
    uuid: 'pen-1',
    type: 'pen',
    name: raw.components[0].name,
    value: {
      points: raw.components[0].points.map((p: any, i: number) => ({
        uuid: `p${i}`, x: p.x, y: p.y,
        type: i % 3 === 0 ? 'anchor' : 'control', origin: null, isShow: true,
      })),
      fillColor: raw.components[0].fillColor,
      strokeColor: '#000',
      closePath: raw.components[0].closePath,
    },
    x: boxOverride?.x ?? 0,
    y: boxOverride?.y ?? 0,
    w: boxOverride?.w ?? 0,
    h: boxOverride?.h ?? 0,
    rotation: boxOverride?.rotation ?? 0,
    flipX: boxOverride?.flipX ?? false,
    flipY: boxOverride?.flipY ?? false,
    visible: true, lock: false, usedInCharacter: true,
  }
  const params = raw.params.map((p: any) => ({
    uuid: `param_${p.name}`, name: p.name, type: ParameterType.Number,
    value: p.value, min: p.min ?? 0, max: p.max ?? 1000,
  }))
  return {
    uuid: 'test-szzg', name: '竖折折钩', type: 'system',
    components: [comp as any], groups: [],
    orderedList: [{ type: 'component', uuid: comp.uuid }],
    selectedComponentsTree: [], selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params as any, joints: [], reflines: [], script: '', style: raw.style,
    skeleton: { type: raw.skeleton.type, ox: raw.skeleton.ox, oy: raw.skeleton.oy, dynamicWeight: raw.skeleton.dynamicWeight },
  } as unknown as ICustomGlyph
}

function buildAndBind(g: ICustomGlyph) {
  const inst = new CustomGlyph(g)
  ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
  glyphSkeletonBind(inst)
  return { inst, bindData: (g.skeleton as any).skeletonBindData }
}

describe('pen component transform bake', () => {
  it('平移烘焙: points 平移且组件归一化, 采样包围盒随移', () => {
    // 未移动的参照绑定(采样包围盒基准)
    const baseG = loadGlyph({ x: 0, y: 0, w: 0, h: 0 })
    const { bindData: baseBind } = buildAndBind(baseG)
    const baseSp = baseBind._sampleBindData.samplePoints as number[]
    let baseMinX = Infinity, baseMinY = Infinity
    for (let i = 0; i < baseSp.length; i += 2) {
      if (baseSp[i] < baseMinX) baseMinX = baseSp[i]
      if (baseSp[i + 1] < baseMinY) baseMinY = baseSp[i + 1]
    }

    const g = loadGlyph({})
    const rawPoints = (g.components[0].value as any).points as Array<{ x: number; y: number }>
    const rawBbox = getBound(rawPoints)
    const comp = g.components[0] as any
    comp.x = rawBbox.x + 100
    comp.y = rawBbox.y + 50
    comp.w = rawBbox.w
    comp.h = rawBbox.h

    const before0 = rawPoints[0]
    // 预置过期轮廓缓存, 验证烘焙清除(引入字符后列表预览不得复用旧轮廓)
    const penVal = (g.components[0].value as any)
    penVal.contour = [{ start: { x: 1, y: 1 } }]
    penVal.preview = [{ start: { x: 2, y: 2 } }]
    const { bindData } = buildAndBind(g)

    // 组件归一化
    expect(comp.rotation).toBe(0)
    expect(penVal.contour).toBeUndefined()
    expect(penVal.preview).toBeUndefined()
    const newPts = (g.components[0].value as any).points as Array<{ x: number; y: number }>
    expect(newPts[0].x).toBeCloseTo(before0.x + 100, 3)
    expect(newPts[0].y).toBeCloseTo(before0.y + 50, 3)
    const newBbox = getBound(newPts)
    expect(comp.x).toBeCloseTo(newBbox.x, 3)
    expect(comp.y).toBeCloseTo(newBbox.y, 3)
    expect(comp.w).toBeCloseTo(newBbox.w, 3)
    expect(comp.h).toBeCloseTo(newBbox.h, 3)
    // 采样包围盒随移(与未移动参照的差 = 移动量)
    const sp = bindData._sampleBindData.samplePoints as number[]
    let minX = Infinity, minY = Infinity
    for (let i = 0; i < sp.length; i += 2) {
      if (sp[i] < minX) minX = sp[i]
      if (sp[i + 1] < minY) minY = sp[i + 1]
    }
    expect(minX).toBeCloseTo(baseMinX + 100, 0)
    expect(minY).toBeCloseTo(baseMinY + 50, 0)
  })

  it('旋转烘焙: rotation 归零且锚点绕放置中心旋转(渲染器语义)', () => {
    const g = loadGlyph({})
    const rawPoints = (g.components[0].value as any).points as Array<{ x: number; y: number }>
    const rawBbox = getBound(rawPoints)
    const comp = g.components[0] as any
    comp.x = rawBbox.x
    comp.y = rawBbox.y
    comp.w = rawBbox.w
    comp.h = rawBbox.h
    comp.rotation = 90
    const p0 = { x: rawPoints[0].x, y: rawPoints[0].y }
    const center = { x: comp.x + comp.w / 2, y: comp.y + comp.h / 2 }
    const expected = rotatePoint(p0, center, 90)

    buildAndBind(g)

    expect(comp.rotation).toBe(0)
    const newPts = (g.components[0].value as any).points as Array<{ x: number; y: number }>
    expect(newPts[0].x).toBeCloseTo(expected.x, 3)
    expect(newPts[0].y).toBeCloseTo(expected.y, 3)
  })

  it('无需烘焙: 组件无有效变换时 points 原样', () => {
    const g = loadGlyph({ x: 0, y: 0, w: 0, h: 0 })
    const before = JSON.stringify((g.components[0].value as any).points)
    buildAndBind(g)
    expect(JSON.stringify((g.components[0].value as any).points)).toBe(before)
  })

  it('烘焙绑定后写回不破坏归一化', () => {
    const g = loadGlyph({})
    const rawPoints = (g.components[0].value as any).points as Array<{ x: number; y: number }>
    const rawBbox = getBound(rawPoints)
    const comp = g.components[0] as any
    comp.x = rawBbox.x + 100
    comp.y = rawBbox.y + 50
    comp.w = rawBbox.w
    comp.h = rawBbox.h

    const { bindData } = buildAndBind(g)
    const src = bindData._sampleBindData.samplePoints as number[]
    const out = new Float64Array(src.length)
    for (let i = 0; i < src.length; i += 2) {
      out[i] = src[i] + 10
      out[i + 1] = src[i + 1] + 10
    }
    const pens = (g.components || []).filter((c: any) => c.type === 'pen') as any[]
    const changed = applyPolylineSamplesToComponents(pens, out, bindData._sampleBindData)
    expect(changed).toBe(true)
    const pts = (g.components[0].value as any).points as Array<{ x: number; y: number }>
    const bbox = getBound(pts)
    expect(comp.x).toBeCloseTo(bbox.x, 3)
    expect(comp.y).toBeCloseTo(bbox.y, 3)
    expect(comp.w).toBeCloseTo(bbox.w, 3)
    expect(comp.h).toBeCloseTo(bbox.h, 3)
    expect(comp.rotation).toBe(0)
  })
})
