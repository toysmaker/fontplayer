/**
 * 数学工具函数
 * 从原代码迁移的数学计算函数
 */

export interface IPoint {
  x: number
  y: number
}

/**
 * 获取点的边界框
 */
export function getBound(points: Array<{ x: number; y: number }>): {
  x: number
  y: number
  w: number
  h: number
} {
  let minx = Infinity
  let miny = Infinity
  let maxx = -Infinity
  let maxy = -Infinity
  for (let i = 0; i < points.length; i++) {
    if (points[i].x < minx) {
      minx = points[i].x
    }
    if (points[i].x > maxx) {
      maxx = points[i].x
    }
    if (points[i].y < miny) {
      miny = points[i].y
    }
    if (points[i].y > maxy) {
      maxy = points[i].y
    }
  }
  return {
    x: minx,
    y: miny,
    w: maxx - minx,
    h: maxy - miny,
  }
}

/**
 * 旋转点
 */
export function rotatePoint(
  point: IPoint,
  center: IPoint,
  angle: number
): IPoint {
  const _angle = (angle * Math.PI) / 180
  return {
    x:
      center.x +
      (point.x - center.x) * Math.cos(_angle) -
      (point.y - center.y) * Math.sin(_angle),
    y:
      center.y +
      (point.x - center.x) * Math.sin(_angle) +
      (point.y - center.y) * Math.cos(_angle),
  }
}

/**
 * 变换点数组
 */
export function transformPoints(
  points: Array<{ x: number; y: number }>,
  transform: {
    x: number
    y: number
    w: number
    h: number
    rotation: number
    flipX: boolean
    flipY: boolean
  },
  fixedOriginBounds?: { x: number; y: number; w: number; h: number }
): Array<{ x: number; y: number }> {
  // 如果提供了固定的边界框（编辑模式下），使用它；否则使用当前点的边界框
  const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } =
    fixedOriginBounds || getBound(points)
  const { x, y, w, h, rotation, flipX, flipY } = transform
  const _points: Array<{ x: number; y: number }> = points.map((point) => {
    let _point = { ...point }
    // 翻转应该在原始点空间内进行，相对于原始点的边界框中心
    if (flipX) {
      _point.x = origin_x + origin_w / 2 + (origin_x + origin_w / 2 - _point.x)
    }
    if (flipY) {
      _point.y = origin_y + origin_h / 2 + (origin_y + origin_h / 2 - _point.y)
    }
    _point = rotatePoint(_point, {
      x: origin_x + origin_w / 2,
      y: origin_y + origin_h / 2,
    }, rotation)
    _point = {
      x: _point.x + (x - origin_x),
      y: _point.y + (y - origin_y),
    }
    _point = {
      x: x + (origin_w ? ((_point.x - x) * w) / origin_w : 0),
      y: y + (origin_h ? ((_point.y - y) * h) / origin_h : 0),
    }
    return _point
  })
  return _points
}

/**
 * 获取椭圆点数组
 */
export function getEllipsePoints(
  radiusX: number,
  radiusY: number,
  n: number = 1000,
  originX: number = 0,
  originY: number = 0
): Array<{ x: number; y: number }> {
  const points1: Array<{ x: number; y: number }> = []
  const points2: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n / 2; i++) {
    const x = -radiusX + (radiusX * 2) / (n / 2) * i
    const y = Math.sqrt(
      (1 - (x * x) / (radiusX * radiusX)) * radiusY * radiusY
    )
    points1.push({
      x: originX + x,
      y: originY + y,
    })
    points2.push({
      x: originX + x,
      y: originY - y,
    })
  }
  return points1.concat(points2.reverse())
}

/**
 * 获取矩形点数组
 */
export function getRectanglePoints(
  rectX: number,
  rectY: number,
  originX: number,
  originY: number
): Array<{ x: number; y: number }> {
  return [
    {
      x: originX,
      y: originY,
    },
    {
      x: originX + rectX,
      y: originY,
    },
    {
      x: originX + rectX,
      y: originY + rectY,
    },
    {
      x: originX,
      y: originY + rectY,
    },
  ]
}

/**
 * 平移点
 */
export function translate(
  p: { x: number; y: number },
  offset: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: p.x + offset.x,
    y: p.y + offset.y,
  }
}

/**
 * 计算两点之间的距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((y2 - y1) * (y2 - y1) + (x2 - x1) * (x2 - x1))
}

/**
 * 判断点是否在组件边界框内
 */
export function inComponentBound(
  point: { x: number; y: number },
  component: { x: number; y: number; w: number; h: number; rotation: number },
  d: number = 0
): boolean {
  const { x, y, w, h, rotation } = component
  const { x: _x, y: _y } = rotatePoint(
    { x: point.x, y: point.y },
    { x: component.x + component.w / 2, y: component.y + component.h / 2 },
    -rotation
  )
  if (_x >= x - d && _x <= x + w + d && _y >= y - d && _y <= y + h + d) {
    return true
  }
  return false
}

/**
 * 判断点是否接近另一个点
 */
export function isNearPoint(x1: number, y1: number, x2: number, y2: number, d: number): boolean {
  return distance(x1, y1, x2, y2) <= d
}

/**
 * 判断点是否在左上角旋转控制区域
 */
export function leftTop(x1: number, y1: number, x2: number, y2: number, d: number): boolean {
  if (distance(x1, y1, x2, y2) > 4 * d) return false
  if (distance(x1, y1, x2, y2) < 2 * d) return false
  if (x1 < x2 && y1 < y2) return true
  return false
}

/**
 * 判断点是否在左下角旋转控制区域
 */
export function leftBottom(x1: number, y1: number, x2: number, y2: number, d: number): boolean {
  if (distance(x1, y1, x2, y2) > 4 * d) return false
  if (distance(x1, y1, x2, y2) < 2 * d) return false
  if (x1 < x2 && y1 > y2) return true
  return false
}

/**
 * 判断点是否在右上角旋转控制区域
 */
export function rightTop(x1: number, y1: number, x2: number, y2: number, d: number): boolean {
  if (distance(x1, y1, x2, y2) > 4 * d) return false
  if (distance(x1, y1, x2, y2) < 2 * d) return false
  if (x1 > x2 && y1 < y2) return true
  return false
}

/**
 * 判断点是否在右下角旋转控制区域
 */
export function rightBottom(x1: number, y1: number, x2: number, y2: number, d: number): boolean {
  if (distance(x1, y1, x2, y2) > 4 * d) return false
  if (distance(x1, y1, x2, y2) < 2 * d) return false
  if (x1 > x2 && y1 > y2) return true
  return false
}

/**
 * 计算两个向量之间的角度差
 */
export function angleBetween(vec1: { x: number; y: number }, vec2: { x: number; y: number }): number {
  const angle1 = Math.atan2(vec1.y, vec1.x)
  const angle2 = Math.atan2(vec2.y, vec2.x)
  return Math.round((angle1 - angle2) * 180 / Math.PI)
}
