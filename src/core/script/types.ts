/**
 * 脚本执行相关的类型定义
 */

// IPoint 类型（用于 PenComponent 等）
export interface IPoint {
  uuid: string
  x: number
  y: number
  type: string
  origin: string | null
  isShow?: boolean
}

// 轮廓段类型
export interface ILine {
  type: 'line' | 'LINE'
  start: { x: number; y: number }
  end: { x: number; y: number }
}

export interface IQuadraticBezierCurve {
  type: 'quadratic' | 'QUADRATIC_BEZIER'
  start: { x: number; y: number }
  control: { x: number; y: number }
  end: { x: number; y: number }
}

export interface ICubicBezierCurve {
  type: 'cubic' | 'CUBIC_BEZIER'
  start: { x: number; y: number }
  control1: { x: number; y: number }
  control2: { x: number; y: number }
  end: { x: number; y: number }
}

export type ContourSegment = ILine | IQuadraticBezierCurve | ICubicBezierCurve
