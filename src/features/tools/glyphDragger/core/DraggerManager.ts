/**
 * Dragger管理器
 * 使用单例模式管理每个canvas的dragger实例
 */

import type { BaseGlyphDragger } from './BaseGlyphDragger'
import type { IDraggerConfig } from './types'
import { CharacterGlyphDragger } from '../adapters/CharacterGlyphDragger'
import { GlyphGlyphDragger } from '../adapters/GlyphGlyphDragger'

export class DraggerManager {
  // 使用WeakMap自动管理生命周期，canvas销毁时实例也会被清理
  private static instances = new WeakMap<HTMLCanvasElement, BaseGlyphDragger>()
  
  /**
   * 创建dragger实例（内部方法，避免循环依赖）
   */
  private static createDragger(
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
   * 获取或创建dragger实例
   */
  static getOrCreate(
    canvas: HTMLCanvasElement,
    mode: 'character' | 'glyph',
    config: IDraggerConfig
  ): BaseGlyphDragger {
    let instance = this.instances.get(canvas)
    
    if (!instance) {
      // 创建新实例
      instance = this.createDragger(mode, config)
      this.instances.set(canvas, instance)
    } else {
      // 检查模式是否匹配
      if (instance.getMode() !== mode) {
        // 模式不匹配，需要重新创建
        instance.destroy()
        instance = this.createDragger(mode, config)
        this.instances.set(canvas, instance)
      } else {
        // 更新现有实例的上下文和配置
        instance.updateContext(config.context)
        instance.updateConfig(config)
      }
    }
    
    return instance
  }
  
  /**
   * 移除并销毁dragger实例
   */
  static remove(canvas: HTMLCanvasElement): void {
    const instance = this.instances.get(canvas)
    if (instance) {
      instance.destroy()
      this.instances.delete(canvas)
    }
  }
  
  /**
   * 获取canvas对应的实例（不创建）
   */
  static get(canvas: HTMLCanvasElement): BaseGlyphDragger | undefined {
    return this.instances.get(canvas)
  }
  
  /**
   * 检查canvas是否有实例
   */
  static has(canvas: HTMLCanvasElement): boolean {
    return this.instances.has(canvas)
  }
}
