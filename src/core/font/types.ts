/**
 * 字体相关核心类型定义
 */

/**
 * 路径类型枚举
 */
export enum PathType {
  LINE = 0,
  QUADRATIC_BEZIER = 1,
  CUBIC_BEZIER = 2,
}

/**
 * 点接口
 */
export interface IPoint {
  x: number
  y: number
}

/**
 * 直线路径
 */
export interface ILine {
  type: PathType.LINE
  start: IPoint
  end: IPoint
  fill?: boolean
}

/**
 * 二次贝塞尔曲线
 */
export interface IQuadraticBezierCurve {
  type: PathType.QUADRATIC_BEZIER
  start: IPoint
  end: IPoint
  control: IPoint
  fill?: boolean
}

/**
 * 三次贝塞尔曲线
 */
export interface ICubicBezierCurve {
  type: PathType.CUBIC_BEZIER
  start: IPoint
  end: IPoint
  control1: IPoint
  control2: IPoint
  fill?: boolean
}

/**
 * 路径类型联合
 */
export type IPath = ILine | IQuadraticBezierCurve | ICubicBezierCurve

/**
 * 轮廓类型（多个路径组成的数组）
 */
export type IContour = IPath[]

/**
 * 多个轮廓（字符/字形由多个轮廓组成）
 */
export type IContours = IContour[]
