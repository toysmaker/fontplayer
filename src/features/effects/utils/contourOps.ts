/**
 * 轮廓操作工具函数
 * 为效果滤镜提供通用的轮廓 ↔ 折线 ↔ 组件转换能力
 */

import paper from 'paper'
import { type IContour, type IContours, PathType } from '@/core/font/types'
import type { IComponent, IPenComponent } from '@/core/types'
import { ContourConverter } from '@/core/font/converter'
import { genPenContour } from '@/core/utils/contour'
import { genUUID } from '@/utils/uuid'

// ---------- 折线简化（Ramer–Douglas–Peucker）----------

interface IPoint2D {
  x: number
  y: number
}

function perpendicularDistance(point: IPoint2D, start: IPoint2D, end: IPoint2D): number {
  const area = Math.abs(
    (start.x * (end.y - point.y) + end.x * (point.y - start.y) + point.x * (start.y - end.y)) / 2
  )
  const base = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
  return base > 0 ? (2 * area) / base : 0
}

/**
 * Ramer–Douglas–Peucker 折线简化算法
 */
export function simplifyPolyline(points: IPoint2D[], epsilon: number): IPoint2D[] {
  if (points.length <= 2) return [...points]

  let maxDist = 0
  let index = 0
  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end)
    if (dist > maxDist) {
      maxDist = dist
      index = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolyline(points.slice(0, index + 1), epsilon)
    const right = simplifyPolyline(points.slice(index), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [start, end]
}

// ---------- Contour ↔ Polyline 转换 ----------

/**
 * 将 IContour 采样为折线点数组
 * 使用 Paper.js flatten 来获取高密度采样点
 */
export function contourToPolyline(contour: IContour, flatTolerance: number = 1.0): IPoint2D[] {
  if (!contour || contour.length === 0) return []

  try {
    const path = new paper.Path()
    if (contour.length === 0) return []

    const seg0 = contour[0]
    path.moveTo(new paper.Point(seg0.start.x, seg0.start.y))

    for (const segment of contour) {
      if (segment.type === PathType.LINE) {
        path.lineTo(new paper.Point(segment.end.x, segment.end.y))
      } else if (segment.type === PathType.CUBIC_BEZIER) {
        path.cubicCurveTo(
          new paper.Point(segment.control1.x, segment.control1.y),
          new paper.Point(segment.control2.x, segment.control2.y),
          new paper.Point(segment.end.x, segment.end.y),
        )
      } else if (segment.type === PathType.QUADRATIC_BEZIER) {
        // 二次贝塞尔转三次
        const startPt = path.lastSegment?.point || new paper.Point(segment.start.x, segment.start.y)
        const control = new paper.Point(segment.control.x, segment.control.y)
        const endPt = new paper.Point(segment.end.x, segment.end.y)
        const c1 = startPt.multiply(1 / 3).add(control.multiply(2 / 3))
        const c2 = endPt.multiply(1 / 3).add(control.multiply(2 / 3))
        path.cubicCurveTo(c1, c2, endPt)
      }
    }

    path.closePath()
    path.flatten(flatTolerance)

    const points: IPoint2D[] = []
    for (const seg of path.segments) {
      points.push({ x: seg.point.x, y: seg.point.y })
    }

    path.remove()
    return points
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[contourOps] contourToPolyline failed:', e)
    }
    return []
  }
}

/**
 * 将多个 IContour 采样为折线数组（每个轮廓独立）
 */
export function contoursToPolylines(contours: IContours, flatTolerance: number = 1.0): IPoint2D[][] {
  return contours
    .map((c) => contourToPolyline(c, flatTolerance))
    .filter((pts) => pts.length >= 3)
}

/**
 * 将折线点通过 Paper.js simplify 拟合为贝塞尔曲线，再转为 pen 组件
 */
export function polylineToPenComponent(
  points: IPoint2D[],
  name: string = 'effect',
): IComponent | null {
  if (points.length < 3) return null

  try {
    const path = new paper.Path()
    path.moveTo(new paper.Point(points[0].x, points[0].y))
    for (let i = 1; i < points.length; i++) {
      path.lineTo(new paper.Point(points[i].x, points[i].y))
    }
    path.closePath()

    // simplify 将折线转为贝塞尔曲线
    if (path.segments.length > 2) {
      path.simplify(2)
    }

    const comp = paperPathToPenComponent(path, name)
    path.remove()
    return comp
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[contourOps] polylineToPenComponent failed:', e)
    }
    return null
  }
}

// ---------- Paper.js Path ↔ Pen Component ----------

/**
 * 将 Paper.js Path 转为编辑空间下的 pen 组件
 * 复用 RemoveOverlapService 的模式
 */
function paperPathToPenComponent(path: paper.Path, name: string = 'pen'): IComponent | null {
  if (!path.curves || path.curves.length === 0) return null

  const compPoints: Array<{
    uuid: string
    type: string
    x: number
    y: number
    origin: string | null
    isShow: boolean
  }> = []

  // 起始锚点
  const startX = path.curves[0].point1.x
  const startY = path.curves[0].point1.y
  compPoints.push({
    uuid: genUUID(),
    type: 'anchor',
    x: startX,
    y: startY,
    origin: null,
    isShow: true,
  })

  for (const curve of path.curves) {
    const curvePoints = [
      curve.point1,
      curve.point1.add(curve.handle1),
      curve.point2.add(curve.handle2),
      curve.point2,
    ]
    if (curvePoints.length >= 4) {
      const anchorPrevUuid = compPoints[compPoints.length - 1].uuid
      const control1 = {
        uuid: genUUID(),
        type: 'control',
        x: curvePoints[1].x,
        y: curvePoints[1].y,
        origin: anchorPrevUuid,
        isShow: true,
      }
      const endUuid = genUUID()
      const control2 = {
        uuid: genUUID(),
        type: 'control',
        x: curvePoints[2].x,
        y: curvePoints[2].y,
        origin: endUuid,
        isShow: true,
      }
      const end = {
        uuid: endUuid,
        type: 'anchor',
        x: curvePoints[3].x,
        y: curvePoints[3].y,
        origin: null,
        isShow: true,
      }
      compPoints.push(control1, control2, end)
    }
  }

  // 闭合路径：调整最后一点与第一点对齐
  if (path.closed && compPoints.length > 0) {
    const first = compPoints[0]
    const last = compPoints[compPoints.length - 1]
    if (last.x !== first.x || last.y !== first.y) {
      last.x = first.x
      last.y = first.y
    }
  }

  if (compPoints.length < 4) return null

  // 计算包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of compPoints) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const flatPoints = compPoints.map((p) => ({ x: p.x, y: p.y }))
  const contour = flatPoints.length >= 4 ? genPenContour(flatPoints, false) : []
  const preview = flatPoints.length >= 4 ? genPenContour(flatPoints, 'none') : []

  return {
    uuid: genUUID(),
    type: 'pen',
    name,
    lock: false,
    visible: true,
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    value: {
      points: compPoints,
      strokeColor: '#000',
      fillColor: '',
      closePath: path.closed,
      editMode: false,
      contour: contour as any,
      preview: preview as any,
    } as IPenComponent,
  }
}

/**
 * 将多个 IContour 通过 Paper.js 合并后转回 pen 组件列表
 * 用于效果的最终输出步骤
 */
export function contoursToPenComponents(contours: IContours, namePrefix: string = 'effect'): IComponent[] {
  if (contours.length === 0) return []

  try {
    const paths: paper.Path[] = []
    for (const c of contours) {
      if (!c.length) continue
      const path = new paper.Path()
      const seg0 = c[0]
      path.moveTo(new paper.Point(seg0.start.x, seg0.start.y))
      for (const segment of c) {
        if (segment.type === PathType.LINE) {
          path.lineTo(new paper.Point(segment.end.x, segment.end.y))
        } else if (segment.type === PathType.CUBIC_BEZIER) {
          path.cubicCurveTo(
            new paper.Point(segment.control1.x, segment.control1.y),
            new paper.Point(segment.control2.x, segment.control2.y),
            new paper.Point(segment.end.x, segment.end.y),
          )
        } else if (segment.type === PathType.QUADRATIC_BEZIER) {
          const startPt = path.lastSegment?.point || new paper.Point(segment.start.x, segment.start.y)
          const control = new paper.Point(segment.control.x, segment.control.y)
          const endPt = new paper.Point(segment.end.x, segment.end.y)
          const c1 = startPt.multiply(1 / 3).add(control.multiply(2 / 3))
          const c2 = endPt.multiply(1 / 3).add(control.multiply(2 / 3))
          path.cubicCurveTo(c1, c2, endPt)
        }
      }
      path.closePath()
      paths.push(path)
    }

    // 布尔合并所有轮廓
    let merged: paper.PathItem = paths[0]
    for (let i = 1; i < paths.length; i++) {
      merged = merged.unite(paths[i]) as paper.PathItem
      paths[i].remove()
    }

    const result: IComponent[] = []
    const extractFromItem = (item: paper.PathItem): void => {
      const children = (item as any).children
      if (children && children.length > 0) {
        for (const child of children) {
          if (child instanceof paper.Path && child.curves.length > 0) {
            const comp = paperPathToPenComponent(child, `${namePrefix}_${result.length}`)
            if (comp) result.push(comp)
          }
        }
      } else if (item instanceof paper.Path && item.curves.length > 0) {
        const comp = paperPathToPenComponent(item, `${namePrefix}_0`)
        if (comp) result.push(comp)
      }
    }
    extractFromItem(merged)
    merged.remove()

    return result
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[contourOps] contoursToPenComponents failed:', e)
    }
    return []
  }
}

/**
 * 将 pen 组件列表转换为编辑空间下的 IContours
 */
export function penComponentsToContours(components: IComponent[]): IContours {
  return ContourConverter.componentsToContoursEditing(components, { x: 0, y: 0 })
}

/**
 * 计算点数组的包围盒
 */
export function getBounds(points: IPoint2D[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/**
 * 计算轮廓法线方向（Y-down 坐标系中，逆时针路径的外法线为 (dy, -dx)）
 * 对折线的每个顶点计算入边和出边的平均法线
 */
export function computeNormals(points: IPoint2D[]): Array<{ nx: number; ny: number }> {
  const n = points.length
  if (n < 3) return points.map(() => ({ nx: 0, ny: 1 }))

  const normals: Array<{ nx: number; ny: number }> = []
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]

    // 入边法线
    const dxIn = curr.x - prev.x
    const dyIn = curr.y - prev.y
    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn)
    const nxIn = lenIn > 0.001 ? dyIn / lenIn : 0
    const nyIn = lenIn > 0.001 ? -dxIn / lenIn : 0

    // 出边法线
    const dxOut = next.x - curr.x
    const dyOut = next.y - curr.y
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut)
    const nxOut = lenOut > 0.001 ? dyOut / lenOut : 0
    const nyOut = lenOut > 0.001 ? -dxOut / lenOut : 0

    // 平均
    let nx = nxIn + nxOut
    let ny = nyIn + nyOut
    const avgLen = Math.sqrt(nx * nx + ny * ny)
    if (avgLen > 0.001) {
      nx /= avgLen
      ny /= avgLen
    }

    normals.push({ nx, ny })
  }
  return normals
}
