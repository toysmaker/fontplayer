/**
 * 竖折折钩 手绘轮廓骨架拖拽回归测试 (fixture: AI 生成的真实笔画数据)
 *
 * 覆盖两处已修复的缺陷:
 * 1. 锁定区间 (min===max) 参数在拖拽重算时被夹成 0, 导致拖任何关节时整竖跳动
 *    (computeParamsByJoints 的 spanValue 保留设计常量)
 * 2. 段长被拖到接近 0 时骨骼塌缩, 采样点折叠产生尖锐毛刺
 *    (fitSamplesToBeziers 去重近重合点 + 骨骼缩放钳制 + 预览折线跳过过短段)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { setSkeletonTransformPreview, glyphSkeletonBind } from '@/features/glyphSkeletonBind'
import { buildRibbonOutline, applyOutlineOffsetDeformation } from '@/features/skeletonFitting'
import { ParameterType } from '@/core/types'
import type { ICustomGlyph } from '@/core/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '../fixtures/shu_zhe_zhe_gou.json')

interface FixPenPoint { x: number; y: number }

function loadGlyph(): ICustomGlyph {
  const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8'))
  const components = raw.components.map((c: any) => ({
    uuid: c.uuid,
    type: c.type,
    name: c.name,
    value: {
      points: c.points.map((p: FixPenPoint, i: number) => ({
        uuid: `p${i}`,
        x: p.x,
        y: p.y,
        type: i % 3 === 0 ? 'anchor' : 'control',
        origin: null,
        isShow: true,
      })),
      fillColor: c.fillColor,
      strokeColor: '#000',
      closePath: c.closePath,
    },
    x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
    visible: true, lock: false, usedInCharacter: true,
  }))
  const params = raw.params.map((p: any) => ({
    uuid: `param_${p.name}`,
    name: p.name,
    type: ParameterType.Number,
    value: p.value,
    min: p.min ?? 0,
    max: p.max ?? 1000,
  }))
  const skeleton: any = {
    type: raw.skeleton.type,
    ox: raw.skeleton.ox,
    oy: raw.skeleton.oy,
    dynamicWeight: raw.skeleton.dynamicWeight,
  }

  return {
    uuid: 'test-szzg',
    name: '竖折折钩',
    type: 'system',
    components: components as any,
    groups: [],
    orderedList: components.map((c: any) => ({ type: 'component', uuid: c.uuid })),
    selectedComponentsTree: [],
    selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params as any,
    joints: [],
    reflines: [],
    script: '',
    style: raw.style,
    skeleton,
  } as unknown as ICustomGlyph
}

function buildInstance() {
  const g = loadGlyph()
  const inst = new CustomGlyph(g)
  strokeFnMap['竖折折钩'].instanceBasicGlyph(g, inst)
  // 真实绑定流程 (生成采样绑定数据 + 参数化轮廓细节迁移绑定)
  glyphSkeletonBind(inst)
  strokeFnMap['竖折折钩'].updateSkeletonListenerAfterBind(inst)
  return { g, inst }
}

function drag(inst: CustomGlyph, jointName: string, dx: number, dy: number) {
  inst.onSkeletonDragStart!({ draggingJoint: { name: jointName }, deltaX: 0, deltaY: 0 })
  inst.onSkeletonDrag!({ draggingJoint: { name: jointName }, deltaX: dx, deltaY: dy })
}

/** 贝塞尔段控制点偏移/弦长比 (毛刺度量: 平滑曲线 ~0.33, 毛刺 >> 1) */
function spikeMetrics(inst: CustomGlyph): { max: number; count: number } {
  let max = 0
  let count = 0
  for (const comp of inst.components) {
    if (comp.type !== 'pen') continue
    const pts = comp.value.points as FixPenPoint[]
    for (let i = 0; i + 3 < pts.length; i += 3) {
      const p0 = pts[i], c1 = pts[i + 1], c2 = pts[i + 2], p3 = pts[i + 3]
      const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y) || 1
      const d1 = Math.hypot(c1.x - p0.x, c1.y - p0.y) / chord
      const d3 = Math.hypot(c2.x - p3.x, c2.y - p3.y) / chord
      const r = Math.max(d1, d3)
      if (r > max) max = r
      if (r > 1.5) count++
    }
  }
  return { max, count }
}

function boneMatrixDelta(bone: any): number {
  const m = bone.currentMatrix
  return Math.hypot(m[0] - 1, m[1], m[2], m[3] - 1, m[4], m[5])
}

describe('竖折折钩 手绘轮廓骨架拖拽', () => {
  it('拖拽钩时竖段轮廓不动 (细节迁移路径 + 锁定区间参数不被夹成 0)', () => {
    const { g, inst } = buildInstance()
    // 细节迁移绑定已构建 (变形不再走 LBS 骨骼)
    const sbd = (g.skeleton as any).skeletonBindData
    expect(sbd._outlineOffsetData).toBeTruthy()
    expect(sbd._outlineOffsetData.entries.length).toBeGreaterThan(0)

    // 拖拽钩 (30,30): 细节迁移变形后按区域度量采样点位移
    drag(inst, 'gou_end', 30, 30)
    const samplePoints = sbd._sampleBindData.samplePoints as number[]
    const out = new Float64Array(samplePoints.length)
    const reflines = (inst as any).getRefLines?.() ?? []
    const joints = (inst as any).getJoints?.() ?? []
    const ribbon = buildRibbonOutline(reflines, joints, 50, sbd._outlineOffsetData.arcSigns)
    applyOutlineOffsetDeformation(sbd._outlineOffsetData, ribbon.segments, out)

    let maxShuMove = 0
    let maxGouMove = 0
    for (let i = 0; i < samplePoints.length / 2; i++) {
      const d = Math.hypot(out[i * 2] - samplePoints[i * 2], out[i * 2 + 1] - samplePoints[i * 2 + 1])
      if (samplePoints[i * 2 + 1] < 450) maxShuMove = Math.max(maxShuMove, d)
      else if (samplePoints[i * 2 + 1] > 700) maxGouMove = Math.max(maxGouMove, d)
    }
    // 竖区域完全不动, 钩区域跟随拖拽 (30,30 → ~42 位移)
    expect(maxShuMove).toBeLessThan(0.5)
    expect(maxGouMove).toBeGreaterThan(10)
    expect(maxGouMove).toBeLessThan(80)

    // 锁定参数 竖-水平延伸 保持 -10, 不被夹成 0
    const p = g.parameters.find((x: any) => x.name === '竖-水平延伸')
    expect((p as any).value).toBe(-10)
  })

  it('缩短竖 (200→30) 无爆炸性毛刺 (拟合与预览折线)', () => {
    const { inst } = buildInstance()
    drag(inst, 'shu_end', 0, -170)
    const m = spikeMetrics(inst)
    // 细节迁移路径下角部不再折叠; 笔帽过渡区的轻微扭结 (r<4) 为已知残余
    expect(m.count).toBeLessThanOrEqual(6)
    expect(m.max).toBeLessThan(4)

    // 预览折线模式: 无 >120° 方向反转, 无近零段
    const { inst: inst2 } = buildInstance()
    setSkeletonTransformPreview(true)
    try {
      drag(inst2, 'shu_end', 0, -170)
    } finally {
      setSkeletonTransformPreview(false)
    }
    let folds = 0
    for (const comp of inst2.components) {
      if (comp.type !== 'pen') continue
      const pts = comp.value.points as FixPenPoint[]
      const anchors: FixPenPoint[] = []
      for (let i = 0; i < pts.length; i += 3) anchors.push(pts[i])
      for (let i = 2; i < anchors.length - 1; i++) {
        const v1 = { x: anchors[i].x - anchors[i - 1].x, y: anchors[i].y - anchors[i - 1].y }
        const v2 = { x: anchors[i + 1].x - anchors[i].x, y: anchors[i + 1].y - anchors[i].y }
        const l1 = Math.hypot(v1.x, v1.y)
        const l2 = Math.hypot(v2.x, v2.y)
        // 只统计可见段 (≥2 UPM) 之间的方向反转 — 压缩区密集短段的角度抖动是亚像素噪声
        if (l1 < 2 || l2 < 2) continue
        const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2)
        if (cos < -0.5) folds++
      }
    }
    // 极端压缩时笔帽过渡区的可见折叠为已知残余 (细节迁移后较 LBS 大幅减少)
    expect(folds).toBeLessThanOrEqual(6)
  })

  it('极端塌缩 (竖 200→0) 毛刺受控 (无爆炸性控制点)', () => {
    const { inst } = buildInstance()
    drag(inst, 'shu_end', 0, -200)
    const m = spikeMetrics(inst)
    // 完全塌缩: 带子本身合法, 仅笔帽过渡区的轻微扭结 (此前 LBS 为 27 倍爆炸)
    expect(m.max).toBeLessThan(4)
    expect(m.count).toBeLessThanOrEqual(6)
  })
})
