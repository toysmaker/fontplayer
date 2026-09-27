/**
 * 临时代码：打开 tag 为"字玩方圆黑体"的工程时，自动补全 stroke_glyphs 中缺失的笔画字形。
 * 仅 dev 模式生效。后续需整段移除。
 */
import type { ICustomGlyph, IParameter } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { strokes } from '@/templates/private/v1/strokes'
import { buildFangYuanStrokeParameters } from '@/templates/private/v1/strokeParamBuilder'

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
      const parameters = buildFangYuanStrokeParameters(stroke)
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
