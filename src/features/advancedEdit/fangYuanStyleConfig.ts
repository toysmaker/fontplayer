/**
 * 字玩方圆黑体专属设计通道 — 风格样式配置
 *
 * 每个 StyleItem 定义：
 * - label: UI 中显示的名称
 * - paramName: 目标字形组件中要修改的参数名
 * - glyphNames: 拥有该参数的组件名称列表
 * - options: 可选样式值列表
 *
 * 架构预留：
 * - StyleRule 接口用于未来添加复杂规则（如"横起笔处与竖拼合时不改变样式"）
 * - applyStyleToGlyph 是核心修改函数，后续可在调用前后插入规则检查
 */

import {
  FANG_YUAN_STYLE_RULES,
  FANG_YUAN_COMMON_PARAM_DEFS,
  FANG_YUAN_VALUE_PARAM_DEFAULTS as SHARED_VALUE_PARAM_DEFAULTS,
} from '@/templates/private/v1/strokeParamBuilder'

export interface StyleOption {
  value: number
  label: string
}

export interface StyleItem {
  label: string
  paramName: string
  glyphNames: string[]
  options: StyleOption[]
}

/**
 * 风格规则接口（预留）
 * 未来可对特定 glyphName + paramName 组合添加前置/后置规则
 */
export interface StyleRule {
  /** 规则名称 */
  name: string
  /** 适用的组件名称列表（空数组表示全部） */
  glyphNames: string[]
  /** 适用的参数名 */
  paramName: string
  /**
   * 前置检查：返回 false 则跳过该参数的修改
   * @param context - 包含当前字符、组件、参数等上下文信息
   */
  shouldApply?: (context: StyleRuleContext) => boolean
  /**
   * 后置处理：在参数修改后执行
   * @param context - 包含当前字符、组件、参数等上下文信息
   */
  postProcess?: (context: StyleRuleContext) => void
}

export interface StyleRuleContext {
  characterIndex: number
  glyphName: string
  paramName: string
  oldValue: number
  newValue: number
  /** 预留：可传递额外上下文 */
  extra?: Record<string, unknown>
}

/**
 * 规则注册表
 * 规则通过 fangYuanRules.initFangYuanRules() 动态注册，避免循环依赖。
 * applyStyleToGlyphParameter 会自动遍历此数组检查规则。
 */
export const fangYuanStyleRules: StyleRule[] = []

// ===== 设计通道条目：从共享规则表（private/v1/strokeParamBuilder）派生 =====
// 选项 0 的展示标签由设计通道自行定义（"默认风格"/"默认"），其余选项数据一律取自共享规则表。
const ruleOf = (key: string) => {
  const r = FANG_YUAN_STYLE_RULES.find((item) => item.key === key)
  if (!r) throw new Error(`[fangYuanStyleConfig] 风格规则缺失: ${key}`)
  return r
}

const DEFAULT_STYLE_OPTION = { value: 0, label: '默认风格' }
const DEFAULT_OPTION = { value: 0, label: '默认' }

/** 通用参数定义的初始 options（如转角风格的 方角/圆角） */
const commonParamOptions = (paramName: string) =>
  FANG_YUAN_COMMON_PARAM_DEFS.find((d) => d.name === paramName)?.options ?? []

export const FANG_YUAN_STYLE_ITEMS: StyleItem[] = [
  {
    label: '横起笔风格',
    paramName: ruleOf('横起笔').paramName,
    glyphNames: ruleOf('横起笔').glyphNames,
    options: [DEFAULT_STYLE_OPTION, ...ruleOf('横起笔').options],
  },
  {
    label: '横收笔风格',
    paramName: ruleOf('横收笔').paramName,
    glyphNames: ruleOf('横收笔').glyphNames,
    options: [DEFAULT_STYLE_OPTION, ...ruleOf('横收笔').options],
  },
  {
    label: '竖起笔风格',
    paramName: ruleOf('竖起笔').paramName,
    glyphNames: ruleOf('竖起笔').glyphNames,
    options: [DEFAULT_STYLE_OPTION, ...ruleOf('竖起笔').options],
  },
  {
    label: '竖收笔风格',
    paramName: ruleOf('竖收笔').paramName,
    glyphNames: ruleOf('竖收笔').glyphNames,
    options: [DEFAULT_STYLE_OPTION, ...ruleOf('竖收笔').options],
  },
  {
    label: '转角风格',
    paramName: ruleOf('转角').paramName,
    glyphNames: ruleOf('转角').glyphNames,
    options: [...commonParamOptions('转角风格'), ...ruleOf('转角').options],
  },
  {
    label: '钩收笔风格',
    paramName: ruleOf('钩收笔').paramName,
    glyphNames: ruleOf('钩收笔').glyphNames,
    options: [DEFAULT_OPTION, ...ruleOf('钩收笔').options],
  },
  {
    label: '撇起笔风格',
    paramName: ruleOf('直角撇起笔').paramName,
    glyphNames: ruleOf('直角撇起笔').glyphNames,
    options: [DEFAULT_OPTION, ...ruleOf('直角撇捺起笔尖头').options, ...ruleOf('直角撇起笔').options],
  },
  {
    label: '撇收笔风格',
    paramName: ruleOf('直角撇收笔').paramName,
    glyphNames: ruleOf('直角撇收笔').glyphNames,
    options: [DEFAULT_OPTION, ...ruleOf('直角撇捺收笔尖头').options, ...ruleOf('直角撇收笔').options],
  },
  {
    label: '捺起笔风格',
    paramName: ruleOf('直角捺起笔').paramName,
    glyphNames: ruleOf('直角捺起笔').glyphNames,
    options: [DEFAULT_OPTION, ...ruleOf('直角撇捺起笔尖头').options, ...ruleOf('直角捺起笔').options],
  },
  {
    label: '捺收笔风格',
    paramName: ruleOf('直角捺收笔').paramName,
    glyphNames: ruleOf('直角捺收笔').glyphNames,
    options: [DEFAULT_OPTION, ...ruleOf('直角撇捺收笔尖头').options, ...ruleOf('直角捺收笔').options],
  },
  {
    label: '单圆角部件方头样式',
    paramName: ruleOf('单圆角部件方头样式').renameTo!,
    glyphNames: ruleOf('单圆角部件方头样式').glyphNames,
    options: [...ruleOf('单圆角部件方头样式').options],
  },
  {
    label: '单圆角部件圆头样式',
    paramName: ruleOf('单圆角部件圆头样式').renameTo!,
    glyphNames: ruleOf('单圆角部件圆头样式').glyphNames,
    options: [...ruleOf('单圆角部件圆头样式').options],
  },
  // 新增：横折钩 / 可倾斜横折钩 的弯笔收笔（脚本 end_style_type === 6）
  {
    label: '钩弯笔收笔风格',
    paramName: ruleOf('横折钩弯笔收笔').paramName,
    glyphNames: ruleOf('横折钩弯笔收笔').glyphNames,
    options: [DEFAULT_OPTION, ...ruleOf('横折钩弯笔收笔').options],
  },
]

/** 风格参数名 → 对应数值参数名 */
export function getValueParamName(styleParamName: string): string {
  return styleParamName.replace('风格', '数值').replace('样式', '数值')
}

/** 数值参数的默认值及范围（来自共享规则表 private/v1/strokeParamBuilder） */
export const VALUE_PARAM_DEFAULTS: Record<string, { value: number; min: number; max: number }> = SHARED_VALUE_PARAM_DEFAULTS

/**
 * 修改字形组件上的数值参数（Number 类型）
 */
export function applyNumericValueToGlyph(
  glyph: { name: string; parameters?: unknown },
  valueParamName: string,
  newValue: number,
): boolean {
  const params = getGlyphParamArray(glyph)
  if (!params) return false
  for (const param of params) {
    if (param.name !== valueParamName) continue
    param.value = newValue
    return true
  }
  return false
}

/**
 * 从 ICustomGlyph 中提取参数数组（兼容两种存储格式）
 */
function getGlyphParamArray(glyph: { parameters?: unknown }): Array<{ name: string; value: unknown }> | undefined {
  const raw = glyph.parameters
  if (!raw) return undefined
  if (Array.isArray(raw)) return raw as Array<{ name: string; value: unknown }>
  const inner = (raw as { parameters?: unknown }).parameters
  if (Array.isArray(inner)) return inner as Array<{ name: string; value: unknown }>
  return undefined
}

/**
 * 对单个字形组件应用风格修改
 *
 * 只修改参数的 value，保留原有的 options/label 配置。
 * 后续可在此函数前后插入 StyleRule 检查。
 */
export function applyStyleToGlyphParameter(
  glyph: { name: string; parameters?: unknown },
  paramName: string,
  newValue: number,
  characterIndex: number,
  extra?: Record<string, unknown>,
): boolean {
  const params = getGlyphParamArray(glyph)
  if (!params) return false

  for (const param of params) {
    if (param.name !== paramName) continue

    const context: StyleRuleContext = {
      characterIndex,
      glyphName: glyph.name,
      paramName,
      oldValue: param.value as number,
      newValue,
      extra,
    }
    const blocked = fangYuanStyleRules.some(
      (rule) =>
        (rule.glyphNames.length === 0 || rule.glyphNames.includes(glyph.name)) &&
        rule.paramName === paramName &&
        rule.shouldApply?.(context) === false,
    )
    if (blocked) {
      if (import.meta.env.DEV) {
        console.log(
          `[FangYuanStyle] BLOCKED glyph="${glyph.name}" param="${paramName}" ` +
          `oldValue=${context.oldValue} → newValue=${newValue} (rule prevented modification)`,
        )
      }
      return false
    }

    param.value = newValue

    // 执行后置规则
    for (const rule of fangYuanStyleRules) {
      if (
        (rule.glyphNames.length === 0 || rule.glyphNames.includes(glyph.name)) &&
        rule.paramName === paramName &&
        rule.postProcess
      ) {
        rule.postProcess(context)
      }
    }
    return true
  }
  return false
}
