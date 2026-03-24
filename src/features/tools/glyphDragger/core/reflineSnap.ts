/**
 * 从 glyph-pen 直线段提取水平/垂直参考线，并在拖拽时与其它组件对齐吸附。
 * 逻辑对齐原工程 fontplayer/src/utils/glyph.ts
 */

export type SnapAxisLine = { type: 'horizontal' | 'vertical'; coord: number }

const EPSILON = 1e-6

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
) {
  const isControl1AtStart =
    Math.abs(control1X - startX) < EPSILON && Math.abs(control1Y - startY) < EPSILON
  const isControl2AtEnd =
    Math.abs(control2X - endX) < EPSILON && Math.abs(control2Y - endY) < EPSILON

  if (!isControl1AtStart || !isControl2AtEnd) return

  if (Math.abs(startY - endY) < EPSILON) {
    reflines.push({ type: 'horizontal', coord: startY })
  }
  if (Math.abs(startX - endX) < EPSILON) {
    reflines.push({ type: 'vertical', coord: startX })
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

/**
 * keylines: 其它组件提供的参考线；reflines: 当前组件在试探位置下的线。
 * 返回将 reflines 对齐到 keylines 所需的 delta（加到位移上）。
 */
export function getSnapRefline(
  keylines: SnapAxisLine[],
  reflines: SnapAxisLine[],
  snapDistance: number = 20,
): { dx: number; dy: number } | null {
  let bestSnap: { dx: number; dy: number; distance: number } | null = null

  for (const keyline of keylines) {
    for (const refline of reflines) {
      if (keyline.type !== refline.type) continue
      const distance = Math.abs(keyline.coord - refline.coord)
      if (distance >= snapDistance) continue

      let dx = 0
      let dy = 0
      if (keyline.type === 'horizontal') {
        dy = keyline.coord - refline.coord
      } else {
        dx = keyline.coord - refline.coord
      }

      if (!bestSnap || distance < bestSnap.distance) {
        bestSnap = { dx, dy, distance }
      }
    }
  }

  return bestSnap ? { dx: bestSnap.dx, dy: bestSnap.dy } : null
}
