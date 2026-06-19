/**
 * 轮廓生成工具函数
 * 从原代码迁移的轮廓生成函数
 */

import { PathType } from '../font/types'
import type { IContour } from '../font/types'
import type { IPoint } from './math'

/**
 * 格式化点数组（坐标转换）
 * type: 0 - 从编辑坐标转换为字体坐标
 * type: 1 - 从字体坐标转换为编辑坐标
 */
export function formatPoints(
  points: Array<IPoint>,
  options: {
    unitsPerEm: number
    descender: number
    advanceWidth: number
  },
  type: number
): Array<IPoint> {
  const { unitsPerEm, descender, advanceWidth } = options
  if (type === 0) {
    const scale = 1
    return points.map((point) => {
      let x = point.x + (unitsPerEm - advanceWidth) / 2
      let y = unitsPerEm - point.y
      y = y + descender
      x *= scale
      y *= scale
      return {
        ...point,
        x,
        y,
      }
    })
  } else if (type === 1) {
    const scale = 1
    return points.map((point) => {
      let x = point.x * scale
      let y = point.y * scale
      x -= (unitsPerEm - advanceWidth) / 2
      y = y - descender
      y = unitsPerEm - y
      return {
        ...point,
        x,
        y,
      }
    })
  }
  return points
}

/**
 * 生成钢笔轮廓
 */
function applyRound(v: number, mode: boolean | 'none'): number {
  if (mode === 'none') return v
  return mode ? Math.round(v) : Math.floor(v)
}

export function genPenContour(
  points: Array<IPoint>,
  useRound: boolean | 'none' = false,
  fill: boolean = false
): IContour {
  const contour: IContour = []
  for (let i = 0; i < points.length - 1; i += 3) {
    if (i + 3 >= points.length) break
    contour.push({
      type: PathType.CUBIC_BEZIER,
      start:  { x: applyRound(points[i].x, useRound),     y: applyRound(points[i].y, useRound) },
      end:    { x: applyRound(points[i + 3].x, useRound), y: applyRound(points[i + 3].y, useRound) },
      control1: { x: applyRound(points[i + 1].x, useRound), y: applyRound(points[i + 1].y, useRound) },
      control2: { x: applyRound(points[i + 2].x, useRound), y: applyRound(points[i + 2].y, useRound) },
    })
  }
  return contour
}

/**
 * 生成多边形轮廓
 */
export function genPolygonContour(
  points: Array<IPoint>,
  useRound: boolean | 'none' = false
): IContour {
  const contour: IContour = []
  for (let i = 0; i < points.length - 1; i++) {
    contour.push({
      type: PathType.LINE,
      start: { x: applyRound(points[i].x, useRound),     y: applyRound(points[i].y, useRound) },
      end:   { x: applyRound(points[i + 1].x, useRound), y: applyRound(points[i + 1].y, useRound) },
    })
  }
  return contour
}

/**
 * 生成矩形轮廓
 */
export function genRectangleContour(
  points: Array<IPoint>,
  useRound: boolean | 'none' = false
): IContour {
  const contour: IContour = []
  for (let i = 0; i < points.length - 1; i++) {
    contour.push({
      type: PathType.LINE,
      start: { x: applyRound(points[i].x, useRound),     y: applyRound(points[i].y, useRound) },
      end:   { x: applyRound(points[i + 1].x, useRound), y: applyRound(points[i + 1].y, useRound) },
    })
  }
  return contour
}

/**
 * 生成椭圆轮廓
 */
export function genEllipseContour(
  points: Array<IPoint>,
  useRound: boolean | 'none' = false
): IContour {
  const contour: IContour = []
  for (let i = 0; i < points.length - 1; i++) {
    contour.push({
      type: PathType.LINE,
      start: { x: applyRound(points[i].x, useRound),     y: applyRound(points[i].y, useRound) },
      end:   { x: applyRound(points[i + 1].x, useRound), y: applyRound(points[i + 1].y, useRound) },
    })
  }
  return contour
}
