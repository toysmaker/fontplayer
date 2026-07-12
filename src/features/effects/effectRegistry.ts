/**
 * 效果注册表
 * 将效果类型映射到具体的应用函数
 */

import type { IComponent } from '@/core/types'
import type { EffectType } from './types'
import { applyAdjustWeight } from './effects/adjustWeight'
import { applyInkBleed } from './effects/inkBleed'
import { applyRoughEdge } from './effects/roughEdge'
import { applyGlitch } from './effects/glitch'
import { applyHandDrawnJitter } from './effects/handDrawnJitter'
import { applyMelt } from './effects/melt'
import { applyGeometricSimplify } from './effects/geometricSimplify'
import { applyPixelate } from './effects/pixelate'

/** 效果应用函数类型 */
export type EffectApplyFn = (
  components: IComponent[],
  params: Record<string, number>,
) => IComponent[]

/** 效果注册表 */
const effectRegistry: Record<EffectType, EffectApplyFn> = {
  'adjust-weight': applyAdjustWeight,
  'ink-bleed': applyInkBleed,
  'rough-edge': applyRoughEdge,
  'glitch': applyGlitch,
  'hand-drawn-jitter': applyHandDrawnJitter,
  'melt': applyMelt,
  'geometric-simplify': applyGeometricSimplify,
  'pixelate': applyPixelate,
}

/**
 * 应用效果到组件列表
 * @param components pen 组件列表
 * @param type 效果类型
 * @param params 效果参数
 * @returns 新的 pen 组件列表
 */
export function applyEffect(
  components: IComponent[],
  type: EffectType,
  params: Record<string, number>,
): IComponent[] {
  const fn = effectRegistry[type]
  if (!fn) {
    if (import.meta.env.DEV) {
      console.warn(`[effectRegistry] Unknown effect type: ${type}`)
    }
    return components
  }
  return fn(components, params)
}
