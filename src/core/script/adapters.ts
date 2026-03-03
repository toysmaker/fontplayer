/**
 * 适配层
 * 提供原代码模块的适配，修复导入路径问题
 */

// 导出工具函数（从重构代码中导入）
export { formatPoints, genPenContour, genPolygonContour, genRectangleContour, genEllipseContour } from '../utils/contour'
export { transformPoints, getRectanglePoints, getEllipsePoints, translate } from '../utils/math'
export { computeCoords } from '../utils/grid'

// 导出类型
export type { IPoint, ILine, IQuadraticBezierCurve, ICubicBezierCurve, ContourSegment } from './types'

// 简化的工具函数（用于 Component 类）
export function genUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 简化的 canvas 映射函数（用于 Component 类的 render 方法）
export function mapCanvasX(x: number): number {
  return x
}

export function mapCanvasY(y: number): number {
  return y
}

// 简化的全局状态（用于 Component 类）
export const fontRenderStyle = { value: 'black' }
export function getStrokeWidth(): number {
  return 1
}

// 简化的 selectedFile（用于 Component 类）
export const selectedFile = { value: null }

// 占位符函数（需要后续实现）
// 注意：这些函数在脚本执行时可能被调用，需要安全处理
export function renderCanvas(components: any[], canvas: HTMLCanvasElement, options: any) {
  // TODO: 实现 renderCanvas 函数
  // 暂时静默处理，避免控制台警告过多
  // 在开发环境中才显示警告
  if (import.meta.env.DEV) {
    console.warn('renderCanvas not implemented yet', { components: components?.length, canvas, options })
  }
  // 清空画布，避免显示错误内容
  try {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  } catch (e) {
    // 忽略清空画布时的错误
  }
}

export function renderGridCanvas(components: any[], canvas: HTMLCanvasElement, options: any) {
  // TODO: 实现 renderGridCanvas 函数
  // 暂时静默处理，避免控制台警告过多
  // 在开发环境中才显示警告
  if (import.meta.env.DEV) {
    console.warn('renderGridCanvas not implemented yet', { components: components?.length, canvas, options })
  }
  // 清空画布，避免显示错误内容
  try {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  } catch (e) {
    // 忽略清空画布时的错误
  }
}
