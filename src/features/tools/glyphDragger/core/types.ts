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
}
