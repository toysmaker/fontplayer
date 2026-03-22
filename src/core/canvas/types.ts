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
  /** 字形实例等场景：当子组件 value 未设 fillColor 时，用此作为显示色（与组件面板 layer 颜色一致） */
  layerTint?: string
  grid?: any
  /** 传给字形 render_grid：是否用骨架重算轮廓（与字符 info.useSkeletonGrid 一致） */
  useSkeletonGrid?: boolean
  /**
   * 仅字形 render_grid 内调用的 renderCanvas 置为 true：跳过 picture/pen/polygon/ellipse/rectangle，
   * 避免与 getComponentsBySkeleton 结果叠画。字符顶层 renderCanvas 必须为 false。
   */
  skipPrimitivesForSkeletonPreview?: boolean
}
