/**
 * 画布渲染相关类型定义
 */

export enum GridType {
  None = 0,
  Mesh = 1,
  Mi = 2,
  LayoutGrid = 3,
}

export enum BackgroundType {
  Transparent = 0,
  Color = 1,
}

export interface IGrid {
  precision: number
  type: GridType
}

export interface IBackground {
  type: BackgroundType
  color: string
}

export interface IRenderOptions {
  fill?: boolean
  offset?: {
    x: number
    y: number
  }
  scale?: number
  forceUpdate?: boolean
  grid?: any
  useSkeletonGrid?: boolean
}
