/**
 * 字玩方圆黑体（private/v1）笔画参数规则 —— 唯一数据源。
 *
 * 供以下入口复用（修改方圆黑体笔画参数规则时只改这里）：
 * - templatesHandlers.importTemplateTest（导入笔画时构建参数）
 * - temporaryScripts/addMissingFangYuanStrokes（dev 下补全缺失笔画）
 * - features/advancedEdit/fangYuanStyleConfig（专属设计通道 FANG_YUAN_STYLE_ITEMS 派生）
 * - temporaryScripts/fileProcessing（旧工程迁移补丁的规则合并）
 */
import type { IParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { strokes } from './strokes'

export type FangYuanStroke = {
  name: string
  params: Array<{ name: string; default?: number; min?: number; max?: number }>
}

/** 基础参数：来自 strokes 数据定义 */
export function paramsFromStroke(stroke: FangYuanStroke): IParameter[] {
  const parameters: IParameter[] = []
  for (const param of stroke.params) {
    parameters.push({
      uuid: genUUID(),
      name: param.name,
      type: ParameterType.Number,
      value: param.default ?? 0,
      min: param.min ?? 0,
      max: param.max === 0 ? 0 : (param.max ?? 1000),
    })
  }
  return parameters
}

// ===== 通用参数定义（参考位置 + 起笔/收笔/转角/运笔等） =====
export interface FangYuanCommonParamDef {
  name: string
  type: ParameterType
  value: number
  min?: number
  max?: number
  options?: Array<{ value: number; label: string }>
}

export const FANG_YUAN_COMMON_PARAM_DEFS: FangYuanCommonParamDef[] = [
  {
    name: '参考位置',
    type: ParameterType.Enum,
    value: 0,
    options: [
      { value: 0, label: '默认' },
      { value: 1, label: '右侧（上侧）' },
      { value: 2, label: '左侧（下侧）' },
    ],
  },
  {
    name: '起笔风格',
    type: ParameterType.Enum,
    value: 0,
    options: [{ value: 0, label: '无起笔样式' }],
  },
  { name: '起笔数值', type: ParameterType.Number, value: 1, min: 0, max: 2 },
  {
    name: '转角风格',
    type: ParameterType.Enum,
    value: 0,
    options: [
      { value: 0, label: '方角' },
      { value: 1, label: '圆角' },
    ],
  },
  { name: '转角数值', type: ParameterType.Number, value: 1.5, min: 1, max: 2 },
  {
    name: '收笔风格',
    type: ParameterType.Enum,
    value: 0,
    options: [{ value: 0, label: '无收笔样式' }],
  },
  { name: '收笔数值', type: ParameterType.Number, value: 2, min: 1, max: 3 },
  {
    name: '运笔风格',
    type: ParameterType.Enum,
    value: 0,
    options: [
      { value: 0, label: '默认运笔样式' },
      { value: 1, label: '提笔变细-圆角' },
      { value: 2, label: '提笔变细-斜角' },
    ],
  },
  { name: '运笔数值', type: ParameterType.Number, value: 1, min: 1, max: 2 },
  { name: '字重变化', type: ParameterType.Number, value: 0, min: 0, max: 2 },
  { name: '弯曲程度', type: ParameterType.Number, value: 1, min: 0, max: 2 },
]

/** 风格数值参数的默认值与范围（起笔数值/收笔数值/转角数值/方头数值/圆头数值） */
export const FANG_YUAN_VALUE_PARAM_DEFAULTS: Record<string, { value: number; min: number; max: number }> = {
  '起笔数值': { value: 1, min: 0, max: 2 },
  '收笔数值': { value: 2, min: 1, max: 3 },
  '转角数值': { value: 1.5, min: 1, max: 2 },
  '方头数值': { value: 1.5, min: 1, max: 2 },
  '圆头数值': { value: 2, min: 1, max: 3 },
}

// ===== 风格规则表 =====
export interface FangYuanStyleRule {
  /** 规则标识（fangYuanStyleConfig 按 key 派生设计通道条目） */
  key: string
  /** 设计通道分组名（仅设计通道展示的规则需要） */
  label?: string
  /** 目标参数名（应用 renameTo 前） */
  paramName: string
  /** 参数重命名（单圆角部件：转角风格→方头样式 / 收笔风格→圆头样式） */
  renameTo?: string
  /** 同步重命名对应数值参数 */
  valueParamRename?: { from: string; to: string }
  /** 适用笔画名称 */
  glyphNames: string[]
  /** 追加（push）或整体替换（replace）的选项 */
  options: Array<{ value: number; label: string }>
  mode: 'push' | 'replace'
  /** 应用前把已存在选项的第一项 label 改为该值（单圆角部件起笔） */
  relabelFirst?: string
}

/** 所有名称含"钩"的笔画（钩类默认收笔规则用，随 strokes 数据自动派生） */
const ALL_GOU_NAMES = strokes.filter(s => s.name.includes('钩')).map(s => s.name)

/**
 * 规则表（按应用顺序排列；replace 规则先放通配，再放具体覆盖，
 * 与原 if/else-if 链的最终结果一致）。
 */
export const FANG_YUAN_STYLE_RULES: FangYuanStyleRule[] = [
  {
    key: '撇捺点起笔',
    paramName: '起笔风格',
    glyphNames: ['撇', '捺', '点'],
    mode: 'push',
    options: [
      { value: 1, label: '水平方头' },
      { value: 2, label: '竖直方头' },
      { value: 3, label: '尖头' },
    ],
  },
  {
    key: '撇捺点收笔',
    paramName: '收笔风格',
    glyphNames: ['撇', '捺', '点'],
    mode: 'push',
    options: [
      { value: 1, label: '水平方头' },
      { value: 2, label: '竖直方头' },
      { value: 3, label: '尖头' },
    ],
  },
  {
    key: '横撇收笔',
    paramName: '收笔风格',
    glyphNames: ['横撇'],
    mode: 'push',
    options: [
      { value: 1, label: '竖直方头' },
      { value: 2, label: '尖头' },
    ],
  },
  {
    key: '钩类默认收笔',
    paramName: '收笔风格',
    glyphNames: ALL_GOU_NAMES,
    mode: 'replace',
    options: [{ value: 0, label: '单圆角收笔' }],
  },
  {
    key: '横钩收笔',
    paramName: '收笔风格',
    glyphNames: ['横钩'],
    mode: 'replace',
    options: [
      { value: 0, label: '左单圆角收笔' },
      { value: 1, label: '右单圆角收笔' },
    ],
  },
  {
    key: '横弯钩收笔',
    paramName: '收笔风格',
    glyphNames: ['横弯钩'],
    mode: 'replace',
    options: [
      { value: 0, label: '单圆角收笔' },
      { value: 1, label: '燕尾收笔' },
      { value: 2, label: '直捺收笔' },
    ],
  },
  {
    key: '竖弯钩收笔',
    paramName: '收笔风格',
    glyphNames: ['竖弯钩'],
    mode: 'replace',
    options: [
      { value: 0, label: '单圆角收笔' },
      { value: 1, label: '燕尾收笔' },
    ],
  },
  {
    key: '单圆角部件起笔',
    paramName: '起笔风格',
    glyphNames: ['水平单圆角部件', '竖直单圆角部件'],
    mode: 'push',
    relabelFirst: '左上方圆角',
    options: [
      { value: 1, label: '左下方圆角' },
      { value: 2, label: '右上方圆角' },
      { value: 3, label: '右下方圆角' },
    ],
  },
  {
    key: '直角撇捺起笔尖头',
    paramName: '起笔风格',
    glyphNames: ['直角撇', '直角捺', '倒直角撇'],
    mode: 'push',
    options: [{ value: 1, label: '尖头' }],
  },
  {
    key: '直角撇捺收笔尖头',
    paramName: '收笔风格',
    glyphNames: ['直角撇', '直角捺', '倒直角撇'],
    mode: 'push',
    options: [{ value: 1, label: '尖头' }],
  },
  {
    key: '竖挑收笔',
    paramName: '收笔风格',
    glyphNames: ['竖挑'],
    mode: 'replace',
    options: [
      { value: 0, label: '单圆角收笔' },
      { value: 1, label: '方头收笔' },
    ],
  },
  {
    key: '横起笔',
    label: '横起笔风格',
    paramName: '起笔风格',
    glyphNames: ['横', '横钩', '横撇', '横撇弯钩', '横弯钩', '横折', '横折2', '横折钩', '横折弯', '横折弯钩', '横折折撇', '横折折弯钩', '二横折'],
    mode: 'push',
    options: [
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
    key: '转角',
    label: '转角风格',
    paramName: '转角风格',
    glyphNames: ['横折', '横折2', '横折钩', '横折挑', '横折折弯钩', '竖折', '竖折折钩', '二横折', '横弯钩'],
    mode: 'push',
    options: [
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
    key: '竖起笔',
    label: '竖起笔风格',
    paramName: '起笔风格',
    glyphNames: ['竖', '竖钩', '竖挑', '竖弯', '竖弯钩', '竖折', '竖折折钩', '直竖撇', '直竖捺'],
    mode: 'push',
    options: [
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
    key: '竖收笔',
    label: '竖收笔风格',
    paramName: '收笔风格',
    glyphNames: ['竖', '横折', '横折2', '二横折'],
    mode: 'push',
    options: [
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
    key: '横收笔',
    label: '横收笔风格',
    paramName: '收笔风格',
    glyphNames: ['横', '竖折'],
    mode: 'push',
    options: [
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
    key: '直角撇起笔',
    label: '撇起笔风格',
    paramName: '起笔风格',
    glyphNames: ['直角撇', '倒直角撇'],
    mode: 'push',
    options: [
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
    key: '直角捺起笔',
    label: '捺起笔风格',
    paramName: '起笔风格',
    glyphNames: ['直角捺'],
    mode: 'push',
    options: [
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
    key: '直角撇收笔',
    label: '撇收笔风格',
    paramName: '收笔风格',
    glyphNames: ['直角撇', '横撇', '倒直角撇'],
    mode: 'push',
    options: [
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
    key: '直角捺收笔',
    label: '捺收笔风格',
    paramName: '收笔风格',
    glyphNames: ['直角捺'],
    mode: 'push',
    options: [
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
    key: '单圆角部件方头样式',
    label: '单圆角部件方头样式',
    paramName: '转角风格',
    renameTo: '方头样式',
    valueParamRename: { from: '转角数值', to: '方头数值' },
    glyphNames: ['水平单圆角部件', '竖直单圆角部件'],
    mode: 'replace',
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
    key: '单圆角部件圆头样式',
    label: '单圆角部件圆头样式',
    paramName: '收笔风格',
    renameTo: '圆头样式',
    valueParamRename: { from: '收笔数值', to: '圆头数值' },
    glyphNames: ['水平单圆角部件', '竖直单圆角部件'],
    mode: 'replace',
    options: [
      { value: 0, label: '默认样式' },
      { value: 1, label: '圆切' },
      { value: 2, label: '斜切' },
      { value: 3, label: '圆切露锋' },
    ],
  },
  {
    key: '钩收笔',
    label: '钩收笔风格',
    paramName: '收笔风格',
    glyphNames: ['横弯钩', '横折钩', '横折弯钩', '横折折弯钩', '竖钩', '竖弯钩', '竖折折钩', '可倾斜横折钩'],
    mode: 'push',
    options: [
      { value: 3, label: '圆切' },
      { value: 4, label: '斜切' },
      { value: 5, label: '圆切露锋' },
    ],
  },
  {
    key: '倒直角撇厚重露锋',
    paramName: '起笔风格',
    glyphNames: ['倒直角撇'],
    mode: 'push',
    options: [{ value: 10, label: '厚重露锋' }],
  },
  {
    key: '平捺弯笔起笔',
    paramName: '起笔风格',
    glyphNames: ['平捺'],
    mode: 'push',
    // 平捺脚本 start_style_type === 1
    options: [{ value: 1, label: '弯笔起笔' }],
  },
  {
    key: '横折钩弯笔收笔',
    paramName: '收笔风格',
    glyphNames: ['横折钩', '可倾斜横折钩', '竖折折钩', '横折折弯钩', '竖钩', '竖挑'],
    mode: 'push',
    // 横折钩脚本 end_style_type === 6
    options: [{ value: 6, label: '弯笔收笔' }],
  },
]

/** 向 options 中按 value 去重追加条目 */
function pushOptionsIfNew(
  options: Array<{ value: number; label: string }>,
  items: Array<{ value: number; label: string }>,
): void {
  const existingValues = new Set(options.map(o => o.value))
  for (const item of items) {
    if (!existingValues.has(item.value)) {
      options.push({ ...item })
    }
  }
}

export interface FangYuanStyleRuleApplyOptions {
  /** push 模式按 value 去重（迁移合并已有参数时用） */
  dedupPush?: boolean
  /** 跳过无 renameTo 的 replace 规则（迁移合并已有参数时用，避免覆盖已存在选项） */
  skipPlainReplace?: boolean
}

/**
 * 将风格规则表应用到参数列表（按笔画名匹配）。
 * - 构建新参数：builder 模式（默认选项，push 直接追加、replace 全部生效）
 * - 合并已有参数：迁移模式（dedupPush + skipPlainReplace，只补不覆盖）
 */
export function applyFangYuanStyleRulesToParams(
  parameters: IParameter[],
  strokeName: string,
  options?: FangYuanStyleRuleApplyOptions,
): void {
  const { dedupPush = false, skipPlainReplace = false } = options || {}
  for (const rule of FANG_YUAN_STYLE_RULES) {
    if (!rule.glyphNames.includes(strokeName)) continue

    const param = parameters.find(p => p.name === rule.paramName)
    if (!param) continue

    if (rule.relabelFirst && param.options && param.options[0]) {
      param.options[0].label = rule.relabelFirst
    }

    if (rule.mode === 'push') {
      if (!param.options) param.options = []
      if (dedupPush) {
        pushOptionsIfNew(param.options, rule.options)
      } else {
        // 深拷贝：避免不同字形参数间共享 option 对象
        param.options.push(...rule.options.map(o => ({ ...o })))
      }
    } else {
      // replace 模式
      if (skipPlainReplace && !rule.renameTo) continue
      if (rule.renameTo) param.name = rule.renameTo
      param.options = rule.options.map(o => ({ ...o }))
    }

    if (rule.valueParamRename) {
      const valueParam = parameters.find(p => p.name === rule.valueParamRename!.from)
      if (valueParam) valueParam.name = rule.valueParamRename.to
    }
  }
}

/**
 * 将 canonical 参数合并进已有参数列表（迁移用）：
 * 缺失的参数补入；已存在的保留原值与范围，仅合并 Enum options（按 value 去重）。
 */
export function mergeCanonicalParamsIntoExisting(
  existing: IParameter[],
  canonical: IParameter[],
): void {
  for (const cp of canonical) {
    const ep = existing.find(p => p.name === cp.name)
    if (!ep) {
      existing.push({
        uuid: genUUID(),
        name: cp.name,
        type: cp.type,
        value: cp.value,
        min: cp.min,
        max: cp.max,
        options: cp.options ? cp.options.map(o => ({ ...o })) : undefined,
      })
      continue
    }
    if (cp.options && cp.options.length) {
      if (!ep.options) ep.options = []
      pushOptionsIfNew(ep.options, cp.options)
    }
  }
}

/**
 * 构建字玩方圆黑体笔画完整参数列表：
 * 基础参数 + 通用参数 + 风格规则表 + 按笔画类型的附加数值参数 + 字重比率与字重调整。
 */
export function buildFangYuanStrokeParameters(stroke: FangYuanStroke): IParameter[] {
  const { name } = stroke
  const parameters = paramsFromStroke(stroke)

  // 通用参数
  for (const def of FANG_YUAN_COMMON_PARAM_DEFS) {
    parameters.push({
      uuid: genUUID(),
      name: def.name,
      type: def.type,
      value: def.value,
      min: def.min,
      max: def.max,
      // 深拷贝：relabelFirst 等会原地修改 options 元素，避免污染共享定义
      options: def.options ? def.options.map(o => ({ ...o })) : undefined,
    })
  }

  // 按笔画类型的附加数值参数
  if (name === '横撇') {
    parameters.push({
      uuid: genUUID(),
      name: '撇-弯曲度',
      type: ParameterType.Number,
      value: 1.5,
      min: 1,
      max: 2,
    })
  } else if (name === '横折折撇') {
    parameters.push(
      {
        uuid: genUUID(),
        name: '折1-弯曲度',
        type: ParameterType.Number,
        value: 1.5,
        min: 1,
        max: 2,
      },
      {
        uuid: genUUID(),
        name: '撇-弯曲度',
        type: ParameterType.Number,
        value: 1.5,
        min: 1,
        max: 2,
      },
    )
  } else if (name === '弯钩') {
    parameters.push(
      {
        uuid: genUUID(),
        name: '弯1-水平延伸',
        type: ParameterType.Number,
        value: 200,
        min: 0,
        max: 1000,
      },
      {
        uuid: genUUID(),
        name: '弯1-竖直延伸',
        type: ParameterType.Number,
        value: 200,
        min: 0,
        max: 1000,
      },
      {
        uuid: genUUID(),
        name: '弯1-弯曲度',
        type: ParameterType.Number,
        value: 1.5,
        min: 1,
        max: 2,
      },
      {
        uuid: genUUID(),
        name: '弯2-水平延伸',
        type: ParameterType.Number,
        value: 200,
        min: 0,
        max: 1000,
      },
      {
        uuid: genUUID(),
        name: '弯2-竖直延伸',
        type: ParameterType.Number,
        value: 200,
        min: 0,
        max: 1000,
      },
      {
        uuid: genUUID(),
        name: '弯2-弯曲度',
        type: ParameterType.Number,
        value: 1.5,
        min: 1,
        max: 2,
      },
      {
        uuid: genUUID(),
        name: '字重',
        type: ParameterType.Number,
        value: 50,
        min: 0,
        max: 200,
      },
    )
  } else if (name === '横折弯钩') {
    const 折弯曲度 = parameters.find(p => p.name === '折-弯曲度')
    if (折弯曲度) {
      折弯曲度.value = 1.5
      折弯曲度.min = 1
      折弯曲度.max = 2
    }
  }

  // 风格规则表
  applyFangYuanStyleRulesToParams(parameters, name)

  // 字重比率
  parameters.push({
    uuid: genUUID(),
    name: '字重比率',
    type: ParameterType.Number,
    value: 1,
    min: 0.1,
    max: 2,
  })

  // 统一调整字重初始值 / 上限
  const 字重 = parameters.find(p => p.name === '字重')
  if (字重) {
    字重.value = 100
    字重.max = 200
  }

  return parameters
}
