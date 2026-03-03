/**
 * 字形拖拽器入口
 * 导出所有公共API
 */

import { CharacterGlyphDragger } from './adapters/CharacterGlyphDragger'
import { GlyphGlyphDragger } from './adapters/GlyphGlyphDragger'
import { DraggerManager } from './core/DraggerManager'
import type { BaseGlyphDragger } from './core/BaseGlyphDragger'
import type { IDraggerConfig } from './core/types'

// 导出 BaseGlyphDragger 类型
export type { BaseGlyphDragger } from './core/BaseGlyphDragger'

/**
 * 创建字形拖拽器（直接创建，不管理生命周期）
 */
export function createGlyphDragger(
  mode: 'character' | 'glyph',
  config: IDraggerConfig
): BaseGlyphDragger {
  switch (mode) {
    case 'character':
      return new CharacterGlyphDragger({
        ...config,
        context: { ...config.context, mode: 'character' }
      })
    case 'glyph':
      return new GlyphGlyphDragger({
        ...config,
        context: { ...config.context, mode: 'glyph' }
      })
    default:
      throw new Error(`Unknown mode: ${mode}`)
  }
}

/**
 * 获取或创建dragger实例（推荐使用）
 */
export function getOrCreateDragger(
  canvas: HTMLCanvasElement,
  mode: 'character' | 'glyph',
  config: IDraggerConfig
): BaseGlyphDragger {
  return DraggerManager.getOrCreate(canvas, mode, config)
}

// 导出DraggerManager供高级用法
export { DraggerManager } from './core/DraggerManager'

// 导出类型
export * from './core/types'
