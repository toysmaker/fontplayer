/**
 * 手动绑定区域指派刷核心函数测试 (docs/manual-binding-design.md 3.4)
 * - 带子段骨架段归属 (refLineIdx / arcAdjRefLines)
 * - 重投影 / 恢复自动匹配
 * - override run 合并/切分
 * - 手动指派后变形仍无折叠 (与细节迁移管线兼容)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { glyphSkeletonBind } from '@/features/glyphSkeletonBind'
import {
  buildRibbonOutline,
  reprojectEntriesToRefLine,
  restoreAutomaticEntries,
  applyOverrideRuns,
  entryRefLineIdx,
  applyOutlineOffsetDeformation,
  type FlatSegment,
} from '@/features/skeletonFitting'
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

function buildInstance() {
  const g = loadGlyph()
  const inst = new CustomGlyph(g)
  strokeFnMap['竖折折钩'].instanceBasicGlyph(g, inst)
  glyphSkeletonBind(inst)
  strokeFnMap['竖折折钩'].updateSkeletonListenerAfterBind(inst)
  return { g, inst }
}

function buildRibbon(inst: CustomGlyph): FlatSegment[] {
  const reflines = (inst as any).getRefLines?.() ?? []
  const joints = (inst as any).getJoints?.() ?? []
  return buildRibbonOutline(reflines, joints, 50).segments
}

function drag(inst: CustomGlyph, jointName: string, dx: number, dy: number) {
  inst.onSkeletonDragStart!({ draggingJoint: { name: jointName }, deltaX: 0, deltaY: 0 })
  inst.onSkeletonDrag!({ draggingJoint: { name: jointName }, deltaX: dx, deltaY: dy })
}

describe('区域指派刷核心', () => {
  it('带子段带骨架段归属 (refLineIdx / arcAdjRefLines)', () => {
    const { inst } = buildInstance()
    const ribbon = buildRibbon(inst)
    // 竖折折钩 4 条 main 辅助线 (shu/zhe1/zhe2/gou):
    // 边线段有归属; 角弧段有邻接; 端点圆帽归属相邻段 ([0,0] / [3,3], 可视化用, 不参与指派)
    let capSegs = 0
    for (const sgm of ribbon) {
      expect(typeof sgm.refLineIdx).toBe('number')
      if (sgm.refLineIdx >= 0) continue
      expect(sgm.arcAdjRefLines).toBeDefined()
      capSegs++
    }
    expect(capSegs).toBeGreaterThan(0)
    // 圆帽邻接: 起笔 → [0,0], 收笔 → [3,3]
    const capAdj = ribbon.filter((s) => s.refLineIdx < 0).map((s) => s.arcAdjRefLines!.join(','))
    expect(capAdj.some((a) => a === '0,0')).toBe(true)
    expect(capAdj.some((a) => a === '3,3')).toBe(true)
    // 每个骨架段都至少有一个归属段
    const counts = [0, 0, 0, 0]
    for (const sgm of ribbon) {
      if (sgm.refLineIdx >= 0) counts[sgm.refLineIdx]++
      sgm.arcAdjRefLines?.forEach((r) => { counts[r]++ })
    }
    for (const c of counts) expect(c).toBeGreaterThan(0)
    // 圆帽不可被手动指派 (候选集只含 refLineIdx === 目标)
    const startCap = ribbon.find((s) => s.refLineIdx < 0 && s.arcAdjRefLines![0] === 0)!
    expect(startCap.refLineIdx).toBe(-1)
  })

  it('重投影到折1 后区间内条目全部归属折1, 恢复后与自动匹配一致', () => {
    const { g, inst } = buildInstance()
    const sbd = (g as any).skeleton.skeletonBindData
    const od = sbd._outlineOffsetData
    const samplePoints = sbd._sampleBindData.samplePoints as number[]
    const ribbon = buildRibbon(inst)

    // 取折1末尾角部附近的连续采样区间 (y < 460, x > 640)
    const idxs: number[] = []
    for (let i = 0; i < samplePoints.length / 2; i++) {
      if (samplePoints[i * 2 + 1] < 460 && samplePoints[i * 2] > 640) idxs.push(i)
    }
    expect(idxs.length).toBeGreaterThan(5)
    const start = idxs[0]
    const end = idxs[idxs.length - 1]

    // 快照自动匹配
    const before = (start: number, end: number) => {
      const snap: Array<{ seg: number; s: number; u: number; v: number }> = []
      for (let i = start; i <= end; i++) {
        const e = od.entries[i]
        snap.push({ seg: e.bezierIdx, s: e.s, u: e.u, v: e.v })
      }
      return snap
    }
    const snap = before(start, end)

    // 指派到折1 (辅助线下标 1): 候选集仅含折1 自身边线, 不含共享角弧
    reprojectEntriesToRefLine(od, ribbon, start, end, 1)
    for (let i = start; i <= end; i++) {
      const e = od.entries[i]
      const sgm = ribbon[e.bezierIdx]
      // 锚点必须在折1 自身的边线段上 (共享角弧被排除, 否则指派不改变变形)
      expect(sgm?.refLineIdx).toBe(1)
      expect(e.u).toBeDefined()
      expect(e.v).toBeDefined()
      expect(e.bindSegLen).toBeGreaterThan(0)
      // 手动指派记录目标骨架段: 着色/悬停查看按目标显示
      expect(e.forcedRefLineIdx).toBe(1)
      expect(entryRefLineIdx(e, ribbon)).toBe(1)
    }
    // override run 记录
    applyOverrideRuns(od, start, end, 1)
    expect(od.overrides!.length).toBeGreaterThan(0)
    expect(od.overrides!.some((r: any) => idxs.every((i) => i >= r.start && i <= r.end))).toBe(true)

    // 恢复自动匹配 → 与快照一致 (forcedRefLineIdx 清除)
    restoreAutomaticEntries(od, ribbon, start, end)
    const snap2 = before(start, end)
    for (let k = 0; k < snap.length; k++) {
      expect(snap2[k].seg).toBe(snap[k].seg)
      expect(snap2[k].s).toBe(snap[k].s)
      expect(Math.abs(snap2[k].u - snap[k].u)).toBeLessThan(1e-6)
      expect(Math.abs(snap2[k].v - snap[k].v)).toBeLessThan(1e-6)
      expect(od.entries[start + k].forcedRefLineIdx).toBeUndefined()
    }
    applyOverrideRuns(od, start, end, null)
    expect(od.overrides!.length).toBe(0)
  })

  it('override run 合并/切分', () => {
    const { g } = buildInstance()
    const od = (g as any).skeleton.skeletonBindData._outlineOffsetData
    applyOverrideRuns(od, 5, 10, 1)
    applyOverrideRuns(od, 11, 20, 1)   // 相邻同段 → 合并 [5,20]
    expect(od.overrides!.length).toBe(1)
    expect(od.overrides![0].start).toBe(5)
    expect(od.overrides![0].end).toBe(20)

    applyOverrideRuns(od, 8, 12, 2)    // 中间改段 → 切分
    expect(od.overrides!.length).toBe(3)
    expect(od.overrides![0]).toEqual({ start: 5, end: 7, refLineIdx: 1 })
    expect(od.overrides![1]).toEqual({ start: 8, end: 12, refLineIdx: 2 })
    expect(od.overrides![2]).toEqual({ start: 13, end: 20, refLineIdx: 1 })

    applyOverrideRuns(od, 8, 12, null) // 清除中间 → 恢复两侧
    expect(od.overrides!.length).toBe(2)
    expect(od.overrides![0]).toEqual({ start: 5, end: 7, refLineIdx: 1 })
    expect(od.overrides![1]).toEqual({ start: 13, end: 20, refLineIdx: 1 })
    od.overrides = []
  })

  it('手动指派后拖拽变形仍无折叠 (与细节迁移管线兼容)', () => {
    const { g, inst } = buildInstance()
    const sbd = (g as any).skeleton.skeletonBindData
    const od = sbd._outlineOffsetData
    const samplePoints = sbd._sampleBindData.samplePoints as number[]
    const ribbon = buildRibbon(inst)

    // 把角部附近采样点全部指派到折1 (人工强化角部剪切, 验证 D 平滑兜底)
    const idxs: number[] = []
    for (let i = 0; i < samplePoints.length / 2; i++) {
      const x = samplePoints[i * 2], y = samplePoints[i * 2 + 1]
      if (Math.hypot(x - 750, y - 450) < 120) idxs.push(i)
    }
    expect(idxs.length).toBeGreaterThan(10)
    reprojectEntriesToRefLine(od, ribbon, idxs[0], idxs[idxs.length - 1], 1)

    // 收缩折1 (-200)
    drag(inst, 'zhe1_end', -200, 0)
    const reflines = (inst as any).getRefLines?.() ?? []
    const joints = (inst as any).getJoints?.() ?? []
    const ribbon2 = buildRibbonOutline(reflines, joints, 50, od.arcSigns)
    const out = new Float64Array(samplePoints.length)
    applyOutlineOffsetDeformation(od, ribbon2.segments, out)

    let folds = 0
    const n = samplePoints.length / 2
    for (let i = 0; i < n; i++) {
      const a = { x: out[i * 2], y: out[i * 2 + 1] }
      const b = { x: out[((i + 1) % n) * 2], y: out[((i + 1) % n) * 2 + 1] }
      const c = { x: out[((i + 2) % n) * 2], y: out[((i + 2) % n) * 2 + 1] }
      const v1 = { x: b.x - a.x, y: b.y - a.y }
      const v2 = { x: c.x - b.x, y: c.y - b.y }
      const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y)
      if (l1 < 2 || l2 < 2) continue
      const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2)
      if (cos < -0.5) folds++
    }
    // 手动指派后 D 平滑仍兜底, 无方向反转
    expect(folds).toBe(0)
  })
})
