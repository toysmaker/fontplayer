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

/** 规则注册表（当前为空，后续添加规则时在此注册） */
export const fangYuanStyleRules: StyleRule[] = []

export const FANG_YUAN_STYLE_ITEMS: StyleItem[] = [
  {
    label: '横起笔风格',
    paramName: '起笔风格',
    glyphNames: [
      '横', '横钩', '横撇', '横撇弯钩', '横弯钩', '横折', '横折2',
      '横折钩', '横折挑', '横折弯', '横折弯钩', '横折折撇', '横折折弯钩', '二横折',
    ],
    options: [
      { value: 0, label: '默认风格' },
      { value: 1, label: '圆切-上' },
      { value: 2, label: '圆切-下' },
      { value: 3, label: '斜切-上' },
      { value: 4, label: '斜切-下' },
      { value: 5, label: '圆切-圆弧装饰-上' },
      { value: 6, label: '圆切-圆弧装饰-下' },
      { value: 7, label: '圆切-棱角装饰-上' },
      { value: 8, label: '圆切-棱角装饰-下' },
    ],
  },
  {
    label: '横收笔风格',
    paramName: '收笔风格',
    glyphNames: ['横', '竖折'],
    options: [
      { value: 0, label: '默认风格' },
      { value: 1, label: '燕尾收笔' },
      { value: 2, label: '圆切-上' },
      { value: 3, label: '圆切-下' },
      { value: 4, label: '斜切-上' },
      { value: 5, label: '斜切-下' },
      { value: 6, label: '圆切-圆弧装饰-上' },
      { value: 7, label: '圆切-圆弧装饰-下' },
      { value: 8, label: '圆切-棱角装饰-上' },
      { value: 9, label: '圆切-棱角装饰-下' },
    ],
  },
  {
    label: '竖起笔风格',
    paramName: '起笔风格',
    glyphNames: [
      '竖', '竖钩', '竖挑', '竖弯', '竖弯钩', '竖折', '竖折折钩',
      '直竖撇', '直竖捺',
    ],
    options: [
      { value: 0, label: '默认风格' },
      { value: 1, label: '圆切-左' },
      { value: 2, label: '圆切-右' },
      { value: 3, label: '斜切-左' },
      { value: 4, label: '斜切-右' },
      { value: 5, label: '圆切-圆弧装饰-左' },
      { value: 6, label: '圆切-圆弧装饰-右' },
      { value: 7, label: '圆切-棱角装饰-左' },
      { value: 8, label: '圆切-棱角装饰-右' },
    ],
  },
  {
    label: '竖收笔风格',
    paramName: '收笔风格',
    glyphNames: ['竖', '横折', '横折2'],
    options: [
      { value: 0, label: '默认风格' },
      { value: 1, label: '圆切-左' },
      { value: 2, label: '圆切-右' },
      { value: 3, label: '斜切-左' },
      { value: 4, label: '斜切-右' },
      { value: 5, label: '圆切-圆弧装饰-左' },
      { value: 6, label: '圆切-圆弧装饰-右' },
      { value: 7, label: '圆切-棱角装饰-左' },
      { value: 8, label: '圆切-棱角装饰-右' },
    ],
  },
  {
    label: '转角风格',
    paramName: '转角风格',
    glyphNames: [
      '横折', '横折2', '横折钩', '横折挑', '横折弯钩', '横折折弯钩',
      '竖折', '竖折折钩', '二横折', '横弯钩',
    ],
    options: [
      { value: 0, label: '方角' },
      { value: 1, label: '圆角' },
      { value: 2, label: '圆切-横' },
      { value: 3, label: '圆切-竖' },
      { value: 4, label: '斜切-横' },
      { value: 5, label: '斜切-竖' },
      { value: 6, label: '圆切-圆弧装饰-横' },
      { value: 7, label: '圆切-圆弧装饰-竖' },
      { value: 8, label: '圆切-棱角装饰-横' },
      { value: 9, label: '圆切-棱角装饰-竖' },
      { value: 10, label: '圆切露锋-横' },
      { value: 11, label: '圆切露锋-竖' },
    ],
  },
  {
    label: '钩收笔风格',
    paramName: '收笔风格',
    glyphNames: [
      '横弯钩', '横折钩', '横折弯钩', '横折折弯钩',
      '竖钩', '竖弯钩', '竖折折钩',
    ],
    options: [
      { value: 0, label: '默认' },
      { value: 3, label: '圆切' },
      { value: 4, label: '斜切' },
      { value: 5, label: '圆切露锋' },
    ],
  },
  {
    label: '撇起笔风格',
    paramName: '起笔风格',
    glyphNames: ['直角撇'],
    options: [
      { value: 0, label: '默认' },
      { value: 1, label: '尖头' },
      { value: 2, label: '圆切-左' },
      { value: 3, label: '圆切-右' },
      { value: 4, label: '斜切-左' },
      { value: 5, label: '斜切-右' },
      { value: 6, label: '圆切-圆弧装饰-左' },
      { value: 7, label: '圆切-圆弧装饰-右' },
      { value: 8, label: '圆切-棱角装饰-左' },
      { value: 9, label: '圆切-棱角装饰-右' },
    ],
  },
  {
    label: '撇收笔风格',
    paramName: '收笔风格',
    glyphNames: ['直角撇', '横撇'],
    options: [
      { value: 0, label: '默认' },
      { value: 1, label: '尖头' },
      { value: 2, label: '圆切-上' },
      { value: 3, label: '圆切-下' },
      { value: 4, label: '斜切-上' },
      { value: 5, label: '斜切-下' },
      { value: 6, label: '厚重露锋' },
      { value: 7, label: '厚重露锋-圆切-上' },
      { value: 8, label: '厚重露锋-圆切-下' },
      { value: 9, label: '厚重露锋-斜切-上' },
      { value: 10, label: '厚重露锋-斜切-下' },
    ],
  },
  {
    label: '捺起笔风格',
    paramName: '起笔风格',
    glyphNames: ['直角捺'],
    options: [
      { value: 0, label: '默认' },
      { value: 1, label: '尖头' },
      { value: 2, label: '圆切-左' },
      { value: 3, label: '圆切-右' },
      { value: 4, label: '斜切-左' },
      { value: 5, label: '斜切-右' },
      { value: 6, label: '圆切-圆弧装饰-左' },
      { value: 7, label: '圆切-圆弧装饰-右' },
      { value: 8, label: '圆切-棱角装饰-左' },
      { value: 9, label: '圆切-棱角装饰-右' },
    ],
  },
  {
    label: '捺收笔风格',
    paramName: '收笔风格',
    glyphNames: ['直角捺'],
    options: [
      { value: 0, label: '默认' },
      { value: 1, label: '尖头' },
      { value: 2, label: '圆切-上' },
      { value: 3, label: '圆切-下' },
      { value: 4, label: '斜切-上' },
      { value: 5, label: '斜切-下' },
      { value: 6, label: '厚重露锋' },
      { value: 7, label: '厚重露锋-圆切-上' },
      { value: 8, label: '厚重露锋-圆切-下' },
      { value: 9, label: '厚重露锋-斜切-上' },
      { value: 10, label: '厚重露锋-斜切-下' },
    ],
  },
  {
    label: '单圆角部件方头样式',
    paramName: '方头样式',
    glyphNames: ['竖直单圆角部件', '水平单圆角部件'],
    options: [
      { value: 0, label: '默认样式' },
      { value: 1, label: '圆切-外' },
      { value: 2, label: '圆切-内' },
      { value: 3, label: '斜切-外' },
      { value: 4, label: '斜切-内' },
      { value: 5, label: '圆切-圆弧装饰-外' },
      { value: 6, label: '圆切-圆弧装饰-内' },
      { value: 7, label: '圆切-棱角装饰-外' },
      { value: 8, label: '圆切-棱角装饰-内' },
    ],
  },
  {
    label: '单圆角部件圆头样式',
    paramName: '圆头样式',
    glyphNames: ['竖直单圆角部件', '水平单圆角部件'],
    options: [
      { value: 0, label: '默认样式' },
      { value: 1, label: '圆切' },
      { value: 2, label: '斜切' },
      { value: 3, label: '圆切露锋' },
    ],
  },
]

/** 风格参数名 → 对应数值参数名 */
export function getValueParamName(styleParamName: string): string {
  return styleParamName.replace('风格', '数值').replace('样式', '数值')
}

/** 数值参数的默认值及范围（与 templatesHandlers importTemplateTest 保持一致） */
export const VALUE_PARAM_DEFAULTS: Record<string, { value: number; min: number; max: number }> = {
  '起笔数值': { value: 1, min: 0, max: 2 },
  '收笔数值': { value: 2, min: 1, max: 3 },
  '转角数值': { value: 1.5, min: 1, max: 2 },
  '方头数值': { value: 1.5, min: 1, max: 2 },
  '圆头数值': { value: 2, min: 1, max: 3 },
}

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
): boolean {
  const params = getGlyphParamArray(glyph)
  if (!params) return false

  for (const param of params) {
    if (param.name !== paramName) continue

    // 检查是否有规则阻止修改
    const context: StyleRuleContext = {
      characterIndex,
      glyphName: glyph.name,
      paramName,
      oldValue: param.value as number,
      newValue,
    }
    const blocked = fangYuanStyleRules.some(
      (rule) =>
        (rule.glyphNames.length === 0 || rule.glyphNames.includes(glyph.name)) &&
        rule.paramName === paramName &&
        rule.shouldApply?.(context) === false,
    )
    if (blocked) return false

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
