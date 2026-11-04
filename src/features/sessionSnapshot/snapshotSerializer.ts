/**
 * 会话快照序列化
 * - stripGlyphComponents/stripGlyphArray：剥离运行时字段
 *   （_o 实例引用可能形成循环引用，contour/preview 是派生大对象）
 * - buildFileSections：把 IFile 分节序列化为 JSON 字符串，带时间预算；
 *   超预算返回 null（本 tick 放弃该节，下 tick 续传），绝不阻塞 UI / 绝不 OOM
 */
import type { IFile } from '@/core/types'

/** 清理组件数组的运行时字段（与 FileHandler.cleanupGlyphComponents 共享实现） */
export function stripGlyphComponents(components: any[]): any[] {
  return (components || []).map((component: any) => {
    if (!component) return component
    const cleanComponent: any = { ...component }
    delete cleanComponent._o
    if (cleanComponent.value) {
      const value = { ...cleanComponent.value }
      delete value.contour
      delete value.preview
      delete value.contour2
      delete value._o
      if (cleanComponent.type === 'glyph' && value.components) {
        value.components = stripGlyphComponents(value.components)
      }
      cleanComponent.value = value
    }
    return cleanComponent
  })
}

/** 清理字形数组的运行时字段（与 FileHandler.cleanupGlyphArray 共享实现） */
export function stripGlyphArray(glyphs: any[] | undefined): any[] {
  return (glyphs || []).map((glyph: any) => {
    const cleanGlyph: any = { ...glyph }
    delete cleanGlyph._o
    delete cleanGlyph.previewRef
    delete cleanGlyph.contourRef
    if (cleanGlyph.components) {
      cleanGlyph.components = stripGlyphComponents(cleanGlyph.components)
    }
    return cleanGlyph
  })
}

export interface FileSections {
  meta: string | null
  chars: string | null
  glyphs: string | null
  constants: string | null
}

/**
 * 分节序列化 IFile。每节独立时间预算：超预算返回 null（放弃本节，下轮续传）。
 * 注意：characterList 可能含完整字符条目（updateCharacterListFromEditFile 会写入完整对象），原样序列化。
 */
export function buildFileSections(file: IFile, budgetMs = 200): FileSections {
  const start = Date.now()

  const budgeted = (value: unknown): string | null => {
    if (Date.now() - start >= budgetMs) return null
    try {
      return JSON.stringify(value)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[sessionSnapshot] serialize section failed:', err)
      }
      return null
    }
  }

  const meta = {
    uuid: file.uuid,
    name: file.name,
    tag: file.tag,
    width: file.width,
    height: file.height,
    iconsCount: file.iconsCount,
    saved: file.saved,
    fontSettings: file.fontSettings,
    variants: file.variants,
  }
  const glyphTables = {
    glyphs: stripGlyphArray(file.glyphs),
    stroke_glyphs: stripGlyphArray(file.stroke_glyphs),
    radical_glyphs: stripGlyphArray(file.radical_glyphs),
    comp_glyphs: stripGlyphArray(file.comp_glyphs),
  }

  return {
    meta: budgeted(meta),
    chars: budgeted(file.characterList),
    glyphs: budgeted(glyphTables),
    constants: budgeted(file.constants || []),
  }
}
