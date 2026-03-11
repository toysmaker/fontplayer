/**
 * 工具系统类型定义
 */

import type { IComponent } from '@/core/types'

/**
 * 工具类型
 */
export type ToolType = 'select' | 'pen' | 'polygon' | 'ellipse' | 'rectangle' | 'picture' | 'glyph' | 'code' | 'params' | 'grid' | 'metrics'

/**
 * 编辑模式
 */
export type EditMode = 'character' | 'glyph'

/**
 * 工具配置
 */
export interface IToolConfig {
  canvas: HTMLCanvasElement
  mode: EditMode
  getCoord?: (coord: number) => number
  onRender?: () => void
}

/**
 * 工具渲染函数类型
 */
export type ToolRenderFunction = (canvas: HTMLCanvasElement) => void

/**
 * 选择控制类型
 */
export type SelectControlType = 
  | 'scale-left-top'
  | 'scale-right-top'
  | 'scale-left-bottom'
  | 'scale-right-bottom'
  | 'rotate-left-top'
  | 'rotate-right-top'
  | 'rotate-left-bottom'
  | 'rotate-right-bottom'
  | 'inner-area'
  | 'null'
