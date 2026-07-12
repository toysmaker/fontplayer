/**
 * 效果滤镜类型定义
 * Effect filter type definitions
 */

/** 效果类型标识 */
export type EffectType =
  | 'adjust-weight'
  | 'ink-bleed'
  | 'rough-edge'
  | 'glitch'
  | 'hand-drawn-jitter'
  | 'melt'
  | 'geometric-simplify'
  | 'pixelate'

/** 效果参数定义 */
export interface EffectParamDef {
  key: string
  labelKey: string
  min: number
  max: number
  step: number
  default: number
}

/** 效果定义 */
export interface EffectDefinition {
  type: EffectType
  labelKey: string
  params: EffectParamDef[]
  defaultParams: Record<string, number>
}

/** 所有效果的定义列表 */
export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  {
    type: 'adjust-weight',
    labelKey: 'menus.effects.adjust_weight',
    params: [
      { key: 'weight', labelKey: 'effects.adjustWeight.params.weight', min: -100, max: 100, step: 1, default: 20 },
      { key: 'quality', labelKey: 'effects.adjustWeight.params.quality', min: 0, max: 200, step: 1, default: 50 },
    ],
    defaultParams: { weight: 20, quality: 50 },
  },
  {
    type: 'ink-bleed',
    labelKey: 'menus.effects.ink_bleed',
    params: [
      { key: 'expandDist', labelKey: 'effects.inkBleed.params.expandDist', min: 0, max: 15, step: 0.5, default: 3 },
      { key: 'roughnessScale', labelKey: 'effects.inkBleed.params.roughnessScale', min: 1, max: 30, step: 1, default: 12 },
      { key: 'roughnessAmp', labelKey: 'effects.inkBleed.params.roughnessAmp', min: 0, max: 10, step: 0.5, default: 2 },
      { key: 'splatterDensity', labelKey: 'effects.inkBleed.params.splatterDensity', min: 0, max: 1, step: 0.05, default: 0.1 },
      { key: 'splatterSize', labelKey: 'effects.inkBleed.params.splatterSize', min: 1, max: 10, step: 0.5, default: 3 },
      { key: 'seed', labelKey: 'effects.inkBleed.params.seed', min: 0, max: 100, step: 1, default: 0 },
    ],
    defaultParams: { expandDist: 3, roughnessScale: 12, roughnessAmp: 2, splatterDensity: 0.1, splatterSize: 3, seed: 0 },
  },
  {
    type: 'rough-edge',
    labelKey: 'menus.effects.rough_edge',
    params: [
      { key: 'amplitude', labelKey: 'effects.roughEdge.params.amplitude', min: 0, max: 20, step: 0.5, default: 3 },
      { key: 'frequency', labelKey: 'effects.roughEdge.params.frequency', min: 1, max: 20, step: 0.5, default: 8 },
      { key: 'seed', labelKey: 'effects.roughEdge.params.seed', min: 0, max: 100, step: 1, default: 0 },
    ],
    defaultParams: { amplitude: 3, frequency: 8, seed: 0 },
  },
  {
    type: 'glitch',
    labelKey: 'menus.effects.glitch',
    params: [
      { key: 'sliceHeight', labelKey: 'effects.glitch.params.sliceHeight', min: 5, max: 80, step: 1, default: 20 },
      { key: 'maxShift', labelKey: 'effects.glitch.params.maxShift', min: 0, max: 60, step: 1, default: 15 },
      { key: 'gapProbability', labelKey: 'effects.glitch.params.gapProbability', min: 0, max: 1, step: 0.05, default: 0.1 },
      { key: 'seed', labelKey: 'effects.glitch.params.seed', min: 0, max: 100, step: 1, default: 0 },
    ],
    defaultParams: { sliceHeight: 20, maxShift: 15, gapProbability: 0.1, seed: 0 },
  },
  {
    type: 'hand-drawn-jitter',
    labelKey: 'menus.effects.hand_drawn_jitter',
    params: [
      { key: 'jitterAmplitude', labelKey: 'effects.handDrawnJitter.params.jitterAmplitude', min: 0, max: 15, step: 0.5, default: 3 },
      { key: 'subdivisions', labelKey: 'effects.handDrawnJitter.params.subdivisions', min: 1, max: 5, step: 1, default: 2 },
      { key: 'seed', labelKey: 'effects.handDrawnJitter.params.seed', min: 0, max: 100, step: 1, default: 0 },
    ],
    defaultParams: { jitterAmplitude: 3, subdivisions: 2, seed: 0 },
  },
  {
    type: 'melt',
    labelKey: 'menus.effects.melt',
    params: [
      { key: 'amplitude', labelKey: 'effects.melt.params.amplitude', min: 0, max: 40, step: 0.5, default: 10 },
      { key: 'frequency', labelKey: 'effects.melt.params.frequency', min: 1, max: 20, step: 0.5, default: 5 },
      { key: 'dripLength', labelKey: 'effects.melt.params.dripLength', min: 0, max: 50, step: 1, default: 15 },
      { key: 'dripCount', labelKey: 'effects.melt.params.dripCount', min: 0, max: 15, step: 1, default: 3 },
      { key: 'seed', labelKey: 'effects.melt.params.seed', min: 0, max: 100, step: 1, default: 0 },
    ],
    defaultParams: { amplitude: 10, frequency: 5, dripLength: 15, dripCount: 3, seed: 0 },
  },
  {
    type: 'geometric-simplify',
    labelKey: 'menus.effects.geometric_simplify',
    params: [
      { key: 'tolerance', labelKey: 'effects.geometricSimplify.params.tolerance', min: 0.5, max: 20, step: 0.5, default: 3 },
      { key: 'curveError', labelKey: 'effects.geometricSimplify.params.curveError', min: 0.5, max: 20, step: 0.5, default: 3 },
    ],
    defaultParams: { tolerance: 3, curveError: 3 },
  },
  {
    type: 'pixelate',
    labelKey: 'menus.effects.pixelate',
    params: [
      { key: 'cellSize', labelKey: 'effects.pixelate.params.cellSize', min: 5, max: 80, step: 1, default: 20 },
    ],
    defaultParams: { cellSize: 20 },
  },
]

/** 获取效果定义 */
export function getEffectDefinition(type: EffectType): EffectDefinition | undefined {
  return EFFECT_DEFINITIONS.find((e) => e.type === type)
}
