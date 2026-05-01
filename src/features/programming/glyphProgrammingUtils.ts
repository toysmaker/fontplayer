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

/**
 * 判断脚本是否为默认空模板（只有注释，无可执行语句）
 * 默认模板格式：function script_UUID(glyph|character, constants, FP) { ... }
 * 其中 UUID 将原 uuid 中的 '-' 替换为 '_'
 */
export function isDefaultScriptTemplate(script: string): boolean {
  if (!script || typeof script !== 'string') return false

  // 尝试匹配函数头：function script_<underscored_uuid>(<params>) { <body> }
  // UUID 由 Date.now()-Math.random().toString(36) 生成，经 replaceAll('-', '_') 后含 0-9 a-z _
  const match = script.match(
    /^function\s+script_\w+\([^)]*\)\s*\{([\s\S]*)\}\s*$/,
  )
  if (!match) return false

  const body = match[1].trim()

  // 空函数体
  if (body === '') return true

  // 仅包含 //Todo something 或 // Todo something 注释
  if (/^\/\/\s*Todo\s*something\s*$/i.test(body)) return true

  // 仅包含注释行和空白行
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    if (/^\/\//.test(trimmed)) continue
    // 存在非注释代码
    return false
  }

  return true
}
