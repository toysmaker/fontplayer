/**
 * 骨架拖拽预览写回 (折线) 与最终拟合写回的单元测试
 * 验证: 预览模式产出退化贝塞尔直线段 (控制点=端点); 拟合模式产出真实曲线
 */
import { describe, it, expect } from 'vitest'
import {
  applyPolylineSamplesToComponents,
  applyFittedSamplesToComponents,
} from '@/features/skeletonFitting'
import type { SampledSkeletonBindData, Bone } from '@/features/skeletonSampling'
import type { IGlyphComponent, IPenComponent } from '@/core/types'

function makeCircleSamples(n: number, cx: number, cy: number, r: number): number[] {
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  return pts
}

function makeBindData(outBuffer: Float64Array): SampledSkeletonBindData {
  const n = 24
  const bones: Bone[] = []
  return {
    bones,
    samplePoints: makeCircleSamples(n, 500, 500, 200),
    componentSampleRanges: [{ componentUUID: 'c1', start: 0, end: n }],
    componentSegmentMeta: [{ componentUUID: 'c1', samplesPerSegment: [n], closePath: true }],
  } as unknown as SampledSkeletonBindData
}

function makePenComponent(points: Array<{ x: number; y: number }>): IGlyphComponent {
  return {
    uuid: 'c1',
    type: 'pen',
    name: 'pic-contour',
    value: {
      points,
      fillColor: '#000',
      strokeColor: '#000',
      closePath: true,
    } as unknown as IPenComponent,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  } as unknown as IGlyphComponent
}

/** 平移圆 (变换后的采样点) */
function shiftedOutBuffer(): Float64Array {
  const src = makeCircleSamples(24, 500, 500, 200)
  const out = new Float64Array(src.length)
  for (let i = 0; i < src.length / 2; i++) {
    out[i * 2] = src[i * 2] + 30
    out[i * 2 + 1] = src[i * 2 + 1] - 20
  }
  return out
}

describe('skeleton transform preview (折线预览) 与拟合写回', () => {
  it('预览写回产出退化贝塞尔直线段 (控制点=端点), 且更新包围盒', () => {
    const pen = makePenComponent([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
    const out = shiftedOutBuffer()
    const bindData = makeBindData(out)

    const changed = applyPolylineSamplesToComponents([pen], out, bindData)
    expect(changed).toBe(true)

    const pts = (pen.value as unknown as IPenComponent).points as Array<{ x: number; y: number }>
    // 24 采样点闭合段: 23 条直线段 → 首段 4 点 + 22×3 点 = 70
    expect(pts.length).toBe(70)

    // 每条贝塞尔: c1 === p0, c2 === p3 (退化直线)
    for (let i = 0; i + 3 < pts.length; i += 3) {
      const p0 = pts[i]
      const c1 = pts[i + 1]
      const c2 = pts[i + 2]
      const p3 = pts[i + 3]
      expect(c1.x).toBeCloseTo(p0.x, 10)
      expect(c1.y).toBeCloseTo(p0.y, 10)
      expect(c2.x).toBeCloseTo(p3.x, 10)
      expect(c2.y).toBeCloseTo(p3.y, 10)
    }

    // 包围盒更新 (圆心 (530,480) r=200 → [330,280]-[730,680])
    expect((pen as any).x).toBeCloseTo(330, 6)
    expect((pen as any).y).toBeCloseTo(280, 6)
    expect((pen as any).w).toBeCloseTo(400, 6)
    expect((pen as any).h).toBeCloseTo(400, 6)
  })

  it('拟合写回产出真实曲线 (控制点与端点不同), 且同样更新包围盒', () => {
    const pen = makePenComponent([{ x: 0, y: 0 }])
    const out = shiftedOutBuffer()
    const bindData = makeBindData(out)

    const changed = applyFittedSamplesToComponents([pen], out, bindData)
    expect(changed).toBe(true)

    const pts = (pen.value as unknown as IPenComponent).points as Array<{ x: number; y: number }>
    expect(pts.length).toBeGreaterThanOrEqual(4)

    // 圆拟合出的曲线控制点应偏离端点 (非退化直线)
    let anyCurved = false
    for (let i = 0; i + 3 < pts.length; i += 3) {
      const p0 = pts[i]
      const c1 = pts[i + 1]
      const c2 = pts[i + 2]
      const p3 = pts[i + 3]
      if (
        Math.abs(c1.x - p0.x) > 1 ||
        Math.abs(c1.y - p0.y) > 1 ||
        Math.abs(c2.x - p3.x) > 1 ||
        Math.abs(c2.y - p3.y) > 1
      ) {
        anyCurved = true
        break
      }
    }
    expect(anyCurved).toBe(true)

    // 包围盒已更新
    expect((pen as any).w).toBeGreaterThan(300)
    expect((pen as any).h).toBeGreaterThan(300)
  })

  it('无变化时写回返回 false (恒等变换不触发) ', () => {
    const pen = makePenComponent([{ x: 0, y: 0 }])
    const src = makeCircleSamples(24, 500, 500, 200)
    const out = Float64Array.from(src)
    const bindData = makeBindData(out)

    // 先用折线写回, 使组件点与 outBuffer 一致
    applyPolylineSamplesToComponents([pen], out, bindData)
    // 再次写回相同数据 → 无变化
    const changed = applyPolylineSamplesToComponents([pen], out, bindData)
    expect(changed).toBe(false)
  })
})
