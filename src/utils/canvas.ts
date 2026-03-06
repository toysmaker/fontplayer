/**
 * Canvas 坐标映射工具函数
 * 参考原工程 src/utils/canvas.ts
 */

const ratio = 2
const default_unitsPerEm = 1000

export const mapCanvasCoords = (point: { x: number; y: number }) => {
  return {
    x: ratio * point.x,
    y: ratio * point.y,
  }
}

export const mapCanvasX = (x: number) => {
  return ratio * x
}

export const mapCanvasY = (y: number) => {
  return ratio * y
}

export const mapCanvasWidth = (width: number) => {
  return ratio * width
}

export const mapCanvasHeight = (height: number) => {
  return ratio * height
}

export const unMapCanvasWidth = (width: number) => {
  return width / ratio
}

export const unMapCanvasHeight = (height: number) => {
  return height / ratio
}
