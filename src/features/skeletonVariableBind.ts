/**
 * 骨架绑定 + 可变参数双重映射
 * 当字形同时包含骨架和可变参数时，对每个关键帧图层独立绑定骨架，
 * 拖拽骨架时对所有关键帧应用变换，然后进行差值得到最终轮廓
 */

import type { ICustomGlyph, IGlyphComponent, IPenComponent } from '@/core/types'
import { glyphSkeletonBind as _glyphSkeletonBind } from './glyphSkeletonBind'
import type { CustomGlyph } from '@/core/instance/CustomGlyph'

/**
 * 从ICustomGlyph的指定图层提取钢笔组件锚点
 */
export function getPenPointsFromLayer(
  glyph: ICustomGlyph,
  layerName: string | undefined,
): Array<{ x: number; y: number }> {
  const layers = glyph.layers || {}
  const orderedList = glyph.orderedList || []

  // 获取该图层的组件 UUID
  let layerUUIDs: Set<string>
  if (layerName === undefined) {
    const allLayerUUIDs = new Set<string>()
    for (const uuids of Object.values(layers)) {
      for (const uuid of uuids) allLayerUUIDs.add(uuid)
    }
    layerUUIDs = new Set(
      glyph.components.filter(c => !allLayerUUIDs.has(c.uuid)).map(c => c.uuid),
    )
  } else {
    layerUUIDs = new Set(layers[layerName] || [])
  }

  const allPoints: Array<{ x: number; y: number }> = []
  for (const item of orderedList) {
    if (item.type === 'component' && layerUUIDs.has(item.uuid)) {
      const comp = glyph.components.find(c => c.uuid === item.uuid)
      if (comp && comp.type === 'pen') {
        const penValue = comp.value as IPenComponent
        if (penValue?.points && Array.isArray(penValue.points)) {
          for (const p of penValue.points) {
            allPoints.push({ x: p.x, y: p.y })
          }
        }
      }
    }
  }

  return allPoints
}

/**
 * 为字形中所有关键帧图层绑定骨架
 * 在绑定骨架时调用，如果字形包含可变参数，则为每个关键帧图层存储原始锚点
 *
 * @param glyph - 字形数据（ICustomGlyph）
 */
export function bindSkeletonForVariables(glyph: ICustomGlyph): void {
  const variables = glyph.variables
  if (!variables || variables.length === 0) return
  if (!glyph.skeleton?.skeletonBindData) return

  // 确保 variableKeyframeBinds 存在
  if (!glyph.skeleton.variableKeyframeBinds) {
    glyph.skeleton.variableKeyframeBinds = {}
  }

  // 为每个 keyframe 存储该图层的原始锚点
  // 骨架绑定数据（骨骼映射）在所有图层间共享
  for (const variable of variables) {
    for (const kf of variable.keyframes) {
      if (!glyph.skeleton.variableKeyframeBinds[kf.uuid]) {
        const points = getPenPointsFromLayer(glyph, kf.layer)
        if (points.length > 0) {
          glyph.skeleton.variableKeyframeBinds[kf.uuid] = {
            originalPoints: points,
          }
        }
      }
    }
  }
}

/**
 * 计算可变参数差值后的锚点（结合骨架变换）
 *
 * 流程：
 * 1. 对默认图层应用骨架变换得到当前骨架下的默认锚点
 * 2. 对每个关键帧图层应用骨架变换得到当前骨架下的关键帧锚点
 * 3. 根据可变参数当前值进行差值
 *
 * @param glyph - CustomGlyph 实例
 * @param newSkeleton - 当前骨架状态
 * @returns 差值后的锚点映射 (componentUUID -> points)
 */
export function calculateSkeletonVariablePoints(
  glyph: CustomGlyph,
  newSkeleton: any,
): Map<string, Array<{ x: number; y: number }>> {
  const result = new Map<string, Array<{ x: number; y: number }>>()
  const rawGlyph = (glyph as any)._glyph as ICustomGlyph
  const variables = rawGlyph.variables
  const skeletonData = rawGlyph.skeleton

  if (!variables || variables.length === 0 || !skeletonData) {
    return result
  }

  // 获取默认图层组件
  const defaultLayerComps = getPenComponentsInLayerForGlyph(rawGlyph, undefined)
  if (defaultLayerComps.length === 0) return result

  // 验证所有图层锚点数量一致
  for (const variable of variables) {
    for (const kf of variable.keyframes) {
      const kfComps = getPenComponentsInLayerForGlyph(rawGlyph, kf.layer)
      if (kfComps.length !== defaultLayerComps.length) {
        console.warn(`Layer "${kf.layer}" has ${kfComps.length} pen components, default has ${defaultLayerComps.length}`)
        return result
      }
    }
  }

  // 获取默认图层在当前骨架下的锚点（通过骨架绑定数据）
  const skeletonBindData = skeletonData.skeletonBindData
  if (!skeletonBindData) return result

  // 直接使用原始锚点作为"默认"基准（骨架变换之前的值）
  // 注意：骨架拖拽会实时修改组件锚点，所以这里获取的是已变换的锚点
  const defaultPoints: Array<{ x: number; y: number; compIndex: number }> = []
  for (let ci = 0; ci < defaultLayerComps.length; ci++) {
    const pts = (defaultLayerComps[ci].value as IPenComponent).points
    for (const p of pts) {
      defaultPoints.push({ x: p.x, y: p.y, compIndex: ci })
    }
  }

  // 为每个组件累积 delta
  const totalDelta: Array<Array<{ x: number; y: number }>> = []
  const compPointCounts: number[] = []
  for (let ci = 0; ci < defaultLayerComps.length; ci++) {
    const pts = (defaultLayerComps[ci].value as IPenComponent).points
    compPointCounts.push(pts.length)
    totalDelta.push(Array(pts.length).fill(null).map(() => ({ x: 0, y: 0 })))
  }

  // 获取关键帧图层锚点（已通过骨架变换）
  const cached = new Map<string, Array<{ x: number; y: number }>>()

  for (const variable of variables) {
    const { min, max, default: def, value: current, keyframes } = variable
    if (keyframes.length < 2) continue

    const minKf = keyframes.find(k => k.value === min)
    const maxKf = keyframes.find(k => k.value === max)
    if (!minKf || !maxKf) continue

    let t = 0
    let deltaLayer: string | null = null

    if (current === def) continue
    else if (current < def) {
      if (def === min) continue
      t = (def - current) / (def - min)
      deltaLayer = minKf.layer
    } else {
      if (max === def) continue
      t = (current - def) / (max - def)
      deltaLayer = maxKf.layer
    }

    if (!deltaLayer) continue
    t = Math.max(0, Math.min(1, t))

    // 获取关键帧图层在当前骨架下的锚点
    let deltaPoints: Array<{ x: number; y: number }>
    if (cached.has(deltaLayer)) {
      deltaPoints = cached.get(deltaLayer)!
    } else {
      const kfComps = getPenComponentsInLayerForGlyph(rawGlyph, deltaLayer)
      deltaPoints = []
      for (let ci = 0; ci < kfComps.length; ci++) {
        const pts = (kfComps[ci].value as IPenComponent).points
        for (const p of pts) {
          deltaPoints.push({ x: p.x, y: p.y })
        }
      }
      cached.set(deltaLayer, deltaPoints)
    }

    // 累加 delta
    let globalIdx = 0
    for (let ci = 0; ci < compPointCounts.length; ci++) {
      for (let pi = 0; pi < compPointCounts[ci]; pi++) {
        if (globalIdx < defaultPoints.length && globalIdx < deltaPoints.length) {
          const dp = defaultPoints[globalIdx]
          const sp = deltaPoints[globalIdx]
          totalDelta[ci][pi].x += t * (sp.x - dp.x)
          totalDelta[ci][pi].y += t * (sp.y - dp.y)
        }
        globalIdx++
      }
    }
  }

  // 应用累积 delta
  for (let ci = 0; ci < defaultLayerComps.length; ci++) {
    const comp = defaultLayerComps[ci]
    const pts = (comp.value as IPenComponent).points
    const interpolated: Array<{ x: number; y: number }> = []
    for (let pi = 0; pi < pts.length; pi++) {
      interpolated.push({
        x: pts[pi].x + totalDelta[ci][pi].x,
        y: pts[pi].y + totalDelta[ci][pi].y,
      })
    }
    result.set(comp.uuid, interpolated)
  }

  return result
}

function getPenComponentsInLayerForGlyph(
  glyph: ICustomGlyph,
  layerName: string | undefined,
): IGlyphComponent[] {
  const layers = glyph.layers || {}
  const orderedList = glyph.orderedList || []

  let layerUUIDs: Set<string>
  if (layerName === undefined) {
    const allLayerUUIDs = new Set<string>()
    for (const uuids of Object.values(layers)) {
      for (const uuid of uuids) allLayerUUIDs.add(uuid)
    }
    layerUUIDs = new Set(
      glyph.components.filter(c => !allLayerUUIDs.has(c.uuid)).map(c => c.uuid),
    )
  } else {
    layerUUIDs = new Set(layers[layerName] || [])
  }

  const result: IGlyphComponent[] = []
  for (const item of orderedList) {
    if (item.type === 'component' && layerUUIDs.has(item.uuid)) {
      const comp = glyph.components.find(c => c.uuid === item.uuid)
      if (comp && comp.type === 'pen') {
        result.push(comp)
      }
    }
  }
  return result
}
