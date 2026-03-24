import type { ICustomGlyph } from '@/core/types'

const templateBodyCache = new Map<string, string>()

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
