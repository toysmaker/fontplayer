/**
 * 从 glyph-pen 直线段提取水平/垂直参考线，并在拖拽时与其它组件对齐吸附。
 * 逻辑对齐原工程 fontplayer/src/utils/glyph.ts
 */

export type SnapAxisLine = { type: 'horizontal' | 'vertical'; coord: number }

const EPSILON = 1e-6
/** 骨架形变后的点可能有微小的轴偏差；对 _glyph.components（type='pen'）使用宽松容差 */
const SKELETON_AXIS_EPSILON = 0.5

function pushSegmentAxisLines(
  reflines: SnapAxisLine[],
  startX: number,
  startY: number,
  control1X: number,
  control1Y: number,
  control2X: number,
  control2Y: number,
  endX: number,
  endY: number,
  eps: number = EPSILON,
) {
  const isControl1AtStart =
    Math.abs(control1X - startX) < eps && Math.abs(control1Y - startY) < eps
  const isControl2AtEnd =
    Math.abs(control2X - endX) < eps && Math.abs(control2Y - endY) < eps

  if (!isControl1AtStart || !isControl2AtEnd) return

  if (Math.abs(startY - endY) < eps) {
    reflines.push({ type: 'horizontal', coord: (startY + endY) / 2 })
  }
  if (Math.abs(startX - endX) < eps) {
    reflines.push({ type: 'vertical', coord: (startX + endX) / 2 })
  }
}

/**
 * 遍历实例上的 glyph-pen 组件，提取轴对齐直线段对应的 horizontal / vertical 线（已加 offset）
 */
export function collectStraightAxisLinesFromPenComponents(
  components: any[] | undefined,
  offsetX: number,
  offsetY: number,
): SnapAxisLine[] {
  const reflines: SnapAxisLine[] = []
  if (!components?.length) return dedupeSnapAxisLines(reflines)

  for (const component of components) {
    if (component?.type !== 'glyph-pen') continue
    const points = component.points as Array<{ x: number; y: number }> | undefined
    if (!points || points.length < 4) continue

    for (let i = 1; i < points.length; i += 3) {
      if (i + 2 >= points.length) break

      const control1 = points[i]
      const control2 = points[i + 1]
      const endPoint = points[i + 2]
      const startPoint = points[i - 1]

      const startX = startPoint.x + offsetX
      const startY = startPoint.y + offsetY
      const control1X = control1.x + offsetX
      const control1Y = control1.y + offsetY
      const control2X = control2.x + offsetX
      const control2Y = control2.y + offsetY
      const endX = endPoint.x + offsetX
      const endY = endPoint.y + offsetY

      pushSegmentAxisLines(
        reflines,
        startX,
        startY,
        control1X,
        control1Y,
        control2X,
        control2Y,
        endX,
        endY,
      )
    }
  }

  return dedupeSnapAxisLines(reflines)
}

/**
 * 从骨架字形的 _glyph.components（type='pen'）中提取轴对齐直线段参考线。
 *
 * 骨架字形在 executeGlyphScript 中走 strokeFn 分支后 early-return，_components 永远为空。
 * 实际渲染几何存储在 _glyph.components[n].value.points，由 applySkeletonTransformation 原地更新。
 * 由于骨架形变引入微小浮点偏差，使用宽松容差 SKELETON_AXIS_EPSILON 检测轴对齐。
 */
export function collectStraightAxisLinesFromGlyphComponents(
  glyphComponents: any[] | undefined,
  offsetX: number,
  offsetY: number,
): SnapAxisLine[] {
  const reflines: SnapAxisLine[] = []
  if (!glyphComponents?.length) return dedupeSnapAxisLines(reflines)

  for (const comp of glyphComponents) {
    if (comp?.type !== 'pen') continue
    if (comp?.usedInCharacter === false) continue
    const points = (comp.value as any)?.points as Array<{ x: number; y: number }> | undefined
    if (!points || points.length < 4) continue

    for (let i = 1; i < points.length; i += 3) {
      if (i + 2 >= points.length) break

      const startPoint = points[i - 1]
      const control1 = points[i]
      const control2 = points[i + 1]
      const endPoint = points[i + 2]

      const startX = startPoint.x + offsetX
      const startY = startPoint.y + offsetY
      const control1X = control1.x + offsetX
      const control1Y = control1.y + offsetY
      const control2X = control2.x + offsetX
      const control2Y = control2.y + offsetY
      const endX = endPoint.x + offsetX
      const endY = endPoint.y + offsetY

      pushSegmentAxisLines(
        reflines,
        startX, startY,
        control1X, control1Y,
        control2X, control2Y,
        endX, endY,
        SKELETON_AXIS_EPSILON,
      )
    }
  }

  return dedupeSnapAxisLines(reflines)
}

export function dedupeSnapAxisLines(lines: SnapAxisLine[]): SnapAxisLine[] {
  const seen = new Set<string>()
  const out: SnapAxisLine[] = []
  for (const line of lines) {
    const key = `${line.type}-${line.coord}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

export function mergeSnapAxisLines(groups: SnapAxisLine[][]): SnapAxisLine[] {
  return dedupeSnapAxisLines(groups.flat())
}

/** 进入吸附候选：先比 joint 到 ref 的垂直距离，再比 key–ref 间距（与旧版仅 kr 一致当未传 joint 时） */
function isBetterEntryCandidate(
  jointDist: number,
  kr: number,
  best: { jointDist: number; kr: number },
  useJoint: boolean,
): boolean {
  if (useJoint) {
    if (jointDist < best.jointDist - EPSILON) return true
    if (jointDist > best.jointDist + EPSILON) return false
  }
  return kr < best.kr - EPSILON
}

/** 仅在 kr < snapIn 的候选中选取；若给定 jointY，则优先 |jointY - ref.coord| 更小者 */
function findBestEntrySnapH(
  keylines: SnapAxisLine[],
  reflines: SnapAxisLine[],
  snapIn: number,
  jointY: number | undefined,
): { keyCoord: number; delta: number } | null {
  let best: {
    keyCoord: number
    delta: number
    kr: number
    jointDist: number
  } | null = null
  const useJoint = jointY !== undefined
  for (const keyline of keylines) {
    if (keyline.type !== 'horizontal') continue
    for (const refline of reflines) {
      if (refline.type !== keyline.type) continue
      const kr = Math.abs(keyline.coord - refline.coord)
      if (kr >= snapIn) continue
      const delta = keyline.coord - refline.coord
      const jointDist = useJoint ? Math.abs(jointY! - refline.coord) : kr
      if (!best) {
        best = { keyCoord: keyline.coord, delta, kr, jointDist }
        continue
      }
      if (isBetterEntryCandidate(jointDist, kr, best, useJoint)) {
        best = { keyCoord: keyline.coord, delta, kr, jointDist }
      }
    }
  }
  return best ? { keyCoord: best.keyCoord, delta: best.delta } : null
}

/** 若给定 jointX，则优先 |jointX - ref.coord| 更小者 */
function findBestEntrySnapV(
  keylines: SnapAxisLine[],
  reflines: SnapAxisLine[],
  snapIn: number,
  jointX: number | undefined,
): { keyCoord: number; delta: number } | null {
  let best: {
    keyCoord: number
    delta: number
    kr: number
    jointDist: number
  } | null = null
  const useJoint = jointX !== undefined
  for (const keyline of keylines) {
    if (keyline.type !== 'vertical') continue
    for (const refline of reflines) {
      if (refline.type !== keyline.type) continue
      const kr = Math.abs(keyline.coord - refline.coord)
      if (kr >= snapIn) continue
      const delta = keyline.coord - refline.coord
      const jointDist = useJoint ? Math.abs(jointX! - refline.coord) : kr
      if (!best) {
        best = { keyCoord: keyline.coord, delta, kr, jointDist }
        continue
      }
      if (isBetterEntryCandidate(jointDist, kr, best, useJoint)) {
        best = { keyCoord: keyline.coord, delta, kr, jointDist }
      }
    }
  }
  return best ? { keyCoord: best.keyCoord, delta: best.delta } : null
}

function isBetterLockedCandidate(
  jointDist: number,
  kr: number,
  best: { jointDist: number; kr: number },
  useJoint: boolean,
): boolean {
  return isBetterEntryCandidate(jointDist, kr, best, useJoint)
}

/** 已锁定某条水平 key 线时：取与 keyCoord 匹配的 ref；若给定 jointY 则优先离关节更近的 ref */
function horizontalDeltaForLockedKey(
  keyCoord: number,
  reflines: SnapAxisLine[],
  jointY: number | undefined,
): { dist: number; delta: number } | null {
  let best: { dist: number; delta: number; kr: number; jointDist: number } | null = null
  const useJoint = jointY !== undefined
  for (const ref of reflines) {
    if (ref.type !== 'horizontal') continue
    const kr = Math.abs(keyCoord - ref.coord)
    const delta = keyCoord - ref.coord
    const jointDist = useJoint ? Math.abs(jointY! - ref.coord) : kr
    if (!best) {
      best = { dist: kr, delta, kr, jointDist }
      continue
    }
    if (isBetterLockedCandidate(jointDist, kr, best, useJoint)) {
      best = { dist: kr, delta, kr, jointDist }
    }
  }
  return best ? { dist: best.dist, delta: best.delta } : null
}

/** 若给定 jointX 则优先离关节更近的竖直 ref */
function verticalDeltaForLockedKey(
  keyCoord: number,
  reflines: SnapAxisLine[],
  jointX: number | undefined,
): { dist: number; delta: number } | null {
  let best: { dist: number; delta: number; kr: number; jointDist: number } | null = null
  const useJoint = jointX !== undefined
  for (const ref of reflines) {
    if (ref.type !== 'vertical') continue
    const kr = Math.abs(keyCoord - ref.coord)
    const delta = keyCoord - ref.coord
    const jointDist = useJoint ? Math.abs(jointX! - ref.coord) : kr
    if (!best) {
      best = { dist: kr, delta, kr, jointDist }
      continue
    }
    if (isBetterLockedCandidate(jointDist, kr, best, useJoint)) {
      best = { dist: kr, delta, kr, jointDist }
    }
  }
  return best ? { dist: best.dist, delta: best.delta } : null
}

/**
 * 拖拽用吸附：锁定「进入吸附时」的那条 key 线坐标，直到与该线的最近 ref 距离 > snapOut 才释放。
 * 避免多条参考线并存时每帧重选「全局最近 key」导致 dx/dy 突变、吸附线附近颤动。
 */
/**
 * @param jointWorld 拖拽关键点时的关节世界坐标（局部 + ox/oy）。传入时进入吸附与锁定续吸均优先选离关节最近的 refline；整体平移不传。
 */
export function evaluateSnapReflineSticky(
  keylines: SnapAxisLine[],
  reflines: SnapAxisLine[],
  snapIn: number,
  snapOut: number,
  lockHKey: number | null,
  lockVKey: number | null,
  jointWorld?: { x: number; y: number } | null,
): {
  dx: number
  dy: number
  lockHNext: number | null
  lockVNext: number | null
} {
  const jx = jointWorld?.x
  const jy = jointWorld?.y

  let dy = 0
  let lockHNext: number | null = null
  if (lockHKey !== null) {
    const p = horizontalDeltaForLockedKey(lockHKey, reflines, jy)
    if (p && p.dist <= snapOut) {
      lockHNext = lockHKey
      dy = p.delta
    }
  }
  if (lockHNext === null) {
    const nb = findBestEntrySnapH(keylines, reflines, snapIn, jy)
    if (nb) {
      lockHNext = nb.keyCoord
      dy = nb.delta
    }
  }

  let dx = 0
  let lockVNext: number | null = null
  if (lockVKey !== null) {
    const p = verticalDeltaForLockedKey(lockVKey, reflines, jx)
    if (p && p.dist <= snapOut) {
      lockVNext = lockVKey
      dx = p.delta
    }
  }
  if (lockVNext === null) {
    const nb = findBestEntrySnapV(keylines, reflines, snapIn, jx)
    if (nb) {
      lockVNext = nb.keyCoord
      dx = nb.delta
    }
  }

  return { dx, dy, lockHNext, lockVNext }
}

/**
 * keylines: 其它组件提供的参考线；reflines: 当前组件在试探位置下的线。
 * 返回将 reflines 对齐到 keylines 所需的 delta（加到位移上）。
 */
export function getSnapRefline(
  keylines: SnapAxisLine[],
  reflines: SnapAxisLine[],
  snapDistance: number = 20,
): { dx: number; dy: number } | null {
  const h = findBestEntrySnapH(keylines, reflines, snapDistance, undefined)
  const v = findBestEntrySnapV(keylines, reflines, snapDistance, undefined)
  if (!h && !v) return null
  return {
    dx: v?.delta ?? 0,
    dy: h?.delta ?? 0,
  }
}
