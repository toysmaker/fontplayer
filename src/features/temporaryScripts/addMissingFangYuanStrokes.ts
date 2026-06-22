/**
 * 临时代码：打开 tag 为"字玩方圆黑体"的工程时，自动补全 stroke_glyphs 中缺失的笔画字形。
 * 仅 dev 模式生效。后续需整段移除。
 */
import type { ICustomGlyph, IParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { strokes } from '@/templates/private/v1/strokes'

function paramsFromStroke(stroke: { params: Array<{ name: string; default: number; min?: number; max?: number }> }): IParameter[] {
  return stroke.params.map(param => ({
    uuid: genUUID(),
    name: param.name,
    type: ParameterType.Number,
    value: param.default,
    min: param.min ?? 0,
    max: param.max === 0 ? 0 : (param.max ?? 1000),
  }))
}

function createBaseGlyph(name: string, style: string, script: string, parameters: IParameter[]): ICustomGlyph {
  return {
    uuid: genUUID(),
    name,
    type: 'system',
    components: [],
    groups: [],
    orderedList: [],
    selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters,
    joints: [],
    script,
    style,
  }
}

const 横起笔 = ['横', '横钩', '横撇', '横撇弯钩', '横弯钩', '横折', '横折2', '横折钩', '横折弯', '横折弯钩', '横折折撇', '横折折弯钩', '二横折']
const 转角 = ['横折', '横折2', '横折钩', '横折挑', '横折折弯钩', '竖折', '竖折折钩', '二横折', '横弯钩']
const 竖起笔 = ['竖', '竖钩', '竖挑', '竖弯', '竖弯钩', '竖折', '竖折折钩', '直竖撇', '直竖捺']
const 竖收笔 = ['竖', '横折', '横折2', '二横折']
const 横收笔 = ['横', '竖折']
const 直角撇起笔 = ['直角撇', '倒直角撇']
const 直角撇收笔 = ['直角撇', '横撇', '倒直角撇']
const 直角捺起笔 = ['直角捺']
const 直角捺收笔 = ['直角捺']
const 钩收笔 = ['横弯钩', '横折钩', '横折弯钩', '横折折弯钩', '竖钩', '竖弯钩', '竖折折钩']

function buildParametersForStroke(stroke: { name: string; params: Array<{ name: string; default: number; min?: number; max?: number }> }): IParameter[] {
  const { name } = stroke
  const parameters = paramsFromStroke(stroke)

  // 参考位置
  parameters.push({
    uuid: genUUID(),
    name: '参考位置',
    type: ParameterType.Enum,
    value: 0,
    options: [
      { value: 0, label: '默认' },
      { value: 1, label: '右侧（上侧）' },
      { value: 2, label: '左侧（下侧）' },
    ],
  })

  // 起笔 / 收笔 / 运笔通用参数
  parameters.push(
    {
      uuid: genUUID(),
      name: '起笔风格',
      type: ParameterType.Enum,
      value: 0,
      options: [{ value: 0, label: '无起笔样式' }],
    },
    {
      uuid: genUUID(),
      name: '起笔数值',
      type: ParameterType.Number,
      value: 1,
      min: 0,
      max: 2,
    },
    {
      uuid: genUUID(),
      name: '转角风格',
      type: ParameterType.Enum,
      value: 0,
      options: [
        { value: 0, label: '方角' },
        { value: 1, label: '圆角' },
      ],
    },
    {
      uuid: genUUID(),
      name: '转角数值',
      type: ParameterType.Number,
      value: 1.5,
      min: 1,
      max: 2,
    },
    {
      uuid: genUUID(),
      name: '收笔风格',
      type: ParameterType.Enum,
      value: 0,
      options: [{ value: 0, label: '无收笔样式' }],
    },
    {
      uuid: genUUID(),
      name: '收笔数值',
      type: ParameterType.Number,
      value: 2,
      min: 1,
      max: 3,
    },
    {
      uuid: genUUID(),
      name: '运笔风格',
      type: ParameterType.Enum,
      value: 0,
      options: [
        { value: 0, label: '默认运笔样式' },
        { value: 1, label: '提笔变细-圆角' },
        { value: 2, label: '提笔变细-斜角' },
      ],
    },
    {
      uuid: genUUID(),
      name: '运笔数值',
      type: ParameterType.Number,
      value: 1,
      min: 1,
      max: 2,
    },
    {
      uuid: genUUID(),
      name: '字重变化',
      type: ParameterType.Number,
      value: 0,
      min: 0,
      max: 2,
    },
    {
      uuid: genUUID(),
      name: '弯曲程度',
      type: ParameterType.Number,
      value: 1,
      min: 0,
      max: 2,
    },
  )

  // 按笔画类型补充/调整参数（与 importTemplateTest 完全对齐）
  if (name === '横') {
    // 横无需额外处理
  } else if (name === '撇' || name === '捺' || name === '点') {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    起笔风格?.options.push(
      { value: 1, label: '水平方头' },
      { value: 2, label: '竖直方头' },
      { value: 3, label: '尖头' },
    )
    收笔风格?.options.push(
      { value: 1, label: '水平方头' },
      { value: 2, label: '竖直方头' },
      { value: 3, label: '尖头' },
    )
  } else if (name === '横撇') {
    parameters.push({
      uuid: genUUID(),
      name: '撇-弯曲度',
      type: ParameterType.Number,
      value: 1.5,
      min: 1,
      max: 2,
    })
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    收笔风格?.options.push(
      { value: 1, label: '竖直方头' },
      { value: 2, label: '尖头' },
    )
  } else if (name.includes('钩')) {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格) {
      if (name === '横钩') {
        收笔风格.options = [
          { value: 0, label: '左单圆角收笔' },
          { value: 1, label: '右单圆角收笔' },
        ]
      } else if (name === '横弯钩') {
        收笔风格.options = [
          { value: 0, label: '单圆角收笔' },
          { value: 1, label: '燕尾收笔' },
          { value: 2, label: '直捺收笔' },
        ]
      } else if (name === '竖弯钩') {
        收笔风格.options = [
          { value: 0, label: '单圆角收笔' },
          { value: 1, label: '燕尾收笔' },
        ]
      } else {
        收笔风格.options = [
          { value: 0, label: '单圆角收笔' },
        ]
      }
    }
  } else if (name.includes('单圆角部件')) {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    if (起笔风格 && 起笔风格.options && 起笔风格.options[0]) {
      起笔风格.options[0].label = '左上方圆角'
      起笔风格.options.push(
        { value: 1, label: '左下方圆角' },
        { value: 2, label: '右上方圆角' },
        { value: 3, label: '右下方圆角' },
      )
    }
  } else if (name === '直角撇' || name === '直角捺' || name === '倒直角撇') {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    收笔风格?.options.push({ value: 1, label: '尖头' })
    起笔风格?.options.push({ value: 1, label: '尖头' })
  } else if (name === '竖挑') {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格) {
      收笔风格.options = [
        { value: 0, label: '单圆角收笔' },
        { value: 1, label: '方头收笔' },
      ]
    }
  }

  // 特殊参数补充
  if (name === '横折弯钩') {
    const 折弯曲度 = parameters.find(p => p.name === '折-弯曲度')
    if (折弯曲度) {
      折弯曲度.value = 1.5
      折弯曲度.min = 1
      折弯曲度.max = 2
    }
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
  }

  // 方圆黑体风格枚举选项扩展
  if (横起笔.includes(name)) {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    if (起笔风格 && 起笔风格.options) {
      起笔风格.options.push(
        { value: 1, label: '圆切-上' },
        { value: 2, label: '圆切-下' },
        { value: 3, label: '斜切-上' },
        { value: 4, label: '斜切-下' },
        { value: 5, label: '圆切-圆弧装饰-上' },
        { value: 6, label: '圆切-圆弧装饰-下' },
        { value: 7, label: '圆切-棱角装饰-上' },
        { value: 8, label: '圆切-棱角装饰-下' },
      )
    }
  }
  if (转角.includes(name)) {
    const 转角风格 = parameters.find(p => p.name === '转角风格')
    if (转角风格 && 转角风格.options) {
      转角风格.options.push(
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
      )
    }
  }
  if (竖起笔.includes(name)) {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    if (起笔风格 && 起笔风格.options) {
      起笔风格.options.push(
        { value: 1, label: '圆切-左' },
        { value: 2, label: '圆切-右' },
        { value: 3, label: '斜切-左' },
        { value: 4, label: '斜切-右' },
        { value: 5, label: '圆切-圆弧装饰-左' },
        { value: 6, label: '圆切-圆弧装饰-右' },
        { value: 7, label: '圆切-棱角装饰-左' },
        { value: 8, label: '圆切-棱角装饰-右' },
      )
    }
  }
  if (竖收笔.includes(name)) {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格 && 收笔风格.options) {
      收笔风格.options.push(
        { value: 1, label: '圆切-左' },
        { value: 2, label: '圆切-右' },
        { value: 3, label: '斜切-左' },
        { value: 4, label: '斜切-右' },
        { value: 5, label: '圆切-圆弧装饰-左' },
        { value: 6, label: '圆切-圆弧装饰-右' },
        { value: 7, label: '圆切-棱角装饰-左' },
        { value: 8, label: '圆切-棱角装饰-右' },
      )
    }
  }
  if (横收笔.includes(name)) {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格 && 收笔风格.options) {
      收笔风格.options.push(
        { value: 1, label: '燕尾收笔' },
        { value: 2, label: '圆切-上' },
        { value: 3, label: '圆切-下' },
        { value: 4, label: '斜切-上' },
        { value: 5, label: '斜切-下' },
        { value: 6, label: '圆切-圆弧装饰-上' },
        { value: 7, label: '圆切-圆弧装饰-下' },
        { value: 8, label: '圆切-棱角装饰-上' },
        { value: 9, label: '圆切-棱角装饰-下' },
      )
    }
  }
  if (直角撇起笔.includes(name)) {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    if (起笔风格 && 起笔风格.options) {
      起笔风格.options.push(
        { value: 2, label: '圆切-左' },
        { value: 3, label: '圆切-右' },
        { value: 4, label: '斜切-左' },
        { value: 5, label: '斜切-右' },
        { value: 6, label: '圆切-圆弧装饰-左' },
        { value: 7, label: '圆切-圆弧装饰-右' },
        { value: 8, label: '圆切-棱角装饰-左' },
        { value: 9, label: '圆切-棱角装饰-右' },
      )
    }
  }
  if (直角捺起笔.includes(name)) {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    if (起笔风格 && 起笔风格.options) {
      起笔风格.options.push(
        { value: 2, label: '圆切-左' },
        { value: 3, label: '圆切-右' },
        { value: 4, label: '斜切-左' },
        { value: 5, label: '斜切-右' },
        { value: 6, label: '圆切-圆弧装饰-左' },
        { value: 7, label: '圆切-圆弧装饰-右' },
        { value: 8, label: '圆切-棱角装饰-左' },
        { value: 9, label: '圆切-棱角装饰-右' },
      )
    }
  }
  if (直角撇收笔.includes(name)) {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格 && 收笔风格.options) {
      收笔风格.options.push(
        { value: 2, label: '圆切-上' },
        { value: 3, label: '圆切-下' },
        { value: 4, label: '斜切-上' },
        { value: 5, label: '斜切-下' },
        { value: 6, label: '厚重露锋' },
        { value: 7, label: '厚重露锋-圆切-上' },
        { value: 8, label: '厚重露锋-圆切-下' },
        { value: 9, label: '厚重露锋-斜切-上' },
        { value: 10, label: '厚重露锋-斜切-下' },
      )
    }
  }
  if (直角捺收笔.includes(name)) {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格 && 收笔风格.options) {
      收笔风格.options.push(
        { value: 2, label: '圆切-上' },
        { value: 3, label: '圆切-下' },
        { value: 4, label: '斜切-上' },
        { value: 5, label: '斜切-下' },
        { value: 6, label: '厚重露锋' },
        { value: 7, label: '厚重露锋-圆切-上' },
        { value: 8, label: '厚重露锋-圆切-下' },
        { value: 9, label: '厚重露锋-斜切-上' },
        { value: 10, label: '厚重露锋-斜切-下' },
      )
    }
  }
  if (name === '竖直单圆角部件' || name === '水平单圆角部件') {
    const 方头样式 = parameters.find(p => p.name === '转角风格')
    if (方头样式) {
      方头样式.name = '方头样式'
      if (方头样式.options) {
        方头样式.options = [
          { value: 0, label: '默认样式' },
          { value: 1, label: '圆切-外' },
          { value: 2, label: '圆切-内' },
          { value: 3, label: '斜切-外' },
          { value: 4, label: '斜切-内' },
          { value: 5, label: '圆切-圆弧装饰-外' },
          { value: 6, label: '圆切-圆弧装饰-内' },
          { value: 7, label: '圆切-棱角装饰-外' },
          { value: 8, label: '圆切-棱角装饰-内' },
        ]
      }
    }
    const 方头数值 = parameters.find(p => p.name === '转角数值')
    if (方头数值) 方头数值.name = '方头数值'
    const 圆头样式 = parameters.find(p => p.name === '收笔风格')
    if (圆头样式) {
      圆头样式.name = '圆头样式'
      if (圆头样式.options) {
        圆头样式.options = [
          { value: 0, label: '默认样式' },
          { value: 1, label: '圆切' },
          { value: 2, label: '斜切' },
          { value: 3, label: '圆切露锋' },
        ]
      }
    }
    const 圆头数值 = parameters.find(p => p.name === '收笔数值')
    if (圆头数值) 圆头数值.name = '圆头数值'
  }
  if (钩收笔.includes(name)) {
    const 收笔风格 = parameters.find(p => p.name === '收笔风格')
    if (收笔风格 && 收笔风格.options) {
      收笔风格.options.push(
        { value: 3, label: '圆切' },
        { value: 4, label: '斜切' },
        { value: 5, label: '圆切露锋' },
      )
    }
  }
  if (name === '倒直角撇') {
    const 起笔风格 = parameters.find(p => p.name === '起笔风格')
    if (起笔风格 && 起笔风格.options) {
      起笔风格.options.push({ value: 10, label: '厚重露锋' })
    }
  }

  // 字重比率
  parameters.push({
    uuid: genUUID(),
    name: '字重比率',
    type: ParameterType.Number,
    value: 1,
    min: 0.1,
    max: 2,
  })

  // 调整字重默认值
  const 字重 = parameters.find(p => p.name === '字重')
  if (字重) {
    字重.value = 100
    字重.max = 200
  }

  return parameters
}

function getScriptUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const nb = base.endsWith('/') ? base : `${base}/`
  return `${nb}templates/private/v1/${encodeURIComponent(path.split('/').pop()!)}`
}

/**
 * 补全工程中缺失的"字玩方圆黑体"笔画字形。
 * 仅在 dev 模式下可用。
 */
export async function addMissingFangYuanStrokes(
  strokeGlyphs: ICustomGlyph[] | undefined,
  onProgress?: (msg: string) => void,
): Promise<ICustomGlyph[]> {
  if (!import.meta.env.DEV) return strokeGlyphs || []

  const glyphs = [...(strokeGlyphs || [])]
  const existingNames = new Set(
    glyphs.filter(g => g.style === '字玩方圆黑体').map(g => g.name),
  )

  const missing = strokes.filter(s => !existingNames.has(s.name))
  if (missing.length === 0) return glyphs

  if (import.meta.env.DEV) {
    console.log(`[addMissingFangYuanStrokes] 缺少 ${missing.length} 个笔画: ${missing.map(s => s.name).join(', ')}`)
  }

  for (const stroke of missing) {
    const { name } = stroke
    onProgress?.(`补全笔画: ${name}`)

    try {
      const url = getScriptUrl(`/templates/private/v1/${name}.js`)
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[addMissingFangYuanStrokes] 脚本获取失败: ${name} (${res.status})`)
        continue
      }
      const strokeScript = await res.text()
      const uuid = genUUID()
      const parameters = buildParametersForStroke(stroke)
      const scriptFnName = `script_${uuid.replaceAll('-', '_')}`
      const script = `function ${scriptFnName}(glyph, constants, FP) {\n\t${strokeScript}\n}`

      const glyph = createBaseGlyph(name, '字玩方圆黑体', script, parameters)
      glyph.uuid = uuid
      glyphs.push(glyph)

      if (import.meta.env.DEV) {
        console.log(`[addMissingFangYuanStrokes] 已添加: ${name}`)
      }
    } catch (e) {
      console.error(`[addMissingFangYuanStrokes] 添加笔画失败: ${name}`, e)
    }
  }

  return glyphs
}
