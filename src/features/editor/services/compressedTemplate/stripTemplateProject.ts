/**
 * Semantic stripping for bundled default template (time vs space).
 * Mirrors pack script and must stay in sync with scripts/pack-default-template.mts.
 */

/** 默认模板 / pack 脚本为减小体积会去掉 enum 的 options；用户 .fp 工程须保留 options，否则右侧面板无法显示下拉项。 */
export type StripCharacterOptions = {
  /** 默认 true。为 false 时保留字形组件参数上的 enum.options（用户工程 .fp） */
  stripGlyphParameterEnumOptions?: boolean
}

export function stripGlyphValueForTemplate(
  value: Record<string, unknown>,
  stripEnumOptions: boolean = true,
): void {
  if (!value || typeof value !== 'object') return
  delete value.objData
  if (!stripEnumOptions) return
  const params = value.parameters as unknown[] | undefined
  if (Array.isArray(params)) {
    for (const p of params) {
      if (p && typeof p === 'object' && 'options' in (p as object)) {
        delete (p as { options?: unknown }).options
      }
    }
  }
}

export function stripCharacterForTemplate<T extends Record<string, unknown>>(
  character: T,
  options?: StripCharacterOptions,
): T {
  const stripEnumOpts = options?.stripGlyphParameterEnumOptions !== false
  const c = JSON.parse(JSON.stringify(character)) as T
  const script = c.script
  if (typeof script === 'string' && script.includes('Todo something')) {
    ;(c as { script?: string }).script = ''
  }
  const components = (c as { components?: unknown[] }).components
  if (Array.isArray(components)) {
    for (const comp of components) {
      if (
        comp &&
        typeof comp === 'object' &&
        (comp as { type?: string }).type === 'glyph' &&
        (comp as { value?: Record<string, unknown> }).value
      ) {
        stripGlyphValueForTemplate((comp as { value: Record<string, unknown> }).value, stripEnumOpts)
      }
    }
  }
  return c
}

export function buildFpzHeaderProject(src: Record<string, unknown>): Record<string, unknown> {
  const file = src.file as Record<string, unknown> | undefined
  const list = (file?.characterList as unknown[]) || []
  const n = list.length
  return {
    version: src.version ?? '2.0',
    file: {
      ...(file || {}),
      characterList: [],
      iconsCount: n,
    },
    constants: src.constants ?? [],
    constantGlyphMap: src.constantGlyphMap ?? {},
    glyphs: [],
    stroke_glyphs: src.stroke_glyphs ?? [],
    radical_glyphs: [],
    comp_glyphs: [],
  }
}

export function unicodeToCodePoint(character: Record<string, unknown>): number {
  const ch = character.character as Record<string, unknown> | undefined
  if (!ch) return 0
  const u = ch.unicode
  if (typeof u === 'number' && Number.isFinite(u)) return u
  if (typeof u === 'string') {
    const n = parseInt(u, 16)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}
