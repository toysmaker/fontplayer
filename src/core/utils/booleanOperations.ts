/**
 * 布尔运算工具
 * 基于 Paper.js 提供轮廓间的差集布尔运算，用于后处理规则
 */

import paper from 'paper'
import { PathType, type IContour, type IContours } from '../font/types'

function contourToPaperPath(contour: IContour): paper.Path {
  const path = new paper.Path()
  if (contour.length === 0) return path

  const seg0 = contour[0]
  path.moveTo(new paper.Point(seg0.start.x, seg0.start.y))
  let lastX = seg0.start.x
  let lastY = seg0.start.y

  for (const segment of contour) {
    if (segment.type === PathType.LINE) {
      path.lineTo(new paper.Point(segment.end.x, segment.end.y))
      lastX = segment.end.x
      lastY = segment.end.y
    } else if (segment.type === PathType.CUBIC_BEZIER) {
      path.cubicCurveTo(
        new paper.Point(segment.control1.x, segment.control1.y),
        new paper.Point(segment.control2.x, segment.control2.y),
        new paper.Point(segment.end.x, segment.end.y),
      )
      lastX = segment.end.x
      lastY = segment.end.y
    } else if (segment.type === PathType.QUADRATIC_BEZIER) {
      const startPt = new paper.Point(lastX, lastY)
      const control = new paper.Point(segment.control.x, segment.control.y)
      const endPt = new paper.Point(segment.end.x, segment.end.y)
      const c1 = startPt.multiply(1 / 3).add(control.multiply(2 / 3))
      const c2 = endPt.multiply(1 / 3).add(control.multiply(2 / 3))
      path.cubicCurveTo(c1, c2, endPt)
      lastX = segment.end.x
      lastY = segment.end.y
    }
  }

  path.closePath()
  return path
}

function paperPathToContour(path: paper.Path): IContour {
  const contour: IContour = []
  if (!path.curves || path.curves.length === 0) return contour

  for (const curve of path.curves) {
    const p0 = curve.point1
    const p1 = p0.add(curve.handle1)
    const p2 = curve.point2.add(curve.handle2)
    const p3 = curve.point2

    contour.push({
      type: PathType.CUBIC_BEZIER as const,
      start: { x: p0.x, y: p0.y },
      control1: { x: p1.x, y: p1.y },
      control2: { x: p2.x, y: p2.y },
      end: { x: p3.x, y: p3.y },
    })
  }

  return contour
}

/**
 * 计算主体轮廓与裁剪轮廓的差集
 * 使用 Paper.js 执行布尔差集运算，返回差集中面积最大的轮廓
 */
export function contourDifference(
  subjectContours: IContours,
  clipContours: IContours,
): IContours {
  if (!subjectContours.length) return []
  if (!clipContours.length) return [...subjectContours]

  try {
    // 合并所有主体轮廓为一个路径
    let subjectPath: paper.PathItem = contourToPaperPath(subjectContours[0])
    for (let i = 1; i < subjectContours.length; i++) {
      const next = contourToPaperPath(subjectContours[i])
      subjectPath = subjectPath.unite(next) as paper.PathItem
      next.remove()
    }

    // 依次减去每个裁剪轮廓
    for (const clipContour of clipContours) {
      const clipPath = contourToPaperPath(clipContour)
      subjectPath = subjectPath.subtract(clipPath) as paper.PathItem
      clipPath.remove()
    }

    if (!subjectPath || (subjectPath as any).isEmpty?.()) return []

    // 处理 CompoundPath：找到面积最大的子路径
    const children = (subjectPath as any).children
    let bestPath: paper.Path | null = null
    let maxArea = 0

    if (children && children.length > 0) {
      for (const child of children) {
        if (child instanceof paper.Path && child.area != null) {
          const area = Math.abs(child.area)
          if (area > maxArea) {
            maxArea = area
            bestPath = child
          }
        }
      }
    } else if (subjectPath instanceof paper.Path) {
      bestPath = subjectPath
    }

    if (!bestPath || bestPath.curves.length === 0) {
      subjectPath.remove()
      return []
    }

    const resultContour = paperPathToContour(bestPath)
    subjectPath.remove()
    return resultContour.length ? [resultContour] : []
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[booleanOperations] contourDifference failed:', e)
    }
    return [...subjectContours]
  }
}
