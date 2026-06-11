/**
 * 模板菜单处理逻辑
 * 参考原工程 templatesHandlers，适配重构工程的 Store 与字形数据结构。
 * 不实现：导入模板、测试模板1(朴韵简隶)、字玩腾云体(test4)。
 */

import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import type { ICustomGlyph, IGlyphComponent, IParameter } from '@/core/types'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { instanceManager } from '@/core/instance/InstanceManager'
import { PictureImportPipelineService } from '@/features/editor/services/PictureImportPipelineService'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { ParameterType, EditStatus } from '@/core/types'
import { glyphSkeletonBindFromRefGlyph } from '@/features/glyphSkeletonBind'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { getBound } from '@/core/utils/math'
import { genUUID } from '@/utils/uuid'
import { hei_strokes, kai_strokes, li_strokes } from '@/templates/strokes_1'
import { lowercaseLetters } from '@/templates/lowercase_letters'
import { capitalLetters } from '@/templates/capital_letters'
import { digits } from '@/templates/digits'
import { symbols_en, symbols_zh } from '@/templates/symbols'
import { custom_strokes_1 } from '@/templates/custom_strokes_1'

const TEMPLATES_BASE = ''

function getScriptUrl(path: string): string {
  return TEMPLATES_BASE ? `${TEMPLATES_BASE}${path}` : path
}

function ensureStrokeGlyphs(file: any) {
  if (!file.stroke_glyphs) file.stroke_glyphs = []
}
function ensureGlyphs(file: any) {
  if (!file.glyphs) file.glyphs = []
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

function paramsFromStroke(stroke: { params: Array<{ name: string; default: number; min?: number; max?: number }> }): IParameter[] {
  const parameters: IParameter[] = []
  for (const param of stroke.params) {
    parameters.push({
      uuid: genUUID(),
      name: param.name,
      type: ParameterType.Number,
      value: param.default,
      min: param.min ?? 0,
      max: param.max === 0 ? 0 : (param.max ?? 1000),
    })
  }
  return parameters
}

function addRefPositionParam(parameters: IParameter[]) {
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
}
function addHeiStrokeExtraParams(parameters: IParameter[]) {
  addRefPositionParam(parameters)
  parameters.push(
    { uuid: genUUID(), name: '起笔风格', type: ParameterType.Enum, value: 2, options: [{ value: 0, label: '无起笔样式' }, { value: 1, label: '凸笔起笔' }, { value: 2, label: '凸笔圆角起笔' }] },
    { uuid: genUUID(), name: '起笔数值', type: ParameterType.Number, value: 1, min: 0, max: 2 },
    { uuid: genUUID(), name: '转角风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '默认转角样式' }, { value: 1, label: '转角圆滑凸起' }] },
    { uuid: genUUID(), name: '转角数值', type: ParameterType.Number, value: 1, min: 1, max: 2 },
    { uuid: genUUID(), name: '字重变化', type: ParameterType.Number, value: 0, min: 0, max: 2 },
    { uuid: genUUID(), name: '弯曲程度', type: ParameterType.Number, value: 1, min: 0, max: 2 },
  )
}
function strokesPublicBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`图片加载失败: ${url}`))
    img.src = url
  })
}

function appendPenComponentsToGlyph(glyph: ICustomGlyph, components: IGlyphComponent[]) {
  for (const c of components) {
    glyph.components.push(c)
    glyph.orderedList.push({ type: 'component', uuid: c.uuid })
  }
}

function handDrawnTemplateParameters(stroke: (typeof hei_strokes)[number]): IParameter[] {
  const parameters = paramsFromStroke(stroke)
  addRefPositionParam(parameters)
  parameters.push({
    uuid: genUUID(),
    name: '弯曲程度',
    type: ParameterType.Number,
    value: 1,
    min: 0,
    max: 2,
  })
  return parameters
}

function addKaiLiExtraParams(parameters: IParameter[], 字重Default: number) {
  addRefPositionParam(parameters)
  parameters.push(
    { uuid: genUUID(), name: '起笔风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '无起笔样式' }, { value: 1, label: '衬线起笔' }] },
    { uuid: genUUID(), name: '起笔数值', type: ParameterType.Number, value: 1, min: 1, max: 3 },
    { uuid: genUUID(), name: '收笔风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '无收笔样式' }, { value: 1, label: '衬线收笔' }] },
    { uuid: genUUID(), name: '收笔数值', type: ParameterType.Number, value: 1, min: 1, max: 3 },
    { uuid: genUUID(), name: '转角风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '默认转角样式' }, { value: 1, label: '衬线转角' }] },
    { uuid: genUUID(), name: '转角数值', type: ParameterType.Number, value: 1, min: 1, max: 3 },
    { uuid: genUUID(), name: '字重变化', type: ParameterType.Number, value: 0, min: 0, max: 2 },
    { uuid: genUUID(), name: '弯曲程度', type: ParameterType.Number, value: 1, min: 0, max: 2 },
  )
  const 字重 = parameters.find(p => p.name === '字重')
  if (字重) 字重.value = 字重Default
}

export async function importTemplate2(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)
  for (let i = 0; i < hei_strokes.length; i++) {
    const stroke = hei_strokes[i]
    const { name, params } = stroke
    const uuid = genUUID()
    const parameters = paramsFromStroke(stroke)
    addHeiStrokeExtraParams(parameters)
    const res = await fetch(getScriptUrl(`/templates/templates2/${name}.js`))
    const stroke_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩标准黑体',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${stroke_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.stroke_glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

export async function importTemplate3(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)

  const entries: { glyph: ICustomGlyph; name: string }[] = []
  for (let i = 0; i < hei_strokes.length; i++) {
    const stroke = hei_strokes[i]
    const { name } = stroke
    const glyph = createBaseGlyph(name, '测试手绘风格', '', [])
    file.stroke_glyphs!.push(glyph)
    entries.push({ glyph, name })
  }

  const base = strokesPublicBaseUrl()
  const total = entries.length
  projectStore.loading = true
  projectStore.loadingTotal = Math.max(1, total)
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = '正在导入测试手绘模板（识别轮廓与骨架绑定）…'

  try {
    for (let i = 0; i < entries.length; i++) {
      const { glyph, name } = entries[i]
      const url = `${base}strokes/${encodeURIComponent(name)}.png`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`无法加载笔画图: ${url} (${res.status})`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      try {
        const img = await loadImageFromUrl(objectUrl)
        const components = PictureImportPipelineService.traceHandDrawnImageToPenComponents(img)
        appendPenComponentsToGlyph(glyph, components)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }

      const strokeDef = hei_strokes.find(s => s.name === name)
      if (strokeDef) {
        glyph.parameters = handDrawnTemplateParameters(strokeDef)
      }
      glyph.skeleton = {
        type: name,
        ox: 0,
        oy: 0,
        dynamicWeight: false,
      }

      const strokeFn = strokeFnMap[name as keyof typeof strokeFnMap]
      if (strokeFn) {
        const inst = instanceManager.acquireTemporaryInstance(
          glyph.uuid,
          () => new CustomGlyph(glyph),
          'glyph',
        ) as CustomGlyph
        try {
          strokeFn.instanceBasicGlyph(glyph, inst)
          strokeFn.bindSkeletonGlyph(glyph)
          strokeFn.updateSkeletonListenerAfterBind(inst)
        } finally {
          instanceManager.releaseTemporaryInstance(glyph.uuid)
        }
      } else {
        console.warn(`[importTemplate3] strokeFnMap 中无笔画类型: ${name}`)
      }

      projectStore.loadingProgress = i + 1
    }
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }

  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

export async function importTemplate5(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)
  for (let i = 0; i < hei_strokes.length; i++) {
    const stroke = hei_strokes[i]
    const { name, params } = stroke
    const uuid = genUUID()
    const parameters = paramsFromStroke(stroke)
    parameters.push({ uuid: genUUID(), name: '竖横比', type: ParameterType.Number, value: 3, min: 1, max: 5 })
    addRefPositionParam(parameters)
    parameters.push(
      { uuid: genUUID(), name: '起笔风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '无起笔样式' }, { value: 1, label: '衬线起笔' }] },
      { uuid: genUUID(), name: '起笔数值', type: ParameterType.Number, value: 2, min: 1, max: 3 },
      { uuid: genUUID(), name: '收笔风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '无收笔样式' }, { value: 1, label: '衬线收笔' }] },
      { uuid: genUUID(), name: '收笔数值', type: ParameterType.Number, value: 2, min: 1, max: 3 },
      { uuid: genUUID(), name: '转角风格', type: ParameterType.Enum, value: 1, options: [{ value: 0, label: '默认转角样式' }, { value: 1, label: '衬线转角' }] },
      { uuid: genUUID(), name: '转角数值', type: ParameterType.Number, value: 2, min: 1, max: 3 },
      { uuid: genUUID(), name: '字重变化', type: ParameterType.Number, value: 0, min: 0, max: 2 },
      { uuid: genUUID(), name: '弯曲程度', type: ParameterType.Number, value: 1, min: 0, max: 2 },
    )
    const res = await fetch(getScriptUrl(`/templates/stroke_template_song/${name}.js`))
    const stroke_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩标准宋体',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${stroke_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.stroke_glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

export async function importTemplate6(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)
  for (let i = 0; i < kai_strokes.length; i++) {
    const stroke = kai_strokes[i]
    const { name, params } = stroke
    const uuid = genUUID()
    const parameters = paramsFromStroke(stroke)
    const 字重 = parameters.find(p => p.name === '字重')
    if (字重) 字重.value = 35
    addKaiLiExtraParams(parameters, 35)
    const res = await fetch(getScriptUrl(`/templates/stroke_template_fangsong/${name}.js`))
    const stroke_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩标准仿宋',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${stroke_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.stroke_glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

export async function importTemplate7(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)
  for (let i = 0; i < kai_strokes.length; i++) {
    const stroke = kai_strokes[i]
    const { name, params } = stroke
    const uuid = genUUID()
    const parameters = paramsFromStroke(stroke)
    const 字重 = parameters.find(p => p.name === '字重')
    if (字重) 字重.value = 60
    addKaiLiExtraParams(parameters, 60)
    const res = await fetch(getScriptUrl(`/templates/stroke_template_kai/${name}.js`))
    const stroke_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩标准楷体',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${stroke_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.stroke_glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

export async function importTemplate8(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)
  for (let i = 0; i < li_strokes.length; i++) {
    const stroke = li_strokes[i]
    const { name, params } = stroke
    const uuid = genUUID()
    const parameters = paramsFromStroke(stroke)
    const 字重 = parameters.find(p => p.name === '字重')
    if (字重) 字重.value = 35
    addKaiLiExtraParams(parameters, 35)
    const res = await fetch(getScriptUrl(`/templates/stroke_template_li/${name}.js`))
    const stroke_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩标准隶书',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${stroke_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.stroke_glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

function buildLetterOrDigitParams(
  item: { params: Array<{ name: string; default?: number; value?: number; min?: number; max?: number; type?: number; options?: any }>; globalParams?: Array<{ name: string; default?: number; value?: number; min?: number; max?: number; type?: number; options?: any }> },
): IParameter[] {
  const parameters: IParameter[] = []
  for (const param of item.params) {
    const def = param.default ?? (param as any).value
    parameters.push({
      uuid: genUUID(),
      name: param.name,
      type: ParameterType.Number,
      value: def,
      min: param.min ?? 0,
      max: param.max ?? 1000,
    })
  }
  if (item.globalParams) {
    for (const param of item.globalParams) {
      const def = param.default ?? (param as any).value
      if ((param as any).type === ParameterType.Enum) {
        parameters.push({
          uuid: genUUID(),
          name: param.name,
          type: ParameterType.Enum,
          value: def,
          options: (param as any).options,
        })
      } else {
        parameters.push({
          uuid: genUUID(),
          name: param.name,
          type: (param as any).type ?? ParameterType.Number,
          value: def,
          min: param.min ?? 0,
          max: param.max ?? 1000,
        })
      }
    }
  }
  return parameters
}

export async function importTemplateDigits(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureGlyphs(file)
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i]
    const { name } = digit
    const uuid = genUUID()
    const parameters = buildLetterOrDigitParams(digit)
    const res = await fetch(getScriptUrl(`/templates/digits/${name}.js`))
    const letter_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩数字模板',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${letter_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.GlyphList)
}

export async function importTemplateLetters(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureGlyphs(file)
  for (let i = 0; i < lowercaseLetters.length; i++) {
    const letter = lowercaseLetters[i]
    const { name } = letter
    const uuid = genUUID()
    const parameters = buildLetterOrDigitParams(letter)
    const res = await fetch(getScriptUrl(`/templates/lowercase_letters/${name}.js`))
    const letter_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩小写字母模板',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${letter_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.glyphs!.push(glyph)
  }
  for (let i = 0; i < capitalLetters.length; i++) {
    const letter = capitalLetters[i]
    const { name } = letter
    const uuid = genUUID()
    const parameters = buildLetterOrDigitParams(letter)
    const res = await fetch(getScriptUrl(`/templates/capital_letters/${name}.js`))
    const letter_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '字玩大写字母模板',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${letter_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.GlyphList)
}

export async function importTemplateSymbols(): Promise<void> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureGlyphs(file)
  for (let i = 0; i < symbols_en.length; i++) {
    const symbol = symbols_en[i]
    const uuid = genUUID()
    const parameters = buildLetterOrDigitParams(symbol)
    parameters.push(
      { uuid: genUUID(), name: '运笔样式', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '默认' }, { value: 1, label: '样式1' }] },
      { uuid: genUUID(), name: '运笔压力速率', type: ParameterType.Number, value: 1.0, min: 0, max: 2 },
    )
    const res = await fetch(getScriptUrl(`/templates/symbols_en/${symbol.script_file_name}`))
    const letter_script = await res.text()
    const glyph = createBaseGlyph(
      symbol.name,
      '字玩符号模板',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${letter_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.glyphs!.push(glyph)
  }
  for (let i = 0; i < symbols_zh.length; i++) {
    const symbol = symbols_zh[i]
    const uuid = genUUID()
    const parameters = buildLetterOrDigitParams(symbol)
    parameters.push(
      { uuid: genUUID(), name: '运笔样式', type: ParameterType.Enum, value: 0, options: [{ value: 0, label: '默认' }, { value: 1, label: '样式1' }] },
      { uuid: genUUID(), name: '运笔压力速率', type: ParameterType.Number, value: 1.0, min: 0, max: 10 },
    )
    const res = await fetch(getScriptUrl(`/templates/symbols_zh/${symbol.script_file_name}`))
    const letter_script = await res.text()
    const glyph = createBaseGlyph(
      symbol.name,
      '字玩符号模板',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${letter_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.glyphs!.push(glyph)
  }
  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.GlyphList)
}

export async function importTemplateTest(): Promise<void> {
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
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return
  ensureStrokeGlyphs(file)
  const strokes = custom_strokes_1
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i]
    const { name } = stroke
    const uuid = genUUID()

    // 基础参数：来自 custom_strokes_1（与原工程一致）
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

    // 按笔画类型补充/调整参数（完全对齐原工程）
    if (name === '横') {
    } else if (name === '撇' || name === '捺') {
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
      方头样式.name = '方头样式'
      if (方头样式 && 方头样式.options) {
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
      parameters.find(p => p.name === '转角数值').name = '方头数值'
      const 圆头样式 = parameters.find(p => p.name === '收笔风格')
      圆头样式.name = '圆头样式'
      if (圆头样式 && 圆头样式.options) {
        圆头样式.options = [
          { value: 0, label: '默认样式' },
          { value: 1, label: '圆切' },
          { value: 2, label: '斜切' },
          { value: 3, label: '圆切露锋' },
        ]
      }
      parameters.find(p => p.name === '收笔数值').name = '圆头数值'
    }
    if (钩收笔.includes(name)) {
      const 收笔风格 = parameters.find(p => p.name === '收笔风格')
      if (收笔风格 && 收笔风格.options) {
        收笔风格.options.push(...[
          { value: 3, label: '圆切' },
          { value: 4, label: '斜切' },
          { value: 5, label: '圆切露锋' },
        ])
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

    // 统一调整字重初始值 / 上限
    const 字重 = parameters.find(p => p.name === '字重')
    if (字重) {
      字重.value = 100
      字重.max = 200
    }

    const res = await fetch(getScriptUrl(`/templates/custom_1/${name}.js`))
    const stroke_script = await res.text()
    const glyph = createBaseGlyph(
      name,
      '测试笔画模板',
      `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t${stroke_script}\n}`,
      parameters,
    )
    glyph.uuid = uuid
    file.stroke_glyphs!.push(glyph)
  }
  // ===== 识别 shapes 图片，生成"测试笔画模板1"字形骨架绑定 =====
  const hasFangYuan = file.stroke_glyphs!.some((g: any) => g.style === '字玩方圆黑体')
  const refStyleTag = hasFangYuan ? '字玩方圆黑体' : '测试笔画模板'
  if (hasFangYuan) {
    file.stroke_glyphs = file.stroke_glyphs!.filter((g: any) => g.style !== '测试笔画模板')
  }

  const shapeNames = strokes.map((s: any) => s.name)
  const shapeTotal = shapeNames.length
  projectStore.loading = true
  projectStore.loadingTotal = Math.max(1, shapeTotal)
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = '正在识别笔画图形并绑定骨架…'

  try {
    for (let i = 0; i < shapeNames.length; i++) {
      const name = shapeNames[i]
      const shapeUrl = getScriptUrl(`/templates/custom_1/shapes/${encodeURIComponent(name)}.png`)
      let img: HTMLImageElement
      try {
        const shapeRes = await fetch(shapeUrl)
        if (!shapeRes.ok) { projectStore.loadingProgress = i + 1; continue }
        const blob = await shapeRes.blob()
        const objectUrl = URL.createObjectURL(blob)
        try { img = await loadImageFromUrl(objectUrl) }
        finally { URL.revokeObjectURL(objectUrl) }
      } catch { projectStore.loadingProgress = i + 1; continue }

      let allComponents: IGlyphComponent[]
      try {
        allComponents = PictureImportPipelineService.traceHandDrawnImageToPenComponents(img, {
          maxError: 5,        // 贝塞尔拟合误差，越小越平滑（UI 中对应"平滑"滑块）
          dropThreshold: 4,   // 过滤点数过少的轮廓
          minPolylineLength: 200, // 最小轮廓折线总长
        })
      }
      catch { projectStore.loadingProgress = i + 1; continue }
      if (!allComponents.length) { projectStore.loadingProgress = i + 1; continue }

      let mainComp = allComponents[0]
      let maxArea = 0
      for (const c of allComponents) {
        if (c.type !== 'pen') continue
        const pts = (c.value as any)?.points
        if (!pts?.length) continue
        const b = getBound(pts)
        const area = b.w * b.h
        if (area > maxArea) { maxArea = area; mainComp = c }
      }

      const newUuid = genUUID()
      const refGlyph = file.stroke_glyphs!.find((g: any) => g.style === refStyleTag && g.name === name)
      if (!refGlyph) { projectStore.loadingProgress = i + 1; continue }

      const newParams: IParameter[] = JSON.parse(JSON.stringify(refGlyph.parameters || []))
      const refScript = refGlyph.script || ''
      const adaptedScript = refScript.replace(
        new RegExp(`script_${refGlyph.uuid.replaceAll('-', '_')}`, 'g'),
        `script_${newUuid.replaceAll('-', '_')}`
      )

      const newGlyph: ICustomGlyph = {
        uuid: newUuid, name, type: 'system',
        components: [{ ...mainComp } as any],
        groups: [], orderedList: [{ type: 'component', uuid: mainComp.uuid }],
        selectedComponentsUUIDs: [],
        view: { zoom: 100, translateX: 0, translateY: 0 },
        parameters: newParams, joints: [], script: '',
        style: '测试笔画模板1',
        skeleton: {
          type: 'glyphSkeleton', ox: 0, oy: 0,
          referenceGlyphUUID: refGlyph.uuid,
          referenceGlyphData: {
            name: refGlyph.name,
            parameters: JSON.parse(JSON.stringify(newParams)),
            script: refScript, adaptedScript,
          },
          boneSegmentsPerRefLine: 5,
        },
      }

      const savedScript = newGlyph.script
      newGlyph.script = adaptedScript
      newGlyph.script_reference = undefined
      try { executeGlyphScript(newGlyph, newUuid, { ignoreTempDataGuard: true }) }
      finally { newGlyph.script = savedScript }

      const inst = instanceManager.acquireTemporaryInstance(
        newUuid, () => new CustomGlyph(newGlyph), 'glyph',
      ) as unknown as CustomGlyph
      try {
        inst._components = []
        const bindRefData = (newGlyph.skeleton as any).referenceGlyphData
        if (bindRefData) { glyphSkeletonBindFromRefGlyph(inst as any, bindRefData, 5) }
      } finally { instanceManager.releaseTemporaryInstance(newUuid) }

      file.stroke_glyphs!.push(newGlyph)
      projectStore.loadingProgress = i + 1
    }
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }

  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
}

export const templateHandlers: Record<string, () => Promise<void>> = {
  'template-2': importTemplate2,
  'template-3': importTemplate3,
  'template-5': importTemplate5,
  'template-6': importTemplate6,
  'template-7': importTemplate7,
  'template-8': importTemplate8,
  'template-digits': importTemplateDigits,
  'template-letters': importTemplateLetters,
  'template-symbols': importTemplateSymbols,
  'template-test': importTemplateTest,
}
