import type { IComponent, ICustomGlyph, IGlyphComponent, IParameter } from '@/core/types'
import { strokes } from '@/templates/private/v1/strokes'
import {
  applyFangYuanStyleRulesToParams,
  buildFangYuanStrokeParameters,
  mergeCanonicalParamsIntoExisting,
} from '@/templates/private/v1/strokeParamBuilder'
import { ParameterType } from '@/core/types'

const templateBodyCache = new Map<string, string>()
/** private/v1 与 templates2 分离缓存，避免同名笔画互相污染 */
const custom1TemplateBodyCache = new Map<string, string>()

function strokeTemplateUrl(strokeName: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const file = `${strokeName}.js`
  return `${normalizedBase}templates/templates2/${encodeURIComponent(file)}`
}

async function fetchStrokeTemplateBody(strokeName: string): Promise<string | null> {
  const cached = templateBodyCache.get(strokeName)
  if (cached !== undefined) return cached.length > 0 ? cached : null

  if (typeof fetch !== 'function') {
    console.warn('[replaceGlyphScript] fetch unavailable, skip template:', strokeName)
    templateBodyCache.set(strokeName, '')
    return null
  }

  const url = strokeTemplateUrl(strokeName)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[replaceGlyphScript] template not found:', strokeName, res.status, url)
      templateBodyCache.set(strokeName, '')
      return null
    }
    const text = (await res.text()).replace(/\r\n/g, '\n').trimEnd()
    templateBodyCache.set(strokeName, text)
    return text
  } catch (e) {
    console.warn('[replaceGlyphScript] fetch failed:', strokeName, e)
    templateBodyCache.set(strokeName, '')
    return null
  }
}

/** 跳过行注释、块注释、引号与反引号串，避免花括号误匹配 */
function skipNonCode(s: string, i: number): number {
  if (i >= s.length) return i
  if (s[i] === '/' && s[i + 1] === '/') {
    i += 2
    while (i < s.length && s[i] !== '\n') i++
    return i
  }
  if (s[i] === '/' && s[i + 1] === '*') {
    i += 2
    while (i + 1 < s.length) {
      if (s[i] === '*' && s[i + 1] === '/') return i + 2
      i++
    }
    return i
  }
  const q = s[i]
  if (q === '"' || q === "'") {
    i++
    while (i < s.length) {
      if (s[i] === '\\') {
        i += 2
        continue
      }
      if (s[i] === q) return i + 1
      i++
    }
    return i
  }
  if (q === '`') {
    i++
    while (i < s.length) {
      if (s[i] === '\\') {
        i += 2
        continue
      }
      if (s[i] === '`') return i + 1
      if (s[i] === '$' && s[i + 1] === '{') {
        i += 2
        let depth = 1
        while (i < s.length && depth > 0) {
          const j = skipNonCode(s, i)
          if (j > i) {
            i = j
            continue
          }
          const c = s[i]
          if (c === '{') depth++
          else if (c === '}') depth--
          i++
        }
        continue
      }
      i++
    }
    return i
  }
  return i
}

/**
 * 保留从 `function script_…` 到开括号 `{` 的整段（含 `{`），将函数体内替换为 newBody，闭包为单个 `}`。
 */
function replaceScriptBodyKeepingHeader(fullScript: string, newBody: string): string | null {
  const s = fullScript.trim()
  const fnIdx = s.indexOf('function script_')
  if (fnIdx === -1) return null

  const openParen = s.indexOf('(', fnIdx)
  const closeParen = s.indexOf(')', openParen)
  if (openParen === -1 || closeParen === -1) return null

  const openBrace = s.indexOf('{', closeParen)
  if (openBrace === -1) return null

  let depth = 1
  let k = openBrace + 1
  while (k < s.length && depth > 0) {
    const j = skipNonCode(s, k)
    if (j > k) {
      k = j
      continue
    }
    const c = s[k]
    if (c === '{') depth++
    else if (c === '}') depth--
    k++
  }
  if (depth !== 0) return null

  const header = s.slice(fnIdx, openBrace + 1)
  const indentBody = newBody
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((line) => (line.length ? `\t${line}` : line))
    .join('\n')
  return `${header}\n${indentBody}\n}`
}

function wrapTemplateBodyForGlyph(glyph: ICustomGlyph, templateBody: string): string {
  const fn = `script_${glyph.uuid.replaceAll('-', '_')}`
  const indentBody = templateBody
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((line) => (line.length ? `\t${line}` : line))
    .join('\n')
  return `function ${fn} (glyph, constants, FP) {\n${indentBody}\n}`
}

/**
 * 将笔画列表（stroke_glyphs）中每个字形的内联 script 函数体替换为 public/templates/templates2 下同名 .js 内容，
 * 保留原 `function script_<uuid>(…)` 函数名与参数列表不变。
 * 若无内联 script（仅有 script_reference），则写入带当前 uuid 的标准外壳并清除 script_reference。
 */
export async function replaceGlyphScript(glyphs: ICustomGlyph[]): Promise<void> {
  for (const glyph of glyphs) {
    const name = glyph.name?.trim()
    if (!name) continue

    const templateBody = await fetchStrokeTemplateBody(name)
    if (!templateBody) continue

    const existing = typeof glyph.script === 'string' ? glyph.script.trim() : ''
    if (existing) {
      const next = replaceScriptBodyKeepingHeader(existing, templateBody)
      if (next) {
        glyph.script = next
      } else {
        console.warn('[replaceGlyphScript] could not parse script wrapper, rewrite with default shell:', glyph.name, glyph.uuid)
        glyph.script = wrapTemplateBodyForGlyph(glyph, templateBody)
      }
    } else {
      glyph.script = wrapTemplateBodyForGlyph(glyph, templateBody)
    }
    delete glyph.script_reference
  }
}

function strokeTemplateUrl_custom1(strokeName: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const file = `${strokeName}.js`
  return `${normalizedBase}templates/private/v1/${encodeURIComponent(file)}`
}

async function fetchStrokeTemplateBody_custom1(strokeName: string): Promise<string | null> {
  const cached = custom1TemplateBodyCache.get(strokeName)
  if (cached !== undefined) return cached.length > 0 ? cached : null

  if (typeof fetch !== 'function') {
    console.warn('[replaceGlyphScript_private/v1] fetch unavailable, skip template:', strokeName)
    custom1TemplateBodyCache.set(strokeName, '')
    return null
  }

  const url = strokeTemplateUrl_custom1(strokeName)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[replaceGlyphScript_private/v1] template not found:', strokeName, res.status, url)
      custom1TemplateBodyCache.set(strokeName, '')
      return null
    }
    const text = (await res.text()).replace(/\r\n/g, '\n').trimEnd()
    custom1TemplateBodyCache.set(strokeName, text)
    return text
  } catch (e) {
    console.warn('[replaceGlyphScript_private/v1] fetch failed:', strokeName, e)
    custom1TemplateBodyCache.set(strokeName, '')
    return null
  }
}

/**
 * 将笔画列表（stroke_glyphs）中每个字形的内联 script 函数体替换为 `public/templates/private/v1` 下同名 `.js` 内容，
 * 行为与 {@link replaceGlyphScript} 一致：保留原 `function script_<uuid>(…)` 函数名与参数列表；
 * 若无内联 script（仅有 script_reference），则写入标准外壳并清除 script_reference。
 */
export async function replaceGlyphScript_private_v1(glyphs: ICustomGlyph[]): Promise<void> {
  for (const glyph of glyphs) {
    const name = glyph.name?.trim()
    if (!name) continue

    const templateBody = await fetchStrokeTemplateBody_custom1(name)
    if (!templateBody) continue

    const existing = typeof glyph.script === 'string' ? glyph.script.trim() : ''
    if (existing) {
      const next = replaceScriptBodyKeepingHeader(existing, templateBody)
      if (next) {
        glyph.script = next
      } else {
        console.warn(
          '[replaceGlyphScript_private/v1] could not parse script wrapper, rewrite with default shell:',
          glyph.name,
          glyph.uuid,
        )
        glyph.script = wrapTemplateBodyForGlyph(glyph, templateBody)
      }
    } else {
      glyph.script = wrapTemplateBodyForGlyph(glyph, templateBody)
    }
    delete glyph.script_reference
  }
}

/**
 * 构建 stroke_glyphs name→uuid 映射（供 replaceCharacterComponentsGlyphScriptRefs_private_v1 使用）。
 *
 * 同名定义可能存在历史残留的"空脚本"条目（如早期"测试笔画模板1"骨架绑定条目，script 为空）。
 * 优先保留带脚本的定义，避免字符组件引用到无脚本定义后渲染为空（画布上消失）。
 */
export function buildStrokeGlyphNameToUuid(
  strokeGlyphs: ICustomGlyph[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const g of strokeGlyphs || []) {
    const name = g.name?.trim()
    if (!name) continue
    const hasScript = typeof g.script === 'string' && g.script.trim().length > 0
    if (hasScript || !map.has(name)) {
      map.set(name, g.uuid)
    }
  }
  return map
}

/**
 * 遍历字符组件树，清除所有字形组件的内联 script，改为通过 script_reference 引用 stroke_glyphs
 * 中对应名称的字形脚本。避免将脚本正文重复存储在每一条字符数据中，导致工程体积膨胀。
 * 仅 dev 模式生效。
 *
 * @param components 字符组件树
 * @param strokeGlyphNameToUuid stroke_glyphs 中 name → uuid 的映射（由 buildStrokeGlyphNameToUuid 构建）
 */
export function replaceCharacterComponentsGlyphScriptRefs_private_v1(
  components: Array<IComponent | IGlyphComponent> | undefined,
  strokeGlyphNameToUuid: Map<string, string>,
): void {
  if (!import.meta.env.DEV) return
  if (!components?.length) return

  for (const comp of components) {
    if (!comp) continue

    if (comp.type === 'glyph' && comp.value) {
      const glyph = comp.value as ICustomGlyph
      const name = glyph.name?.trim()
      if (name) {
        const refUuid = strokeGlyphNameToUuid.get(name)
        if (refUuid) {
          // 清除内联脚本，改为引用 stroke_glyphs 中的对应脚本
          delete glyph.script
          glyph.script_reference = refUuid
        }
      }

      // 递归处理字形内部的嵌套子组件
      const nested = glyph.components as Array<IComponent | IGlyphComponent> | undefined
      if (nested?.length) {
        replaceCharacterComponentsGlyphScriptRefs_private_v1(nested, strokeGlyphNameToUuid)
      }
    }
  }
}

// MARK: 临时代码 — 为"字玩方圆黑体"的"点"字形按 importTemplateTest 设定补全参数
// 仅 dev 模式生效；后续需整段移除

/**
 * 为 stroke_glyphs 中风格为"字玩方圆黑体"且名称为"点"的字形，按 importTemplateTest 的定义补全参数。
 * - 仅添加缺失的参数，已有参数不覆盖（Number 类型保留现有值；Enum 类型合并缺失的 options）
 * - 最后对全部参数的 options 去重
 */
export function addDianGlyphParams_private_v1(strokeGlyphs: ICustomGlyph[] | undefined): void {
  if (!import.meta.env.DEV) return
  if (!strokeGlyphs?.length) return

  const dianGlyph = strokeGlyphs.find(
    (g) => g.style === '字玩方圆黑体' && g.name?.trim() === '点',
  )
  if (!dianGlyph) {
    console.log('[addDianGlyphParams_private/v1] 未找到风格为"字玩方圆黑体"的"点"字形，跳过')
    return
  }

  const dianStroke = strokes.find((s) => s.name === '点')
  if (!dianStroke) {
    console.warn('[addDianGlyphParams_private/v1] 笔画数据中未找到"点"，跳过')
    return
  }

  // 确保 parameters 数组存在
  if (!dianGlyph.parameters || !Array.isArray(dianGlyph.parameters)) {
    dianGlyph.parameters = []
  }
  const params = dianGlyph.parameters as IParameter[]

  // 以共享规则构建 canonical 参数，再合并（只补不覆盖：Number 保留现有值，Enum 合并缺失 options）
  const canonical = buildFangYuanStrokeParameters(dianStroke)
  mergeCanonicalParamsIntoExisting(params, canonical)

  // 全部参数 options 去重
  for (const p of params) {
    dedupParamOptions(p)
  }

  if (import.meta.env.DEV) {
    console.log(
      '[addDianGlyphParams_private/v1] 已为"点"字形补全参数:',
      params.map((p) => `${p.name}(${ParameterType[p.type] ?? p.type})`).join(', '),
    )
  }
}

/**
 * 将 stroke_glyphs 中风格为"字玩方圆黑体"的"倒直角撇"字形的
 * 起笔风格 / 收笔风格中"尖头" option 的 value 改为 1。
 * 仅 dev 模式生效。
 */
export function fixDaoZhiJiaoPieJianTouOptionValue_private_v1(
  strokeGlyphs: ICustomGlyph[] | undefined,
): void {
  if (!import.meta.env.DEV) return
  if (!strokeGlyphs?.length) return

  const glyph = strokeGlyphs.find(
    (g) => g.style === '字玩方圆黑体' && g.name?.trim() === '倒直角撇',
  )
  if (!glyph) {
    console.log(
      '[fixDaoZhiJiaoPie_private/v1] 未找到风格为"字玩方圆黑体"的"倒直角撇"字形，跳过',
    )
    return
  }

  const params = glyph.parameters
  if (!params || !Array.isArray(params)) return

  for (const paramName of ['起笔风格', '收笔风格']) {
    const param = (params as IParameter[]).find((p) => p.name === paramName)
    if (!param?.options) continue
    const option = param.options.find((o) => o.label === '尖头')
    if (option) {
      option.value = 1
    }
  }

  if (import.meta.env.DEV) {
    console.log(
      '[fixDaoZhiJiaoPie_private/v1] 已将"倒直角撇"的起笔风格/收笔风格"尖头" option value 设为 1',
    )
  }
}

// END 临时代码

// MARK: 临时代码 — 将风格为"字玩标准黑体"的 stroke_glyphs 脚本替换为 public/templates/templates2/${name}.js
// 仅 dev 模式生效；后续需整段移除

const templates2TemplateBodyCache = new Map<string, string>()

function strokeTemplateUrl_templates2(strokeName: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}templates/templates2/${encodeURIComponent(strokeName)}.js`
}

async function fetchStrokeTemplateBody_templates2(strokeName: string): Promise<string | null> {
  const cached = templates2TemplateBodyCache.get(strokeName)
  if (cached !== undefined) return cached.length > 0 ? cached : null

  if (typeof fetch !== 'function') {
    console.warn('[replaceGlyphScript_templates2] fetch unavailable, skip template:', strokeName)
    templates2TemplateBodyCache.set(strokeName, '')
    return null
  }

  const url = strokeTemplateUrl_templates2(strokeName)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[replaceGlyphScript_templates2] template not found:', strokeName, res.status, url)
      templates2TemplateBodyCache.set(strokeName, '')
      return null
    }
    const text = (await res.text()).replace(/\r\n/g, '\n').trimEnd()
    templates2TemplateBodyCache.set(strokeName, text)
    return text
  } catch (e) {
    console.warn('[replaceGlyphScript_templates2] fetch failed:', strokeName, e)
    templates2TemplateBodyCache.set(strokeName, '')
    return null
  }
}

export async function replaceGlyphScript_templates2(glyphs: ICustomGlyph[]): Promise<void> {
  for (const glyph of glyphs) {
    const name = glyph.name?.trim()
    if (!name) continue

    const templateBody = await fetchStrokeTemplateBody_templates2(name)
    if (!templateBody) continue

    const existing = typeof glyph.script === 'string' ? glyph.script.trim() : ''
    if (existing) {
      const next = replaceScriptBodyKeepingHeader(existing, templateBody)
      if (next) {
        glyph.script = next
      } else {
        console.warn(
          '[replaceGlyphScript_templates2] could not parse script wrapper, rewrite with default shell:',
          glyph.name,
          glyph.uuid,
        )
        glyph.script = wrapTemplateBodyForGlyph(glyph, templateBody)
      }
    } else {
      glyph.script = wrapTemplateBodyForGlyph(glyph, templateBody)
    }
    delete glyph.script_reference
  }
}

// END 临时代码

// --- 临时代码：字玩方圆黑体 — 加载后放宽字符内字形组件 Number 参数的 min/max（不修改 stroke_glyphs）---

/** 与 glyphParameterHydration 一致 */
function parametersArrayFromGlyphValue(g: ICustomGlyph): IParameter[] | undefined {
  const raw = g.parameters as unknown
  if (Array.isArray(raw)) return raw as IParameter[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { parameters?: IParameter[] }).parameters)) {
    return (raw as { parameters: IParameter[] }).parameters
  }
  return undefined
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isNumberParameterType(t: unknown): boolean {
  if (t === ParameterType.Number || t === 0) return true
  if (typeof t === 'string') {
    const s = t.trim().toLowerCase()
    return s === '0' || s === 'number'
  }
  return false
}

function widenNumberParamsInList(params: IParameter[] | undefined): void {
  if (!params?.length) return
  for (const p of params) {
    if (!p || typeof p !== 'object') continue
    if (!isNumberParameterType(p.type)) continue
    const min = toFiniteNumber(p.min)
    const max = toFiniteNumber(p.max)
    if (min === null || max === null) continue
    if (Math.abs(min) > 10 || Math.abs(max) > 10) {
      p.min = -1000
      p.max = 1000
    }
  }
}

function widenOnGlyphTree(components: Array<IComponent | IGlyphComponent> | undefined): void {
  if (!components?.length) return
  for (const comp of components) {
    if (!comp || comp.type !== 'glyph' || !comp.value) continue
    const g = comp.value as ICustomGlyph
    widenNumberParamsInList(parametersArrayFromGlyphValue(g))
    const nested = g.components as IGlyphComponent[] | undefined
    if (nested?.length) widenOnGlyphTree(nested)
  }
}

/**
 * 在 hydrateGlyphComponentEnumOptionsFromLibrary 之后对字符 components 调用；就地修改，不写 stroke_glyphs。
 */
// MARK: 临时代码 — 将"字玩方圆黑体"字形参数同步为最新笔画规则。
// 参考 templatesHandlers.importTemplateTest 的参数构建逻辑（基础参数 + 通用参数 + 风格规则），
// 补全缺失参数（最新默认值/范围/选项）并合并最新 Enum options；已有参数值保持不变。
// 字符组件侧必须在 widenFangYuanGlyphNumberParamBoundsInCharacterComponents 之前调用，
// 保证新增参数的 min/max 也会被正常放宽。仅 dev 模式生效；后续需整段移除。

/** 将单个字形定义的参数同步为最新笔画规则 */
function syncLatestForGlyphValue(g: ICustomGlyph): void {
  const style = String(g.style ?? '')
  if (!style || !FANG_YUAN_STYLE_TAGS.has(style)) return
  const name = String(g.name ?? '').trim()
  const stroke = strokes.find((s) => s.name === name)
  if (!stroke) return
  const params = parametersArrayFromGlyphValue(g)
  if (params) {
    mergeCanonicalParamsIntoExisting(params, buildFangYuanStrokeParameters(stroke))
  } else {
    g.parameters = buildFangYuanStrokeParameters(stroke) as unknown as ICustomGlyph['parameters']
  }
}

/** 对字形定义列表（如 stroke_glyphs）同步最新笔画规则 */
export function syncFangYuanGlyphParamsToLatest_private_v1(
  glyphs: ICustomGlyph[] | undefined,
): void {
  if (!glyphs?.length) return
  for (const g of glyphs) {
    if (!g) continue
    syncLatestForGlyphValue(g)
  }
}

/** 对字符组件树同步最新笔画规则（递归处理嵌套字形） */
export function syncFangYuanCharacterComponentParamsToLatest_private_v1(
  components: IComponent[] | undefined,
): void {
  syncLatestOnGlyphTree(components)
}

function syncLatestOnGlyphTree(components: Array<IComponent | IGlyphComponent> | undefined): void {
  if (!components?.length) return
  for (const comp of components) {
    if (!comp || comp.type !== 'glyph' || !comp.value) continue
    const g = comp.value as ICustomGlyph
    syncLatestForGlyphValue(g)
    const nested = g.components as IGlyphComponent[] | undefined
    if (nested?.length) syncLatestOnGlyphTree(nested)
  }
}

export function widenFangYuanGlyphNumberParamBoundsInCharacterComponents(
  components: IComponent[] | undefined,
): void {
  widenOnGlyphTree(components)
}

// MARK: 临时代码 — AI 功能测试：将 Number 类型参数范围过大的放宽为 -1000~1000
// 条件：|max - min| > 20；仅 dev 模式、tag 为 AI功能测试 时生效；后续需整段移除

function widenAiTestNumberParamsInList(params: IParameter[] | undefined): void {
  if (!params?.length) return
  for (const p of params) {
    if (!p || typeof p !== 'object') continue
    if (!isNumberParameterType(p.type)) continue
    const min = toFiniteNumber(p.min)
    const max = toFiniteNumber(p.max)
    if (min === null || max === null) continue
    if (Math.abs(max - min) > 20 || (min === 0 && max === 0)) {
      if (import.meta.env.DEV) {
        console.log(
          `[aiWiden] 放宽参数 "${String((p as any).name ?? '?')}": min=${p.min} max=${p.max} → -1000/1000`,
        )
      }
      p.min = -1000
      p.max = 1000
    }
  }
}

function widenAiTestOnGlyphTree(components: Array<IComponent | IGlyphComponent> | undefined): void {
  if (!components?.length) return
  for (const comp of components) {
    if (!comp || comp.type !== 'glyph' || !comp.value) continue
    const g = comp.value as ICustomGlyph
    widenAiTestNumberParamsInList(parametersArrayFromGlyphValue(g))
    const nested = g.components as IGlyphComponent[] | undefined
    if (nested?.length) widenAiTestOnGlyphTree(nested)
  }
}

export function widenAiTestNumberParamBoundsInCharacterComponents(
  components: IComponent[] | undefined,
): void {
  if (import.meta.env.DEV) {
    let glyphCount = 0
    const countGlyphs = (comps: Array<IComponent | IGlyphComponent> | undefined) => {
      if (!comps?.length) return
      for (const c of comps) {
        if (c?.type === 'glyph') {
          glyphCount++
          const nested = (c.value as any)?.components as IGlyphComponent[] | undefined
          if (nested?.length) countGlyphs(nested)
        }
      }
    }
    countGlyphs(components)
    console.log(`[aiWiden] 开始遍历字符组件树，共 ${glyphCount} 个 glyph 组件`)
  }
  widenAiTestOnGlyphTree(components)
}

/** 放宽单个字形定义的参数（就地修改，递归处理嵌套子字形） */
function widenAiTestOnGlyphDef(glyph: ICustomGlyph): void {
  widenAiTestNumberParamsInList(parametersArrayFromGlyphValue(glyph))
  const nested = glyph.components as IGlyphComponent[] | undefined
  if (nested?.length) widenAiTestOnGlyphTree(nested)
}

/**
 * 放宽 glyph 定义数组的 Number 参数（修改 stroke_glyphs / glyphs 等字形定义自身）。
 * 字符实例的放宽由 widenAiTestNumberParamBoundsInCharacterComponents 负责。
 */
export function widenAiTestNumberParamBoundsInGlyphDefinitions(
  glyphs: ICustomGlyph[] | undefined,
): void {
  if (!glyphs?.length) return
  if (import.meta.env.DEV) {
    console.log(`[aiWiden] 放宽字形定义参数，共 ${glyphs.length} 个 glyph 定义`)
  }
  for (const g of glyphs) {
    widenAiTestOnGlyphDef(g)
  }
}

// END 临时代码

// MARK: 临时代码 — 字玩方圆黑体：扩展风格标签为"字玩方圆黑体"的字形组件 Enum 参数 options
// 仅 dev 模式生效；后续需整段移除

const FANG_YUAN_STYLE_TAGS = new Set(['字玩方圆黑体', '测试笔画模板'])


function expandEnumOptionsForFangYuanGlyph(glyph: ICustomGlyph): void {
  if (!glyph.parameters || !Array.isArray(glyph.parameters)) return
  // 共享规则表合并：push 按 value 去重、单圆角部件重命名生效，不覆盖已存在的 replace 结果
  applyFangYuanStyleRulesToParams(glyph.parameters as IParameter[], glyph.name, {
    dedupPush: true,
    skipPlainReplace: true,
  })
}

function expandFangYuanGlyphTree(components: IComponent[] | undefined): void {
  if (!components?.length) return
  for (const comp of components) {
    if (!comp || comp.type !== 'glyph' || !comp.value) continue
    const g = comp.value as ICustomGlyph
    if (g.style && FANG_YUAN_STYLE_TAGS.has(g.style)) {
      expandEnumOptionsForFangYuanGlyph(g)
    }
    const nested = g.components as IGlyphComponent[] | undefined
    if (nested?.length) expandFangYuanGlyphTree(nested)
  }
}

export function expandFangYuanGlyphEnumOptionsInCharacterComponents(
  components: IComponent[] | undefined,
): void {
  expandFangYuanGlyphTree(components)
}

/** 直接对 ICustomGlyph 数组（如 stroke_glyphs）中风格为"字玩方圆黑体"的字形扩展 Enum options */
export function expandFangYuanGlyphEnumOptionsForGlyphs(
  glyphs: ICustomGlyph[],
): void {
  for (const g of glyphs) {
    if (g.style && FANG_YUAN_STYLE_TAGS.has(g.style)) {
      expandEnumOptionsForFangYuanGlyph(g)
    }
  }
}

/** 将字形列表中风格"测试笔画模板"重命名为"字玩方圆黑体" */
export function renameTestStrokeTemplateToFangYuan(glyphs: ICustomGlyph[]): void {
  for (const g of glyphs) {
    if (g.style === '测试笔画模板') {
      g.style = '字玩方圆黑体'
    }
  }
}

/** 递归遍历字符组件树，将风格"测试笔画模板"重命名为"字玩方圆黑体" */
function renameFangYuanStyleInTree(components: IComponent[] | undefined): void {
  if (!components?.length) return
  for (const comp of components) {
    if (!comp || comp.type !== 'glyph' || !comp.value) continue
    const g = comp.value as ICustomGlyph
    if (g.style === '测试笔画模板') {
      g.style = '字玩方圆黑体'
    }
    const nested = g.components as IGlyphComponent[] | undefined
    if (nested?.length) renameFangYuanStyleInTree(nested)
  }
}

export function renameFangYuanStyleInCharacterComponents(
  components: IComponent[] | undefined,
): void {
  renameFangYuanStyleInTree(components)
}

// ============ 参数 options 去重 ============

/** 对单个参数的 options 去重（按 value），原地修改 */
function dedupParamOptions(param: IParameter): void {
  if (!param.options || param.options.length <= 1) return
  const seen = new Set<number>()
  const deduped: Array<{ value: number; label: string }> = []
  for (const o of param.options) {
    if (!seen.has(o.value)) {
      seen.add(o.value)
      deduped.push(o)
    }
  }
  if (deduped.length < param.options.length) {
    if (import.meta.env.DEV) {
      const dupCount = param.options.length - deduped.length
      console.log(`[dedupParams] ${param.name}: 去除 ${dupCount} 个重复选项 (${param.options.length} → ${deduped.length})`)
    }
    param.options = deduped
  }
}

/** 递归对字形列表中的所有参数 options 去重 */
function dedupGlyphParams(glyphs: ICustomGlyph[] | undefined): void {
  if (!glyphs?.length) return
  for (const g of glyphs) {
    if (g.parameters) {
      for (const p of g.parameters) dedupParamOptions(p)
    }
    // 递归处理字形内的子组件
    if (g.components) dedupComponentTreeParams(g.components)
  }
}

/** 递归对组件树（字符组件列表）中所有字形组件的参数 options 去重 */
function dedupComponentTreeParams(components: Array<IGlyphComponent | IComponent> | undefined): void {
  if (!components?.length) return
  for (const comp of components) {
    if (!comp) continue
    const compAny = comp as any
    // 组件自身的 parameters（如有）
    if (compAny.parameters) {
      for (const p of compAny.parameters) dedupParamOptions(p)
    }
    // 字形组件的 value 中的 parameters
    if (comp.type === 'glyph' || compAny.type === 'glyph') {
      const v = (comp as any).value as ICustomGlyph | undefined
      if (v?.parameters) {
        for (const p of v.parameters) dedupParamOptions(p)
      }
      // 递归字形内部的子组件
      if (v?.components) dedupComponentTreeParams(v.components)
    }
    // 递归子组件（普通组件的 value 中可能嵌套）
    if (compAny.value?.components) {
      dedupComponentTreeParams(compAny.value.components)
    }
  }
}

/**
 * 对工程中所有组件参数 options 去重（dev 专用）。
 * 覆盖 stroke_glyphs / glyphs / radical_glyphs / comp_glyphs 以及字符列表中的所有组件。
 */
/** 对字符组件树中所有参数 options 去重（供 processCharacters 调用） */
export function dedupCharacterComponentOptions(components: IComponent[] | undefined): void {
  if (!import.meta.env.DEV) return
  dedupComponentTreeParams(components)
}

export function dedupAllParameterOptions(file: {
  stroke_glyphs?: ICustomGlyph[]
  glyphs?: ICustomGlyph[]
  radical_glyphs?: ICustomGlyph[]
  comp_glyphs?: ICustomGlyph[]
  characterList?: Array<{ uuid: string; [key: string]: any }>
  components?: IComponent[]
}): void {
  if (!import.meta.env.DEV) return

  dedupGlyphParams(file.stroke_glyphs)
  dedupGlyphParams(file.glyphs)
  dedupGlyphParams(file.radical_glyphs)
  dedupGlyphParams(file.comp_glyphs)

  // 字符列表中的组件
  if (file.components) {
    dedupComponentTreeParams(file.components)
  }
}

// END 临时代码