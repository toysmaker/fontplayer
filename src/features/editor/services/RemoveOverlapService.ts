/**
 * 去除重叠服务（Paper.js 实现）
 * 将多个轮廓合并为单一路径，支持镂空；可输出为编辑用 pen 组件或字体用轮廓，供菜单与导出复用。
 */

import paper from 'paper'
import type { IContour } from '@/core/font/types'
import { PathType } from '@/core/font/types'
import type { ILine, IQuadraticBezierCurve, ICubicBezierCurve } from '@/core/font/types'
import type { IComponent } from '@/core/types'
import type { IPenComponent } from '@/core/types'
import { genPenContour } from '@/core/utils/contour'
import { genUUID } from '@/utils/uuid'

const OVERLAP_REMOVAL_CONFIG = {
  PATH_PRECISION: 1e-6,
  TOLERANCE: 1e-8,
  MERGE_TOLERANCE: 1e-6,
}

function createOptimizedPath(
  contour: IContour
): paper.Path {
  const path = new paper.Path()
  if (contour.length === 0) return path

  const seg0 = contour[0]
  const startPoint = new paper.Point(seg0.start.x, seg0.start.y)
  path.moveTo(startPoint)

  let lastX = seg0.start.x
  let lastY = seg0.start.y

  for (let j = 0; j < contour.length; j++) {
    const segment = contour[j] as ILine | IQuadraticBezierCurve | ICubicBezierCurve

    if (segment.type === PathType.LINE) {
      const lineSegment = segment as ILine
      const endPoint = new paper.Point(lineSegment.end.x, lineSegment.end.y)
      path.lineTo(endPoint)
      lastX = lineSegment.end.x
      lastY = lineSegment.end.y
    } else if (segment.type === PathType.CUBIC_BEZIER) {
      const cubicSegment = segment as ICubicBezierCurve
      const control1 = new paper.Point(cubicSegment.control1.x, cubicSegment.control1.y)
      const control2 = new paper.Point(cubicSegment.control2.x, cubicSegment.control2.y)
      const endPoint = new paper.Point(cubicSegment.end.x, cubicSegment.end.y)
      path.cubicCurveTo(control1, control2, endPoint)
      lastX = cubicSegment.end.x
      lastY = cubicSegment.end.y
    } else if (segment.type === PathType.QUADRATIC_BEZIER) {
      const quadSegment = segment as IQuadraticBezierCurve
      const control = new paper.Point(quadSegment.control.x, quadSegment.control.y)
      const endPoint = new paper.Point(quadSegment.end.x, quadSegment.end.y)
      const startPt = new paper.Point(lastX, lastY)
      const cubicControl1 = startPt.multiply(1 / 3).add(control.multiply(2 / 3))
      const cubicControl2 = endPoint.multiply(1 / 3).add(control.multiply(2 / 3))
      path.cubicCurveTo(cubicControl1, cubicControl2, endPoint)
      lastX = quadSegment.end.x
      lastY = quadSegment.end.y
    }
  }

  path.closePath()
  return path
}

export function isAlreadyOptimized(contours: IContour[]): boolean {
  if (contours.length <= 1) return true

  let hasOverlap = false
  for (let i = 0; i < contours.length; i++) {
    for (let j = i + 1; j < contours.length; j++) {
      const c1 = contours[i]
      const c2 = contours[j]
      let minX1 = Infinity, minY1 = Infinity, maxX1 = -Infinity, maxY1 = -Infinity
      let minX2 = Infinity, minY2 = Infinity, maxX2 = -Infinity, maxY2 = -Infinity

      for (const seg of c1) {
        minX1 = Math.min(minX1, seg.start.x, seg.end.x)
        minY1 = Math.min(minY1, seg.start.y, seg.end.y)
        maxX1 = Math.max(maxX1, seg.start.x, seg.end.x)
        maxY1 = Math.max(maxY1, seg.start.y, seg.end.y)
      }
      for (const seg of c2) {
        minX2 = Math.min(minX2, seg.start.x, seg.end.x)
        minY2 = Math.min(minY2, seg.start.y, seg.end.y)
        maxX2 = Math.max(maxX2, seg.start.x, seg.end.x)
        maxY2 = Math.max(maxY2, seg.start.y, seg.end.y)
      }
      if (maxX1 >= minX2 && maxX2 >= minX1 && maxY1 >= minY2 && maxY2 >= minY1) {
        hasOverlap = true
        break
      }
    }
    if (hasOverlap) break
  }
  return !hasOverlap
}

function mergePathsWithPrecision(paths: paper.Path[]): paper.Path | null {
  if (paths.length === 0) return null
  if (paths.length === 1) return paths[0]

  paper.settings.precision = OVERLAP_REMOVAL_CONFIG.PATH_PRECISION
  let unitedPath = paths[0].clone()
  for (let i = 1; i < paths.length; i++) {
    unitedPath = unitedPath.unite(paths[i]) as paper.Path
  }
  return unitedPath
}

/**
 * 从轮廓列表合并为单一 paper.Path（支持镂空：先 unite 外轮廓再 exclude 内轮廓）。
 * 返回 { path, pathsToRemove }，调用方在用完 path 后需对 pathsToRemove 及 path 调用 .remove() 清理。
 * 若已优化则返回 null；无有效结果也返回 null。
 */
export function removeOverlapFromContours(
  contours: IContour[]
): { path: paper.Path; pathsToRemove: paper.Path[] } | null {
  if (contours.length === 0) return null
  if (isAlreadyOptimized(contours)) return null

  const paths: paper.Path[] = []
  for (let i = 0; i < contours.length; i++) {
    const contour = contours[i]
    if (contour.length === 0) continue
    const path = createOptimizedPath(contour)
    if (!path.closed) path.closePath()
    paths.push(path)
  }

  if (paths.length === 0) return null

  let hasHoles = false
  let hasOuterContours = false
  for (const path of paths) {
    if (!path.area) continue
    const area = path.area
    if (Math.abs(area) > 1e-6) {
      if (area > 0) hasOuterContours = true
      else hasHoles = true
    }
  }

  let unitedPath: paper.Path | null = null

  if (hasHoles && hasOuterContours) {
    const outerPaths: paper.Path[] = []
    const innerPaths: paper.Path[] = []
    for (const path of paths) {
      if (!path.area) continue
      if (path.area > 0) outerPaths.push(path)
      else innerPaths.push(path)
    }
    if (outerPaths.length === 0) {
      unitedPath = mergePathsWithPrecision(paths)
    } else {
      unitedPath = outerPaths[0].clone()
      for (let i = 1; i < outerPaths.length; i++) {
        const result = unitedPath!.unite(outerPaths[i]) as paper.Path
        if (result && result.area && Math.abs(result.area) > 1e-6) {
          unitedPath = result
        }
      }
      for (const inner of innerPaths) {
        const result = unitedPath!.exclude(inner) as paper.Path
        if (result && result.area && Math.abs(result.area) > 1e-6) {
          unitedPath = result
        }
      }
      if (!unitedPath || !unitedPath.area || Math.abs(unitedPath.area) < 1e-6) {
        unitedPath = mergePathsWithPrecision(paths)
      }
    }
  } else {
    unitedPath = mergePathsWithPrecision(paths)
  }

  if (!unitedPath) return null
  return { path: unitedPath, pathsToRemove: paths }
}

/**
 * 从合并后的 paper.Path 提取为编辑用 pen 组件列表（每个子路径一个 pen 组件，坐标保持编辑空间）。
 */
export function pathToEditingPenComponents(path: paper.Path): IComponent[] {
  const components: IComponent[] = []

  function extractFromPath(p: paper.Path): void {
    if (p.children && p.children.length > 0) {
      for (let i = 0; i < p.children.length; i++) {
        const child = p.children[i]
        if (child instanceof paper.Path) {
          extractFromPath(child)
        }
      }
      return
    }

    if (!p.curves || p.curves.length === 0) return

    const points: Array<{ uuid: string; type: string; x: number; y: number; origin: string | null; isShow: boolean }> = []
    const startX = p.curves[0].point1.x
    const startY = p.curves[0].point1.y
    points.push({
      uuid: genUUID(),
      type: 'anchor',
      x: startX,
      y: startY,
      origin: null,
      isShow: true,
    })

    let lastCurveEndX: number | null = null
    let lastCurveEndY: number | null = null

    for (let j = 0; j < p.curves.length; j++) {
      const curve = p.curves[j]
      const curvePoints = [
        curve.point1,
        curve.point1.add(curve.handle1),
        curve.point2.add(curve.handle2),
        curve.point2,
      ]
      if (curvePoints.length >= 4) {
        const curveStartX = curvePoints[0].x
        const curveStartY = curvePoints[0].y
        let endX = curvePoints[3].x
        let endY = curvePoints[3].y
        lastCurveEndX = endX
        lastCurveEndY = endY

        if (j > 0 && points.length > 0) {
          const prevEnd = points[points.length - 1]
          const dx = Math.abs(prevEnd.x - curveStartX)
          const dy = Math.abs(prevEnd.y - curveStartY)
          if (dx > 0.001 || dy > 0.001) {
            endX = curvePoints[3].x
            endY = curvePoints[3].y
          }
        }

        const anchorPrevUuid = points[points.length - 1].uuid
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
          x: endX,
          y: endY,
          origin: null,
          isShow: true,
        }
        points.push(control1, control2, end)
      }
    }

    if (p.closed && points.length > 0) {
      const first = points[0]
      const last = points[points.length - 1]
      if (last.x !== first.x || last.y !== first.y) {
        last.x = first.x
        last.y = first.y
        if (points.length >= 4 && lastCurveEndX !== null && lastCurveEndY !== null) {
          const lastControl2 = points[points.length - 2]
          if (lastControl2 && lastControl2.type === 'control') {
            const origControl2ToEndX = lastCurveEndX - lastControl2.x
            const origControl2ToEndY = lastCurveEndY - lastControl2.y
            lastControl2.x = first.x - origControl2ToEndX
            lastControl2.y = first.y - origControl2ToEndY
          }
        }
      }
    }

    if (points.length >= 3) {
      const comp = genPenComponentEditing(points, true)
      components.push(comp)
    }
  }

  extractFromPath(path)
  return components
}

/**
 * 生成编辑空间下的 pen 组件（不做 formatPoints 字体坐标转换）。
 */
function genPenComponentEditing(
  points: Array<{ x: number; y: number; [key: string]: any }>,
  closePath: boolean
): IComponent {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const x = minX
  const y = minY
  const w = Math.max(0, maxX - minX)
  const h = Math.max(0, maxY - minY)

  const flatPoints: Array<{ x: number; y: number }> = []
  for (let i = 0; i + 3 < points.length; i += 4) {
    flatPoints.push(
      { x: points[i].x, y: points[i].y },
      { x: points[i + 1].x, y: points[i + 1].y },
      { x: points[i + 2].x, y: points[i + 2].y },
      { x: points[i + 3].x, y: points[i + 3].y }
    )
  }
  const contour = flatPoints.length >= 4 ? genPenContour(flatPoints, false) : []
  const preview = flatPoints.length >= 4 ? genPenContour(flatPoints, true) : []

  return {
    uuid: genUUID(),
    type: 'pen',
    name: 'pen',
    lock: false,
    visible: true,
    x,
    y,
    w,
    h,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    value: {
      points,
      strokeColor: '#000',
      fillColor: '',
      closePath,
      editMode: false,
      contour: contour as any,
      preview: preview as any,
    } as IPenComponent,
  }
}
