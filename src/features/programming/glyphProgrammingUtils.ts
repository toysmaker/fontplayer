import type { ICustomGlyph, IParameter } from '@/core/types'

export function getGlyphParametersArray(g: ICustomGlyph | null | undefined): IParameter[] {
  if (!g?.parameters) return []
  const p = g.parameters as unknown
  if (Array.isArray(p)) return p as IParameter[]
  if (
    p &&
    typeof p === 'object' &&
    Array.isArray((p as { parameters?: IParameter[] }).parameters)
  ) {
    return (p as { parameters: IParameter[] }).parameters
  }
  return []
}

export function defaultGlyphScriptTemplate(uuid: string): string {
  return `function script_${uuid.replaceAll('-', '_')} (glyph, constants, FP) {\n\t//Todo something\n}`
}

export function defaultCharacterScriptTemplate(uuid: string): string {
  return `function script_${uuid.replaceAll('-', '_')} (character, constants, FP) {\n\t//Todo something\n}`
}
