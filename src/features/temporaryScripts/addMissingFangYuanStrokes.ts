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
  parameters.push({ uuid: genUUID(), name: '参考位置', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '默认' }, { value: 1, label: '右侧（上侧）' }, { value: 2, label: '左侧（下侧）' }] })

  // 通用参数
  parameters.push(
    { uuid: genUUID(), name: '起笔风格', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '无起笔样式' }] },
    { uuid: genUUID(), name: '起笔数值', type: ParameterType.Number, value: 1, min: 0, max: 2 },
    { uuid: genUUID(), name: '转角风格', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '方角' }, { value: 1, label: '圆角' }] },
    { uuid: genUUID(), name: '转角数值', type: ParameterType.Number, value: 1.5, min: 1, max: 2 },
    { uuid: genUUID(), name: '收笔风格', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '无收笔样式' }] },
    { uuid: genUUID(), name: '收笔数值', type: ParameterType.Number, value: 2, min: 1, max: 3 },
    { uuid: genUUID(), name: '运笔风格', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '默认运笔样式' }, { value: 1, label: '提笔变细-圆角' }, { value: 2, label: '提笔变细-斜角' }] },
    { uuid: genUUID(), name: '运笔数值', type: ParameterType.Number, value: 1, min: 1, max: 2 },
    { uuid: genUUID(), name: '字重变化', type: ParameterType.Number, value: 0, min: 0, max: 2 },
    { uuid: genUUID(), name: '弯曲程度', type: ParameterType.Number, value: 0, min: 0, max: 3 },
  )

  // 横起笔扩展选项
  if (横起笔.includes(name)) {
    const qb = parameters.find(p => p.name === '起笔风格')!
    qb.options = [
      ...qb.options as Array<{ value: number; label: string }>,
      { value: 1, label: '翘笔起笔' }, { value: 2, label: '翘笔圆角起笔' },
      { value: 3, label: '翘笔长起笔' }, { value: 4, label: '翘笔长圆角起笔' },
      { value: 5, label: '直起笔' }, { value: 6, label: '轻微翘笔起笔' },
      { value: 7, label: '轻微翘笔圆角起笔' },
    ]
  }
  if (转角.includes(name)) {
    const zj = parameters.find(p => p.name === '转角风格')!
    zj.options = [...zj.options as Array<{ value: number; label: string }>, { value: 2, label: '直转角' }, { value: 3, label: '右扩展转角' }]
  }
  if (竖起笔.includes(name)) {
    const qb = parameters.find(p => p.name === '起笔风格')!
    qb.options = [
      ...qb.options as Array<{ value: number; label: string }>,
      { value: 1, label: '侧凸起笔' }, { value: 2, label: '侧凸圆角起笔' },
      { value: 3, label: '侧凸长起笔' }, { value: 4, label: '侧凸长圆角起笔' },
      { value: 5, label: '直起笔' },
    ]
  }
  if (竖收笔.includes(name)) {
    const sb = parameters.find(p => p.name === '收笔风格')!
    sb.options = [
      ...sb.options as Array<{ value: number; label: string }>,
      { value: 1, label: '翘笔收笔' }, { value: 2, label: '翘笔圆角收笔' },
    ]
  }
  if (横收笔.includes(name)) {
    const sb = parameters.find(p => p.name === '收笔风格')!
    sb.options = [
      ...sb.options as Array<{ value: number; label: string }>,
      { value: 1, label: '侧凸收笔' }, { value: 2, label: '侧凸圆角收笔' },
      { value: 3, label: '侧凸长收笔' }, { value: 4, label: '侧凸长圆角收笔' },
      { value: 5, label: '下沉收笔' },
    ]
  }

  // 撇/捺专有参数
  if (name === '撇' || name === '捺') {
    const qb = parameters.find(p => p.name === '起笔风格')!
    qb.options = [
      ...qb.options as Array<{ value: number; label: string }>,
      { value: 8, label: '尖头' }, { value: 9, label: '水平方头' }, { value: 10, label: '竖直方头' },
    ]
    const sb = parameters.find(p => p.name === '收笔风格')!
    sb.options = [
      ...sb.options as Array<{ value: number; label: string }>,
      { value: 6, label: '尖头' }, { value: 7, label: '水平方头' }, { value: 8, label: '竖直方头' },
    ]
  }
  if (name === '横撇') {
    parameters.push({ uuid: genUUID(), name: '撇-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 2 })
  }
  if (横起笔.includes(name) && name !== '横') {
    const qb = parameters.find(p => p.name === '起笔风格')!
    qb.options = [
      ...qb.options as Array<{ value: number; label: string }>,
      { value: 1, label: '翘笔起笔' }, { value: 2, label: '翘笔圆角起笔' },
    ]
  }

  // 钩收笔
  if (钩收笔.includes(name)) {
    const sb = parameters.find(p => p.name === '收笔风格')!
    sb.options = [
      ...sb.options as Array<{ value: number; label: string }>,
      { value: 3, label: '前弯钩' }, { value: 4, label: '前弯圆角钩' },
      { value: 5, label: '后弯钩' }, { value: 6, label: '后弯圆角钩' },
      { value: 7, label: '斜钩' }, { value: 8, label: '斜圆角钩' },
    ]
  }

  // 直角撇/捺/倒直角撇
  if (直角撇起笔.concat(直角捺起笔).includes(name)) {
    const qb = parameters.find(p => p.name === '起笔风格')!
    qb.options = [...qb.options as Array<{ value: number; label: string }>, { value: 8, label: '尖头' }]
  }
  if (直角撇收笔.concat(直角捺收笔).includes(name) && name !== '横撇') {
    const sb = parameters.find(p => p.name === '收笔风格')!
    sb.options = [...sb.options as Array<{ value: number; label: string }>, { value: 6, label: '尖头' }]
  }

  // 竖挑
  if (name === '竖挑') {
    const sb = parameters.find(p => p.name === '收笔风格')!
    sb.options = [...sb.options as Array<{ value: number; label: string }>, { value: 9, label: '翘笔收笔' }, { value: 10, label: '翘笔圆角收笔' }]
  }

  // 横折弯钩
  if (name === '横折弯钩') {
    const zd = parameters.find(p => p.name === '弯曲程度')!
    zd.min = 1; zd.value = 1; zd.max = 2
  }

  // 横折折撇
  if (name === '横折折撇') {
    parameters.push(
      { uuid: genUUID(), name: '折1-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 3 },
      { uuid: genUUID(), name: '撇-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 3 },
    )
  }

  // 弯钩
  if (name === '弯钩') {
    parameters.push(
      { uuid: genUUID(), name: '右弯-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '弯度起点', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '弯度起点衰减', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '左凸-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '右凸-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '底点-弯曲度', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '圆度', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '字重', type: ParameterType.Number, value: 0, min: 0, max: 2 },
    )
  }

  // 字重比率
  parameters.push({ uuid: genUUID(), name: '字重比率', type: ParameterType.Number, value: 1.0, min: 0, max: 1 })

  // 调整字重默认值
  const 字重 = parameters.find(p => p.name === '字重')
  if (字重) { 字重.value = 100; 字重.max = 200 }

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
