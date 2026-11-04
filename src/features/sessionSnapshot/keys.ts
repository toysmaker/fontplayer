/**
 * 会话快照 IndexedDB 键定义
 * 全部写入 fontplayer_storage/large_data（indexedDBManager）
 */

/** 快照元信息键：savedAt、files 列表、selectedFileUUID */
export const SNAPSHOT_META_KEY = 'ss_meta'

/** 快照有效期：超过则视为过期，不自动恢复、不显示入口 */
export const SNAPSHOT_TTL_MS = 24 * 3600 * 1000

/** 单文件快照的分节键（分节写入避免大表全量序列化 OOM） */
export function buildFileSnapshotKeys(fileUUID: string) {
  return {
    meta: `ss_file_meta_${fileUUID}`,
    chars: `ss_file_chars_${fileUUID}`,
    glyphs: `ss_file_glyphs_${fileUUID}`,
    constants: `ss_file_constants_${fileUUID}`,
    editing: `ss_editing_${fileUUID}`,
  }
}

/** 所有 ss_* 单文件键（含 ss_editing_）的 uuid 提取（GC 用） */
export function extractFileUUIDFromSnapshotKey(key: string): string | null {
  const m = /^ss_(?:file_(?:meta|chars|glyphs|constants)|editing)_(.+)$/.exec(key)
  return m ? m[1] : null
}
