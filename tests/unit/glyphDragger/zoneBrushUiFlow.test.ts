/**
 * 区域指派刷 UI 事件流模拟测试 (jsdom):
 * 复现「清除后无法继续清除」问题 — 用真实鼠标事件序列驱动选择器。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { glyphSkeletonBind } from '@/features/glyphSkeletonBind'
import { buildRibbonOutline, entryRefLineIdx, type FlatSegment } from '@/features/skeletonFitting'
import { initZoneBrushSelector } from '@/features/tools/skeletonBind'
import { useGlyphStore } from '@/stores/glyph'
import { selectedRefLineIdx, bindEditMode, brushSize } from '@/stores/skeletonDragger'
import { ParameterType } from '@/core/types'
import type { ICustomGlyph } from '@/core/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '../fixtures/shu_zhe_zhe_gou.json')

function loadGlyph(): ICustomGlyph {
  const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8'))
  const components = raw.components.map((c: any) => ({
    uuid: c.uuid, type: c.type, name: c.name,
    value: {
      points: c.points.map((p: any, i: number) => ({
        uuid: `p${i}`, x: p.x, y: p.y,
        type: i % 3 === 0 ? 'anchor' : 'control', origin: null, isShow: true,
      })),
      fillColor: c.fillColor, strokeColor: '#000', closePath: c.closePath,
    },
    x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
    visible: true, lock: false, usedInCharacter: true,
  }))
  const params = raw.params.map((p: any) => ({
    uuid: `param_${p.name}`, name: p.name, type: ParameterType.Number,
    value: p.value, min: p.min ?? 0, max: p.max ?? 1000,
  }))
  return {
    uuid: 'test-szzg', name: '竖折折钩', type: 'system',
    components: components as any, groups: [],
    orderedList: components.map((c: any) => ({ type: 'component', uuid: c.uuid })),
    selectedComponentsTree: [], selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params as any, joints: [], reflines: [], script: '', style: raw.style,
    skeleton: { type: raw.skeleton.type, ox: raw.skeleton.ox, oy: raw.skeleton.oy, dynamicWeight: raw.skeleton.dynamicWeight },
  } as unknown as ICustomGlyph
}

function makeEvent(type: string, button: number, buttons: number, x: number, y: number): MouseEvent {
  const ev = new MouseEvent(type, { button, buttons, bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'offsetX', { value: x })
  Object.defineProperty(ev, 'offsetY', { value: y })
  return ev
}

describe('区域指派刷 UI 事件流', () => {
  let g: ICustomGlyph
  let inst: CustomGlyph
  let ribbon: FlatSegment[]
  let canvas: HTMLCanvasElement
  let closeSelector: () => void
  let od: any
  let samplePoints: number[]

  beforeEach(() => {
    setActivePinia(createPinia())
    g = loadGlyph()
    inst = new CustomGlyph(g)
    strokeFnMap['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)
    strokeFnMap['竖折折钩'].updateSkeletonListenerAfterBind(inst)
    ;(useGlyphStore() as any).editingGlyph = g
    od = (g as any).skeleton.skeletonBindData._outlineOffsetData
    samplePoints = (g as any).skeleton.skeletonBindData._sampleBindData.samplePoints
    // 与面板一致: 优先用绑定时刻的轻量 bindRibbon (旧工程无则按当前骨架重建)
    expect(od.bindRibbon).toBeTruthy()
    ribbon = od.bindRibbon.length
      ? od.bindRibbon
      : buildRibbonOutline(
          (inst as any).getRefLines?.() ?? [],
          (inst as any).getJoints?.() ?? [],
          50,
        ).segments
    canvas = document.createElement('canvas')
    closeSelector = initZoneBrushSelector(canvas, {
      getCoord: (c: number) => c,
      onRender: () => {},
      ribbon,
      onHint: () => {},
    })
    brushSize.value = 100
  })

  function paintAt(x: number, y: number, button: number, move: boolean) {
    canvas.dispatchEvent(makeEvent('mousedown', button, button === 2 ? 2 : 1, x, y))
    if (move) {
      canvas.dispatchEvent(makeEvent('mousemove', button, button === 2 ? 2 : 1, x, y))
    }
    canvas.dispatchEvent(makeEvent('mouseup', button, 0, x, y))
  }

  /** 折1 顶边 (y<450, x 区间) 连续采样下标 */
  function topEdgeIdx(xLo: number, xHi: number): number[] {
    const idxs: number[] = []
    for (let i = 0; i < samplePoints.length / 2; i++) {
      const x = samplePoints[i * 2], y = samplePoints[i * 2 + 1]
      if (y < 450 && x > xLo && x < xHi) idxs.push(i)
    }
    return idxs
  }

  it('指派→清除→再次指派→再次清除 (模式清除) 全程生效', () => {
    // 区域 A: 折1 顶边远端
    const idxA = topEdgeIdx(600, 720)
    expect(idxA.length).toBeGreaterThan(5)
    const midA = Math.floor(idxA.length / 2)
    const posA = { x: samplePoints[idxA[midA] * 2], y: samplePoints[idxA[midA] * 2 + 1] }

    // 指派 A → 折1
    selectedRefLineIdx.value = 1
    bindEditMode.value = 'assign'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBe(1)

    // 清除 A (模式=清除)
    bindEditMode.value = 'clear'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBeUndefined()

    // 再次指派 A → 折2
    selectedRefLineIdx.value = 2
    bindEditMode.value = 'assign'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBe(2)

    // 再次清除 A
    bindEditMode.value = 'clear'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBeUndefined()
    expect(od.overrides!.length).toBe(0)
    closeSelector()
  })

  it('右键 (mousedown button=2) 与 contextmenu 都能清除', () => {
    const idxA = topEdgeIdx(600, 720)
    const midA = Math.floor(idxA.length / 2)
    const posA = { x: samplePoints[idxA[midA] * 2], y: samplePoints[idxA[midA] * 2 + 1] }

    selectedRefLineIdx.value = 1
    bindEditMode.value = 'assign'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBe(1)

    // 物理右键 (mousedown button=2)
    paintAt(posA.x, posA.y, 2, false)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBeUndefined()

    // 重新指派后, mac 双指轻点 (仅 contextmenu 事件)
    bindEditMode.value = 'assign'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBe(1)
    const ctxEv = makeEvent('contextmenu', 2, 0, posA.x, posA.y)
    canvas.dispatchEvent(ctxEv)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBeUndefined()
    closeSelector()
  })

  it('先清除区域 A 再清除区域 B (两处指派, 依次清除)', () => {
    const idxA = topEdgeIdx(600, 720)
    const idxB = topEdgeIdx(300, 450)
    expect(idxA.length).toBeGreaterThan(5)
    expect(idxB.length).toBeGreaterThan(5)
    const midA = Math.floor(idxA.length / 2)
    const posA = { x: samplePoints[idxA[midA] * 2], y: samplePoints[idxA[midA] * 2 + 1] }
    const midB = Math.floor(idxB.length / 2)
    const posB = { x: samplePoints[idxB[midB] * 2], y: samplePoints[idxB[midB] * 2 + 1] }

    // 指派 A 和 B → 折1
    selectedRefLineIdx.value = 1
    bindEditMode.value = 'assign'
    paintAt(posA.x, posA.y, 0, true)
    paintAt(posB.x, posB.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBe(1)
    expect(od.entries[idxB[midB]].forcedRefLineIdx).toBe(1)

    // 清除 A → 只有 A 恢复
    bindEditMode.value = 'clear'
    paintAt(posA.x, posA.y, 0, true)
    expect(od.entries[idxA[midA]].forcedRefLineIdx).toBeUndefined()
    expect(od.entries[idxB[midB]].forcedRefLineIdx).toBe(1)

    // 清除 B → 全部恢复
    paintAt(posB.x, posB.y, 0, true)
    expect(od.entries[idxB[midB]].forcedRefLineIdx).toBeUndefined()
    expect(od.overrides!.length).toBe(0)
    closeSelector()
  })

  it('清除后悬停信息与色带归属正确 (entryRefLineIdx 回自动)', () => {
    const idxA = topEdgeIdx(600, 720)
    const midA = Math.floor(idxA.length / 2)
    const posA = { x: samplePoints[idxA[midA] * 2], y: samplePoints[idxA[midA] * 2 + 1] }
    const autoRef = entryRefLineIdx(od.entries[idxA[midA]], ribbon)

    selectedRefLineIdx.value = 1
    bindEditMode.value = 'assign'
    paintAt(posA.x, posA.y, 0, true)
    expect(entryRefLineIdx(od.entries[idxA[midA]], ribbon)).toBe(1)

    bindEditMode.value = 'clear'
    paintAt(posA.x, posA.y, 0, true)
    expect(entryRefLineIdx(od.entries[idxA[midA]], ribbon)).toBe(autoRef)
    closeSelector()
  })
})
