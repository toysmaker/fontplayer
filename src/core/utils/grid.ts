/**
 * 九宫格布局坐标变换（自原 fontplayer/src/features/grid.ts 迁移）
 * 用 initialGrid 取格内参数，再用 currentGrid 映射回平面坐标。
 */

import type { IGridItem } from '../types'
import type { IPoint } from './math'

/** 传入 renderCanvas / computeCoords 的布局对象 */
export interface ILayoutTransformGrid {
  initialGrid: IGridItem
  currentGrid: IGridItem
  /** 正在编辑初始布局时不做预览变形（对齐原 canvas.ts gridEditStatus） */
  gridEditTarget?: 'initialGrid' | 'currentGrid'
}

interface IGridData {
  topScale: number
  bottomScale: number
  leftScale: number
  rightScale: number
  partX: number
  partY: number
}

function computeGridCoords(
  point: IPoint,
  initialGrid: IGridItem,
  currentGrid: IGridItem,
): IPoint {
  if (
    point.x < initialGrid.ox - initialGrid.width / 2 ||
    point.x > initialGrid.ox + initialGrid.width / 2 ||
    point.y < initialGrid.oy - initialGrid.height / 2 ||
    point.y > initialGrid.oy + initialGrid.height / 2
  ) {
    return { x: point.x, y: point.y }
  }

  const data = getDataInGridFromPoint(point, initialGrid)
  return getPointFromDataInGrid(data, currentGrid)
}

export function getDataInGridFromPoint(point: IPoint, grid: IGridItem): IGridData {
  let partX = 0
  let partY = 0
  const coords = getGridCoords(grid)
  const left = getIntersectionForTwoLines(
    { x1: 0, y1: point.y, x2: grid.width, y2: point.y },
    { x1: coords[0][1][0], y1: coords[0][1][1], x2: coords[3][1][0], y2: coords[3][1][1] },
    'object',
  ) as { x: number; y: number }
  const right = getIntersectionForTwoLines(
    { x1: 0, y1: point.y, x2: grid.width, y2: point.y },
    { x1: coords[0][2][0], y1: coords[0][2][1], x2: coords[3][2][0], y2: coords[3][2][1] },
    'object',
  ) as { x: number; y: number }
  const top = getIntersectionForTwoLines(
    { x1: point.x, y1: 0, x2: point.x, y2: grid.height },
    { x1: coords[1][0][0], y1: coords[1][0][1], x2: coords[1][3][0], y2: coords[1][3][1] },
    'object',
  ) as { x: number; y: number }
  const bottom = getIntersectionForTwoLines(
    { x1: point.x, y1: 0, x2: point.x, y2: grid.height },
    { x1: coords[2][0][0], y1: coords[2][0][1], x2: coords[2][3][0], y2: coords[2][3][1] },
    'object',
  ) as { x: number; y: number }

  if (point.x < left.x) {
    partX = 0
  } else if (point.x > right.x) {
    partX = 2
  } else {
    partX = 1
  }
  if (point.y < top.y) {
    partY = 0
  } else if (point.y > bottom.y) {
    partY = 2
  } else {
    partY = 1
  }
  let left_top_point = [0, 0]
  let right_top_point = [0, 0]
  let left_bottom_point = [0, 0]
  let right_bottom_point = [0, 0]
  if (partX === 0 && partY === 0) {
    left_top_point = coords[0][0]
    right_top_point = coords[0][1]
    left_bottom_point = coords[1][0]
    right_bottom_point = coords[1][1]
  } else if (partX === 0 && partY === 1) {
    left_top_point = coords[1][0]
    right_top_point = coords[1][1]
    left_bottom_point = coords[2][0]
    right_bottom_point = coords[2][1]
  } else if (partX === 0 && partY === 2) {
    left_top_point = coords[2][0]
    right_top_point = coords[2][1]
    left_bottom_point = coords[3][0]
    right_bottom_point = coords[3][1]
  } else if (partX === 1 && partY === 0) {
    left_top_point = coords[0][1]
    right_top_point = coords[0][2]
    left_bottom_point = coords[1][1]
    right_bottom_point = coords[1][2]
  } else if (partX === 1 && partY === 1) {
    left_top_point = coords[1][1]
    right_top_point = coords[1][2]
    left_bottom_point = coords[2][1]
    right_bottom_point = coords[2][2]
  } else if (partX === 1 && partY === 2) {
    left_top_point = coords[2][1]
    right_top_point = coords[2][2]
    left_bottom_point = coords[3][1]
    right_bottom_point = coords[3][2]
  } else if (partX === 2 && partY === 0) {
    left_top_point = coords[0][2]
    right_top_point = coords[0][3]
    left_bottom_point = coords[1][2]
    right_bottom_point = coords[1][3]
  } else if (partX === 2 && partY === 1) {
    left_top_point = coords[1][2]
    right_top_point = coords[1][3]
    left_bottom_point = coords[2][2]
    right_bottom_point = coords[2][3]
  } else if (partX === 2 && partY === 2) {
    left_top_point = coords[2][2]
    right_top_point = coords[2][3]
    left_bottom_point = coords[3][2]
    right_bottom_point = coords[3][3]
  }
  const topScale = (point.x - left_top_point[0]) / (right_top_point[0] - left_top_point[0])
  const leftScale = (point.y - left_top_point[1]) / (left_bottom_point[1] - left_top_point[1])
  const bottomScale =
    (point.x - left_bottom_point[0]) / (right_bottom_point[0] - left_bottom_point[0])
  const rightScale =
    (point.y - right_top_point[1]) / (right_bottom_point[1] - right_top_point[1])
  return { partX, partY, topScale, leftScale, bottomScale, rightScale }
}

export function getPointFromDataInGrid(data: IGridData, grid: IGridItem): IPoint {
  const { partX, partY, topScale, leftScale, bottomScale, rightScale } = data
  const coords = getGridCoords(grid)
  let left_top_point = [0, 0]
  let right_top_point = [0, 0]
  let left_bottom_point = [0, 0]
  let right_bottom_point = [0, 0]
  if (partX === 0 && partY === 0) {
    left_top_point = coords[0][0]
    right_top_point = coords[0][1]
    left_bottom_point = coords[1][0]
    right_bottom_point = coords[1][1]
  } else if (partX === 0 && partY === 1) {
    left_top_point = coords[1][0]
    right_top_point = coords[1][1]
    left_bottom_point = coords[2][0]
    right_bottom_point = coords[2][1]
  } else if (partX === 0 && partY === 2) {
    left_top_point = coords[2][0]
    right_top_point = coords[2][1]
    left_bottom_point = coords[3][0]
    right_bottom_point = coords[3][1]
  } else if (partX === 1 && partY === 0) {
    left_top_point = coords[0][1]
    right_top_point = coords[0][2]
    left_bottom_point = coords[1][1]
    right_bottom_point = coords[1][2]
  } else if (partX === 1 && partY === 1) {
    left_top_point = coords[1][1]
    right_top_point = coords[1][2]
    left_bottom_point = coords[2][1]
    right_bottom_point = coords[2][2]
  } else if (partX === 1 && partY === 2) {
    left_top_point = coords[2][1]
    right_top_point = coords[2][2]
    left_bottom_point = coords[3][1]
    right_bottom_point = coords[3][2]
  } else if (partX === 2 && partY === 0) {
    left_top_point = coords[0][2]
    right_top_point = coords[0][3]
    left_bottom_point = coords[1][2]
    right_bottom_point = coords[1][3]
  } else if (partX === 2 && partY === 1) {
    left_top_point = coords[1][2]
    right_top_point = coords[1][3]
    left_bottom_point = coords[2][2]
    right_bottom_point = coords[2][3]
  } else if (partX === 2 && partY === 2) {
    left_top_point = coords[2][2]
    right_top_point = coords[2][3]
    left_bottom_point = coords[3][2]
    right_bottom_point = coords[3][3]
  }
  const topX = left_top_point[0] + topScale * (right_top_point[0] - left_top_point[0])
  const topY = left_top_point[1] + topScale * (right_top_point[1] - left_top_point[1])
  const bottomX = left_bottom_point[0] + bottomScale * (right_bottom_point[0] - left_bottom_point[0])
  const bottomY = left_bottom_point[1] + bottomScale * (right_bottom_point[1] - left_bottom_point[1])
  const leftX = left_top_point[0] + leftScale * (left_bottom_point[0] - left_top_point[0])
  const leftY = left_top_point[1] + leftScale * (left_bottom_point[1] - left_top_point[1])
  const rightX = right_top_point[0] + rightScale * (right_bottom_point[0] - right_top_point[0])
  const rightY = right_top_point[1] + rightScale * (right_bottom_point[1] - right_top_point[1])

  const mapped = getIntersectionForTwoLines(
    { x1: topX, y1: topY, x2: bottomX, y2: bottomY },
    { x1: leftX, y1: leftY, x2: rightX, y2: rightY },
    'object',
  ) as { x: number; y: number } | null
  if (!mapped) {
    return { x: topX, y: topY }
  }
  return mapped
}

export function getGridCoords(grid: IGridItem): number[][][] {
  const coords: number[][][] = [
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  ]
  const { ox, oy, width, height, centerSquareScale, dx1, dx2, dx3, dx4, dy1, dy2, dy3, dy4, dx, dy } =
    grid
  coords[0][0] = [ox - width / 2, oy - height / 2]
  coords[0][3] = [ox + width / 2, oy - height / 2]
  coords[3][0] = [ox - width / 2, oy + height / 2]
  coords[3][3] = [ox + width / 2, oy + height / 2]
  const centerSquareTopLeftX_origin = ox - width / 6 + dx1
  const centerSquareTopRightX_origin = ox + width / 6 + dx2
  const centerSquareBottomLeftX_origin = ox - width / 6 + dx3
  const centerSquareBottomRightX_origin = ox + width / 6 + dx4
  const centerSquareTopLeftY_origin = oy - height / 6 + dy1
  const centerSquareTopRightY_origin = oy - height / 6 + dy2
  const centerSquareBottomLeftY_origin = oy + height / 6 + dy3
  const centerSquareBottomRightY_origin = oy + height / 6 + dy4
  const centerSquareTopLeftX_current =
    ox + (centerSquareTopLeftX_origin - ox) * centerSquareScale + dx
  const centerSquareTopRightX_current =
    ox + (centerSquareTopRightX_origin - ox) * centerSquareScale + dx
  const centerSquareBottomLeftX_current =
    ox + (centerSquareBottomLeftX_origin - ox) * centerSquareScale + dx
  const centerSquareBottomRightX_current =
    ox + (centerSquareBottomRightX_origin - ox) * centerSquareScale + dx
  const centerSquareTopLeftY_current =
    oy + (centerSquareTopLeftY_origin - oy) * centerSquareScale + dy
  const centerSquareTopRightY_current =
    oy + (centerSquareTopRightY_origin - oy) * centerSquareScale + dy
  const centerSquareBottomLeftY_current =
    oy + (centerSquareBottomLeftY_origin - oy) * centerSquareScale + dy
  const centerSquareBottomRightY_current =
    oy + (centerSquareBottomRightY_origin - oy) * centerSquareScale + dy

  coords[0][1] = getIntersectionForTwoLines(
    {
      x1: centerSquareTopLeftX_current,
      y1: centerSquareTopLeftY_current,
      x2: centerSquareBottomLeftX_current,
      y2: centerSquareBottomLeftY_current,
    },
    { x1: coords[0][0][0], y1: coords[0][0][1], x2: coords[0][3][0], y2: coords[0][3][1] },
    'array',
  ) as number[]
  coords[0][2] = getIntersectionForTwoLines(
    {
      x1: centerSquareTopRightX_current,
      y1: centerSquareTopRightY_current,
      x2: centerSquareBottomRightX_current,
      y2: centerSquareBottomRightY_current,
    },
    { x1: coords[0][0][0], y1: coords[0][0][1], x2: coords[0][3][0], y2: coords[0][3][1] },
    'array',
  ) as number[]
  coords[3][1] = getIntersectionForTwoLines(
    {
      x1: centerSquareTopLeftX_current,
      y1: centerSquareTopLeftY_current,
      x2: centerSquareBottomLeftX_current,
      y2: centerSquareBottomLeftY_current,
    },
    { x1: coords[3][0][0], y1: coords[3][0][1], x2: coords[3][3][0], y2: coords[3][3][1] },
    'array',
  ) as number[]
  coords[3][2] = getIntersectionForTwoLines(
    {
      x1: centerSquareTopRightX_current,
      y1: centerSquareTopRightY_current,
      x2: centerSquareBottomRightX_current,
      y2: centerSquareBottomRightY_current,
    },
    { x1: coords[3][0][0], y1: coords[3][0][1], x2: coords[3][3][0], y2: coords[3][3][1] },
    'array',
  ) as number[]

  coords[1][0] = getIntersectionForTwoLines(
    {
      x1: centerSquareTopLeftX_current,
      y1: centerSquareTopLeftY_current,
      x2: centerSquareTopRightX_current,
      y2: centerSquareTopRightY_current,
    },
    { x1: coords[0][0][0], y1: coords[0][0][1], x2: coords[3][0][0], y2: coords[3][0][1] },
    'array',
  ) as number[]
  coords[2][0] = getIntersectionForTwoLines(
    {
      x1: centerSquareBottomLeftX_current,
      y1: centerSquareBottomLeftY_current,
      x2: centerSquareBottomRightX_current,
      y2: centerSquareBottomRightY_current,
    },
    { x1: coords[0][0][0], y1: coords[0][0][1], x2: coords[3][0][0], y2: coords[3][0][1] },
    'array',
  ) as number[]
  coords[1][3] = getIntersectionForTwoLines(
    {
      x1: centerSquareTopLeftX_current,
      y1: centerSquareTopLeftY_current,
      x2: centerSquareTopRightX_current,
      y2: centerSquareTopRightY_current,
    },
    { x1: coords[0][3][0], y1: coords[0][3][1], x2: coords[3][3][0], y2: coords[3][3][1] },
    'array',
  ) as number[]
  coords[2][3] = getIntersectionForTwoLines(
    {
      x1: centerSquareBottomLeftX_current,
      y1: centerSquareBottomLeftY_current,
      x2: centerSquareBottomRightX_current,
      y2: centerSquareBottomRightY_current,
    },
    { x1: coords[0][3][0], y1: coords[0][3][1], x2: coords[3][3][0], y2: coords[3][3][1] },
    'array',
  ) as number[]

  coords[1][1] = [centerSquareTopLeftX_current, centerSquareTopLeftY_current]
  coords[1][2] = [centerSquareTopRightX_current, centerSquareTopRightY_current]
  coords[2][1] = [centerSquareBottomLeftX_current, centerSquareBottomLeftY_current]
  coords[2][2] = [centerSquareBottomRightX_current, centerSquareBottomRightY_current]

  return coords
}

export function getIntersectionForTwoLines(
  line1: { x1: number; y1: number; x2: number; y2: number },
  line2: { x1: number; y1: number; x2: number; y2: number },
  format: 'array' | 'object' = 'object',
): number[] | { x: number; y: number } | null {
  const { x1: x11, y1: y11, x2: x12, y2: y12 } = line1
  const { x1: x21, y1: y21, x2: x22, y2: y22 } = line2

  const isLine1Vertical = Math.abs(x12 - x11) < Number.EPSILON
  const isLine2Vertical = Math.abs(x22 - x21) < Number.EPSILON
  const isLine1Horizontal = Math.abs(y12 - y11) < Number.EPSILON
  const isLine2Horizontal = Math.abs(y22 - y21) < Number.EPSILON

  if (isLine1Vertical && isLine2Vertical) {
    return null
  }

  if (isLine1Vertical) {
    const x = x11
    if (isLine2Horizontal) {
      const y = y21
      return format === 'array' ? [x, y] : { x, y }
    }
    const k2 = (y22 - y21) / (x22 - x21)
    const y = k2 * (x - x21) + y21
    return format === 'array' ? [x, y] : { x, y }
  }

  if (isLine2Vertical) {
    const x = x21
    if (isLine1Horizontal) {
      const y = y11
      return format === 'array' ? [x, y] : { x, y }
    }
    const k1 = (y12 - y11) / (x12 - x11)
    const y = k1 * (x - x11) + y11
    return format === 'array' ? [x, y] : { x, y }
  }

  const k1 = (y12 - y11) / (x12 - x11)
  const k2 = (y22 - y21) / (x22 - x21)

  if (Math.abs(k1 - k2) < Number.EPSILON) {
    return null
  }

  const x = (y21 - y11 + k1 * x11 - k2 * x21) / (k1 - k2)
  const y = k1 * (x - x11) + y11

  return format === 'array' ? [x, y] : { x, y }
}

/**
 * `grid` 为 ILayoutTransformGrid 或含 initialGrid/currentGrid 的对象；否则返回原坐标。
 */
export function computeCoords(grid: any, point: IPoint): IPoint {
  if (!grid) {
    return point
  }
  const layout = grid as ILayoutTransformGrid
  if (layout.gridEditTarget === 'initialGrid') {
    return point
  }
  if (!layout.initialGrid || !layout.currentGrid) {
    return point
  }
  return computeGridCoords(point, layout.initialGrid, layout.currentGrid)
}
