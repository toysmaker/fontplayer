/**
 * 字形拖拽器核心类型定义
 */

import type { IComponent, IGlyphComponent, ICustomGlyph, ICharacterFileLite } from '@/core/types'

/**
 * 骨架关键点接口
 */
export interface IJoint {
  name: string
  x: number | (() => number)
  y: number | (() => number)
  uuid?: string
}

/**
 * 拖拽上下文接口
 */
export interface IDragContext {
  mode: 'character' | 'glyph'
  component: IComponent | IGlyphComponent
  componentUUID: string // 组件的 UUID，用作 instanceKey
  glyph?: ICustomGlyph
  character?: ICharacterFileLite
  rootComponent?: IComponent | IGlyphComponent
  selectedComponentsTree?: string[]
}

/**
 * 拖拽事件接口
 */
export interface IDragEvent {
  draggingJoint: IJoint
  deltaX: number
  deltaY: number
}

/**
 * 拖拽器配置接口
 */
export interface IDraggerConfig {
  canvas: HTMLCanvasElement
  context: IDragContext
  onRender?: () => void
  onUpdate?: (component: IComponent | IGlyphComponent) => void
  getCoord?: (coord: number) => number
  checkJoints?: () => boolean
  draggable?: () => boolean
  // Store实例（可选，用于更新状态）
  characterStore?: any
  glyphStore?: any
  // 坐标转换配置
  displayWidth?: number // Canvas 显示宽度（CSS 样式尺寸，默认 500）
  displayHeight?: number // Canvas 显示高度（CSS 样式尺寸，默认 500）
  unitsPerEm?: number // 坐标尺寸单位，默认 1000
}
