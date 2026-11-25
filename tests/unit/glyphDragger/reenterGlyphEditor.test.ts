/**
 * 复现: 字形编辑界面 创建钢笔 → 绑定骨架 → 退出 → 重新进入 → 轮廓扭曲
 *
 * 重进时 GlyphEditor.onMounted 执行 executeGlyphScript(editingGlyph):
 *   skeleton 分支 → strokeFn.instanceBasicGlyph + updateSkeletonTransformation
 * 本测试模拟: bind → R.clone(退出保存+重进加载) → instanceBasicGlyph + updateSkeletonTransformation
 * 断言轮廓点不变(恒等)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as R from 'ramda'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { strokeFnMap, updateSkeletonTransformation } from '@/templates/strokeFnMap'
import { glyphSkeletonBind, skeletonToBones } from '@/features/glyphSkeletonBind'
import { measurePenComponentsWeight } from '@/features/glyphWeight'
import { ParameterType } from '@/core/types'
import type { ICustomGlyph } from '@/core/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '../fixtures/shu_zhe_zhe_gou.json')

function loadGlyph(boxOverride?: { x?: number; y?: number; w?: number; h?: number; rotation?: number }): ICustomGlyph {
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
    flipX: false,
    flipY: false,
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

function pointsOf(g: ICustomGlyph): Array<{ x: number; y: number }> {
  return (g.components[0].value as any).points.map((p: any) => ({ x: p.x, y: p.y }))
}

/** executeGlyphScript skeleton 分支等价操作(不含 store 依赖) */
function simulateReenter(g: ICustomGlyph): void {
  const inst = new CustomGlyph(g)
  inst.clear()
  ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
  updateSkeletonTransformation(inst)
}

describe('re-enter glyph editor after skeleton bind', () => {
  it('绑定后退出再进入(恒等骨架) 轮廓点应保持不变', () => {
    const g = loadGlyph({ x: 0, y: 0, w: 0, h: 0 })
    const inst = new CustomGlyph(g)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)
    const afterBind = pointsOf(g)

    // 退出: updateGlyphListFromEditFile 的 R.clone → 重进: setEditGlyphByUUID 的 R.clone
    const g2 = R.clone(g) as ICustomGlyph
    simulateReenter(g2)

    const afterReenter = pointsOf(g2)
    let maxDiff = 0
    for (let i = 0; i < afterBind.length; i++) {
      const d = Math.hypot(afterBind[i].x - afterReenter[i].x, afterBind[i].y - afterReenter[i].y)
      if (d > maxDiff) maxDiff = d
    }
    if (import.meta.env.DEV) {
      console.log('[reenter-test] maxDiff=', maxDiff)
    }
    expect(maxDiff).toBeLessThan(0.5)
  })

  it('带有效平移盒的钢笔: 绑定(烘焙)后退出再进入 轮廓点应保持不变', () => {
    const g = loadGlyph({ x: 0, y: 0, w: 0, h: 0 })
    const rawPts = pointsOf(g)
    // 模拟钢笔被移动过: 有效盒 = 包围盒 + 位移
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of rawPts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }
    const comp = g.components[0] as any
    comp.x = minX + 100
    comp.y = minY + 50
    comp.w = maxX - minX
    comp.h = maxY - minY

    const inst = new CustomGlyph(g)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)
    const afterBind = pointsOf(g)

    const g2 = R.clone(g) as ICustomGlyph
    simulateReenter(g2)

    const afterReenter = pointsOf(g2)
    let maxDiff = 0
    for (let i = 0; i < afterBind.length; i++) {
      const d = Math.hypot(afterBind[i].x - afterReenter[i].x, afterBind[i].y - afterReenter[i].y)
      if (d > maxDiff) maxDiff = d
    }
    if (import.meta.env.DEV) {
      console.log('[reenter-test] bbox-case maxDiff=', maxDiff)
    }
    expect(maxDiff).toBeLessThan(0.5)
  })

  it('修复后流程: 绑定前先以实测宽度回写字重参数并重建骨架, 重进轮廓保持不变', () => {
    const g = loadGlyph({ x: 0, y: 0, w: 0, h: 0 })
    const inst = new CustomGlyph(g)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)

    // 修复后的 bindSkeleton(GlyphParamsPanel) 顺序:
    // 测量实际宽度 → 回写字重参数 → 以最终字重重建实例骨架 → 绑定
    const penComponents = (g.components || []).filter((c: any) => c.type === 'pen')
    const measured = measurePenComponentsWeight(penComponents, skeletonToBones((inst as any).getSkeleton()))
    const wParam = (g.parameters as any[]).find((p: any) => p.name === '字重')
    if (wParam) wParam.value = measured
    ;(g.skeleton as any).originWeight = measured
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)
    const afterBind = pointsOf(g)
    if (import.meta.env.DEV) {
      console.log('[reenter-test] measuredWeight=', measured)
    }

    const g2 = R.clone(g) as ICustomGlyph
    simulateReenter(g2)

    const afterReenter = pointsOf(g2)
    let maxDiff = 0
    for (let i = 0; i < afterBind.length; i++) {
      const d = Math.hypot(afterBind[i].x - afterReenter[i].x, afterBind[i].y - afterReenter[i].y)
      if (d > maxDiff) maxDiff = d
    }
    if (import.meta.env.DEV) {
      console.log('[reenter-test] fixed-order maxDiff=', maxDiff)
    }
    expect(maxDiff).toBeLessThan(0.5)
  })

  it('重进后点击修改骨架, 拖拽第一个关键点(shu_start)应整体移动骨架', () => {
    const g = loadGlyph({ x: 0, y: 0, w: 0, h: 0 })
    const inst = new CustomGlyph(g)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    // 修复后的 bindSkeleton 顺序
    const penComponents = (g.components || []).filter((c: any) => c.type === 'pen')
    const measured = measurePenComponentsWeight(penComponents, skeletonToBones((inst as any).getSkeleton()))
    const wParam = (g.parameters as any[]).find((p: any) => p.name === '字重')
    if (wParam) wParam.value = measured
    ;(g.skeleton as any).originWeight = measured
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g, inst)
    glyphSkeletonBind(inst)

    // 退出 + 重进(executeGlyphScript skeleton 分支等价)
    const g2 = R.clone(g) as ICustomGlyph
    const inst2 = new CustomGlyph(g2)
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g2, inst2)
    updateSkeletonTransformation(inst2)
    ;(strokeFnMap as any)['竖折折钩'].updateSkeletonListenerAfterBind(inst2)

    // 点击修改骨架: 重建实例骨架 + before-bind 监听器
    ;(strokeFnMap as any)['竖折折钩'].instanceBasicGlyph(g2, inst2)
    ;(strokeFnMap as any)['竖折折钩'].updateSkeletonListenerBeforeBind(inst2)

    const jointCoord = (name: string): { x: number; y: number } => {
      const j = (inst2 as any).getJoints().find((jj: any) => jj.name === name)
      return {
        x: typeof j.x === 'function' ? j.x() : j.x,
        y: typeof j.y === 'function' ? j.y() : j.y,
      }
    }
    const before = jointCoord('shu_start')
    const beforeGou = jointCoord('gou_end')

    // 拖拽第一个关键点 (40, -30): 整个骨架应整体平移
    ;(inst2 as any).onSkeletonDragStart({ draggingJoint: { name: 'shu_start' }, deltaX: 0, deltaY: 0 })
    ;(inst2 as any).onSkeletonDrag({ draggingJoint: { name: 'shu_start' }, deltaX: 40, deltaY: -30 })

    const after = jointCoord('shu_start')
    const afterGou = jointCoord('gou_end')
    if (import.meta.env.DEV) {
      console.log('[reenter-test] shu_start before=', before, 'after=', after)
    }
    expect(after.x).toBeCloseTo(before.x + 40, 3)
    expect(after.y).toBeCloseTo(before.y - 30, 3)
    // 其余关节跟随整体平移
    expect(afterGou.x).toBeCloseTo(beforeGou.x + 40, 3)
    expect(afterGou.y).toBeCloseTo(beforeGou.y - 30, 3)
    // ox/oy 同步更新
    expect((g2.skeleton as any).ox).toBeCloseTo(40, 3)
    expect((g2.skeleton as any).oy).toBeCloseTo(-30, 3)
  })
})
