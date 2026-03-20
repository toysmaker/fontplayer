/**
 * 字形 JSON 交换：导出可序列化结构、导入还原为 ICustomGlyph。
 * 与工程内 IFile / ICustomGlyph 一致，兼容旧版导出（无 version 或 1.0）与 v2.0。
 */

import * as R from 'ramda'
import type { IFile, ICustomGlyph, IGlyphComponent, IJoint } from '@/core/types'
import { EditStatus } from '@/core/types'

export type GlyphBucketKey = 'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'

export type ParsedGlyphExchange = {
  version: 'legacy' | '2.0'
  glyphs: unknown[]
  constants?: unknown[]
  constantGlyphMap?: Record<string, unknown>
}

function parametersToArray(parameters: unknown): any[] {
  if (!parameters) return []
  if (Array.isArray(parameters)) return parameters as any[]
  const p = parameters as { parameters?: unknown[] }
  if (p.parameters && Array.isArray(p.parameters)) return p.parameters as any[]
  return []
}

function serializeJoint(joint: IJoint): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: joint.name,
    uuid: joint.uuid,
    id: joint.id,
  }
  if (typeof joint.x === 'function' || typeof joint.y === 'function') {
    return out
  }
  out.x = joint.x
  out.y = joint.y
  return out
}

function serializeNonGlyphComponentValue(type: string, value: unknown): Record<string, unknown> {
  const v = { ...(value as Record<string, unknown>) }
  if ('contour' in v) v.contour = null
  if ('preview' in v) v.preview = null
  if ('contour2' in v) delete v.contour2
  if (type === 'picture') {
    delete v.img
    delete v.originImg
    delete v.pixels
  }
  return v
}

function serializeGlyphComponent(component: IGlyphComponent, _parentGlyphUuid: string): IGlyphComponent {
  const _component = { ...component } as IGlyphComponent
  if (component.type === 'glyph' && component.value) {
    _component.value = serializeGlyphForExport(component.value as unknown as ICustomGlyph, {
      clearScript: true,
    }) as any
  } else if (component.value) {
    _component.value = serializeNonGlyphComponentValue(component.type, component.value) as any
  }
  return _component
}

/** 导出用：剥离运行时 / 不可跨环境字段，嵌套字形递归处理。 */
export function serializeGlyphForExport(
  glyph: ICustomGlyph,
  options: { clearScript: boolean },
): Record<string, unknown> {
  const { clearScript } = options
  const parametersArr = parametersToArray(glyph.parameters)

  const data: Record<string, unknown> = {
    uuid: glyph.uuid,
    type: glyph.type,
    name: glyph.name,
    components: (glyph.components || []).map((c) => serializeGlyphComponent(c, glyph.uuid)),
    groups: R.clone(glyph.groups ?? []),
    orderedList: R.clone(glyph.orderedList ?? []),
    selectedComponentsUUIDs: R.clone(glyph.selectedComponentsUUIDs ?? []),
    selectedComponentsTree: R.clone(glyph.selectedComponentsTree ?? []),
    view: R.clone(glyph.view),
    parameters: parametersArr,
    constants: glyph.constants?.length ? R.clone(glyph.constants) : undefined,
    joints: (glyph.joints || []).map((j) => serializeJoint(j)),
    reflines: glyph.reflines ? R.clone(glyph.reflines) : [],
    script: clearScript ? null : glyph.script,
    skeleton: glyph.skeleton ? R.clone(glyph.skeleton) : null,
    style: glyph.style,
  }

  if (clearScript) {
    data.script_reference = glyph.uuid
  }

  const gAny = glyph as unknown as Record<string, unknown>
  if (gAny.layout) {
    data.layout = R.clone(gAny.layout)
  }
  if (glyph.glyph_script) data.glyph_script = R.clone(glyph.glyph_script)
  if (glyph.system_script) data.system_script = R.clone(glyph.system_script)
  if (glyph.param_script) data.param_script = R.clone(glyph.param_script)

  // 明确不导出 IndexedDB 键与实例数据
  delete data.contourRef
  delete data.previewRef

  return data
}

export function getGlyphExportInfo(
  file: IFile,
  editStatus: EditStatus,
): { list: ICustomGlyph[]; defaultFileName: string; bucket: GlyphBucketKey } | null {
  switch (editStatus) {
    case EditStatus.GlyphList:
      return { list: file.glyphs ?? [], defaultFileName: 'glyphs.json', bucket: 'glyphs' }
    case EditStatus.StrokeGlyphList:
      return { list: file.stroke_glyphs ?? [], defaultFileName: 'stroke_glyphs.json', bucket: 'stroke_glyphs' }
    case EditStatus.RadicalGlyphList:
      return { list: file.radical_glyphs ?? [], defaultFileName: 'radical_glyphs.json', bucket: 'radical_glyphs' }
    case EditStatus.CompGlyphList:
      return { list: file.comp_glyphs ?? [], defaultFileName: 'comp_glyphs.json', bucket: 'comp_glyphs' }
    default:
      return null
  }
}

export function buildExportPayload(file: IFile, editStatus: EditStatus): Record<string, unknown> | null {
  const info = getGlyphExportInfo(file, editStatus)
  if (!info) return null
  const glyphs = info.list.map((g) => serializeGlyphForExport(g, { clearScript: false }))
  return {
    version: '2.0',
    glyphs,
    constants: file.constants ?? [],
    constantGlyphMap: { ...(file.constantGlyphMap ?? {}) },
  }
}

export function normalizeVersion(v: unknown): 'legacy' | '2.0' {
  if (v === '2.0') return '2.0'
  if (v === '' || v == null) return 'legacy'
  if (v === 1 || v === 1.0 || v === '1.0') return 'legacy'
  return 'legacy'
}

export function parseImportedJson(text: string): ParsedGlyphExchange {
  const data = JSON.parse(text) as Record<string, unknown>
  if (!Array.isArray(data.glyphs)) {
    throw new Error('Invalid glyphs JSON: missing glyphs array')
  }
  return {
    version: normalizeVersion(data.version),
    glyphs: data.glyphs as unknown[],
    constants: Array.isArray(data.constants) ? data.constants : undefined,
    constantGlyphMap:
      data.constantGlyphMap && typeof data.constantGlyphMap === 'object'
        ? (data.constantGlyphMap as Record<string, unknown>)
        : undefined,
  }
}

function hydratePlainComponentValue(type: string, value: Record<string, unknown>): Record<string, unknown> {
  const v = { ...value }
  delete v.img
  delete v.originImg
  delete v.pixels
  delete (v as any)._o
  if (type !== 'picture') {
    if ('contour' in v && v.contour === undefined) delete v.contour
    if ('preview' in v && v.preview === undefined) delete v.preview
  }
  return v
}

/** 从交换 JSON 还原为 ICustomGlyph（纯对象，无旧版 Joint/ParametersMap 类）。 */
export function hydrateGlyphFromPlain(plain: unknown): ICustomGlyph {
  const raw = JSON.parse(JSON.stringify(plain)) as Record<string, unknown>
  delete raw.objData
  delete raw.parent_reference
  delete raw.contourRef
  delete raw.previewRef

  raw.parameters = parametersToArray(raw.parameters)

  const jointsIn = (raw.joints as unknown[]) || []
  raw.joints = jointsIn.map((j) => {
    const jt = j as Record<string, unknown>
    return {
      name: jt.name,
      uuid: jt.uuid,
      id: jt.id,
      x: typeof jt.x === 'number' ? jt.x : 0,
      y: typeof jt.y === 'number' ? jt.y : 0,
    }
  })

  const comps = (raw.components as unknown[]) || []
  raw.components = comps.map((c) => {
    const comp = c as Record<string, unknown> & { type?: string; value?: Record<string, unknown> }
    const out: IGlyphComponent = { ...(comp as unknown as IGlyphComponent) }
    if (comp.type === 'glyph' && comp.value) {
      out.value = hydrateGlyphFromPlain(comp.value) as any
    } else if (comp.value && comp.type) {
      out.value = hydratePlainComponentValue(comp.type, comp.value) as any
    }
    return out
  })

  return raw as unknown as ICustomGlyph
}

/** 四种字形列表 bucket（工程内并列存在，导入时需跨列表校验 uuid）。 */
export const GLYPH_BUCKET_KEYS: GlyphBucketKey[] = [
  'glyphs',
  'stroke_glyphs',
  'radical_glyphs',
  'comp_glyphs',
]

/** 收集当前工程中全部字形条目的 uuid（跨四种列表）。 */
export function collectAllGlyphUuids(file: IFile): Set<string> {
  const s = new Set<string>()
  for (const key of GLYPH_BUCKET_KEYS) {
    const list = file[key] as ICustomGlyph[] | undefined
    for (const g of list ?? []) {
      if (g?.uuid) s.add(g.uuid)
    }
  }
  return s
}

/** 解析当前编辑状态对应的导入目标 bucket（须在非字符列表下调用）。 */
export function resolveImportBucket(
  editStatus: EditStatus,
  glyphCategory: GlyphBucketKey,
): GlyphBucketKey {
  switch (editStatus) {
    case EditStatus.GlyphList:
      return 'glyphs'
    case EditStatus.StrokeGlyphList:
      return 'stroke_glyphs'
    case EditStatus.RadicalGlyphList:
      return 'radical_glyphs'
    case EditStatus.CompGlyphList:
      return 'comp_glyphs'
    default:
      return glyphCategory
  }
}

export const GlyphImportExportService = {
  serializeGlyphForExport,
  getGlyphExportInfo,
  buildExportPayload,
  normalizeVersion,
  parseImportedJson,
  hydrateGlyphFromPlain,
  resolveImportBucket,
  collectAllGlyphUuids,
  GLYPH_BUCKET_KEYS,
}
