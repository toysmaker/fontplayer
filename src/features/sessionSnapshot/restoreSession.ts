/**
 * 会话恢复
 *
 * 白屏重载（webview 进程死亡 → 页面带着 hash 重载）后，从 IndexedDB 快照
 * 轻量重建 store：组装 IFile（字符完整数据仍在 IDB character_ 键）、
 * 注入编辑态 UUID/editingGlyph。无需走 ProjectLoader 重型处理
 * （contour_/preview_/canvas_preview_ 缓存键在重载后仍可用）。
 */
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import type { ICustomGlyph, IFile } from '@/core/types'
import { SNAPSHOT_META_KEY, SNAPSHOT_TTL_MS, buildFileSnapshotKeys } from './keys'

const LIST_STATUSES = [
  EditStatus.CharacterList,
  EditStatus.StrokeGlyphList,
  EditStatus.RadicalGlyphList,
  EditStatus.CompGlyphList,
  EditStatus.GlyphList,
]

/** Pic/AdvancedEdit 挂载依赖复杂，恢复时降级为 prevStatus（或字符列表） */
function normalizeEditStatus(status: unknown, prev: unknown): EditStatus {
  if (status === EditStatus.Edit || status === EditStatus.Glyph) return status
  if (prev === EditStatus.Edit || prev === EditStatus.Glyph) return prev
  if (typeof status === 'string' && LIST_STATUSES.includes(status as EditStatus)) return status as EditStatus
  if (typeof prev === 'string' && LIST_STATUSES.includes(prev as EditStatus)) return prev as EditStatus
  return EditStatus.CharacterList
}

type GlyphCategory = 'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'

/** 把编辑中字形的快照注入四表（按 uuid 替换，找不到则追加） */
function injectEditingGlyph(file: IFile, category: GlyphCategory, glyph: ICustomGlyph): void {
  const list = (file[category] || []) as ICustomGlyph[]
  const index = list.findIndex((g) => g.uuid === glyph.uuid)
  if (index >= 0) {
    list[index] = glyph
  } else {
    list.push(glyph)
  }
}

export interface RestoreSessionOptions {
  /** 自动恢复（白屏重载场景）：失败时完全静默 */
  auto?: boolean
}

/**
 * 从快照恢复上次会话。成功返回 true。
 * 自动恢复失败静默；手动恢复（欢迎页）失败返回 false 由调用方提示。
 */
export async function restoreLastSession(options: RestoreSessionOptions = {}): Promise<boolean> {
  const projectStore = useProjectStore()
  try {
    if (projectStore.files.length) return false

    const raw = await indexedDBManager.get<string>(SNAPSHOT_META_KEY)
    if (!raw) return false
    let meta: { savedAt?: number; selectedFileUUID?: string; files?: Array<{ uuid: string; name: string }> }
    try {
      meta = JSON.parse(raw)
    } catch {
      return false
    }
    if (!meta?.selectedFileUUID || typeof meta.savedAt !== 'number') return false
    if (Date.now() - meta.savedAt > SNAPSHOT_TTL_MS) return false

    // 逐文件组装（字符完整数据在 IDB character_ 键，无需重复序列化）
    for (const f of meta.files || []) {
      const keys = buildFileSnapshotKeys(f.uuid)
      const [metaJson, charsJson, glyphsJson, constantsJson] = await Promise.all([
        indexedDBManager.get<string>(keys.meta),
        indexedDBManager.get<string>(keys.chars),
        indexedDBManager.get<string>(keys.glyphs),
        indexedDBManager.get<string>(keys.constants),
      ])
      if (!metaJson) {
        if (f.uuid === meta.selectedFileUUID) {
          if (import.meta.env.DEV) {
            console.warn('[restoreSession] selected file meta section missing, abort')
          }
          return false
        }
        continue
      }
      const fileMeta = JSON.parse(metaJson)
      const glyphTables = glyphsJson ? JSON.parse(glyphsJson) : {}
      const file: IFile = {
        ...fileMeta,
        characterList: charsJson ? JSON.parse(charsJson) : [],
        glyphs: glyphTables.glyphs || [],
        stroke_glyphs: glyphTables.stroke_glyphs || [],
        radical_glyphs: glyphTables.radical_glyphs || [],
        comp_glyphs: glyphTables.comp_glyphs || [],
        constants: constantsJson ? JSON.parse(constantsJson) : [],
      }
      projectStore.addFile(file)
    }
    if (!projectStore.files.length) return false
    if (!projectStore.selectFile(meta.selectedFileUUID)) return false

    // 编辑态恢复：先设 UUID（编辑器挂载自愈分支会从 IDB/列表载入数据），再切状态
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const editorStore = useEditorStore()
    const editingRaw = await indexedDBManager.get<string>(buildFileSnapshotKeys(meta.selectedFileUUID).editing)
    if (editingRaw) {
      try {
        const ed = JSON.parse(editingRaw)
        if (ed.editingGlyphUUID && ed.editingGlyph && ed.glyphCategory) {
          try {
            const glyph = JSON.parse(ed.editingGlyph) as ICustomGlyph
            injectEditingGlyph(projectStore.selectedFile, ed.glyphCategory as GlyphCategory, glyph)
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn('[restoreSession] editingGlyph snapshot corrupt, skip injection:', err)
            }
          }
          glyphStore.setEditingGlyphUUID(ed.editingGlyphUUID)
        }
        if (ed.editingCharacterUUID) {
          characterStore.setEditingCharacterUUID(ed.editingCharacterUUID)
        }
        editorStore.setEditStatus(normalizeEditStatus(ed.editStatus, ed.prevStatus))
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[restoreSession] restore editing state failed:', err)
        }
      }
    }

    // 清理陈旧渲染缓存（快照期间被编辑的字形/字符缩略图可能过期）
    try {
      const { CanvasManager } = await import('@/core/canvas/CanvasManager')
      CanvasManager.forceCleanupAllCache()
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
    window.dispatchEvent(new CustomEvent('force-glyph-list-refresh'))

    return true
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[restoreSession] restore failed:', err)
    }
    return false
  }
}
