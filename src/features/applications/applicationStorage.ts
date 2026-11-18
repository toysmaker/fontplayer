import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import type { IFile, IFileApplications } from '@/core/types'
import { APP_DOC_SCHEMA_VERSION } from './constants'
import { pushApplicationFileUpdate } from './applicationWindowBridge'
import type { ApplicationType, IApplicationDocument } from './types'

/**
 * 应用文档存储（**随工程存储**）：
 * - 应用列表存于工程数据 `file.applications`（JSON 安全，不含字体二进制），
 *   只有「保存工程 / 导出工程」才持久化到工程文件；不保存则仅存在于内存。
 * - 字体副本（ArrayBuffer）在 IndexedDB 按 工程+应用 缓存（跨窗口共享），
 *   换工程自然隔离，不会跨工程泄漏列表。
 */

function fontCacheKey(fileUUID: string, appId: string): string {
  return `application_font_doc_${fileUUID}_${appId}`
}

/** 编辑草稿（未保存）缓存键：appKey = 应用 id 或 'new'（新建草稿） */
function draftKey(fileUUID: string, type: ApplicationType, appKey: string): string {
  return `application_draft_${fileUUID}_${type}_${appKey}`
}

function draftFontKey(fileUUID: string, type: ApplicationType, appKey: string): string {
  return `application_draft_font_${fileUUID}_${type}_${appKey}`
}

function emptyApplications(): IFileApplications {
  return { card: [], logo: [], avatar: [] }
}

export function getFileApplications(file: IFile): IFileApplications {
  if (!file.applications) {
    file.applications = emptyApplications()
  }
  return file.applications
}

/** 文档 JSON 部分（工程内存储，剥离字体二进制） */
export function toJsonDoc(doc: IApplicationDocument): Record<string, unknown> {
  const { fontBuffer: _fontBuffer, ...rest } = doc
  void _fontBuffer
  return JSON.parse(JSON.stringify(rest))
}

/** 从工程 JSON 文档 + 字体缓存合并为完整文档 */
async function hydrateDoc(
  file: IFile,
  jsonDoc: Record<string, unknown> | undefined
): Promise<IApplicationDocument | null> {
  if (!jsonDoc) return null
  // 文件对象在 projectStore 中是 reactive Proxy，JSON 序列化剥离
  const doc = JSON.parse(JSON.stringify(jsonDoc)) as unknown as IApplicationDocument
  if (!doc.schemaVersion || doc.schemaVersion < APP_DOC_SCHEMA_VERSION) {
    doc.schemaVersion = APP_DOC_SCHEMA_VERSION
  }
  try {
    const buffer = await indexedDBManager.get<ArrayBuffer>(fontCacheKey(file.uuid, doc.id))
    doc.fontBuffer = buffer ?? new ArrayBuffer(0)
  } catch (err) {
    doc.fontBuffer = new ArrayBuffer(0)
    if (import.meta.env.DEV) {
      console.warn('[applications] load font cache failed:', err)
    }
  }
  return doc
}

class ApplicationStorageService {
  /** 列出该类型的全部应用（来自当前工程数据） */
  async listDocs(file: IFile, type: ApplicationType): Promise<IApplicationDocument[]> {
    const apps = getFileApplications(file)
    const list = (apps[type] ?? []) as Record<string, unknown>[]
    const docs: IApplicationDocument[] = []
    for (const jsonDoc of list) {
      const doc = await hydrateDoc(file, jsonDoc)
      if (doc) docs.push(doc)
    }
    docs.sort((a, b) => b.updatedAt - a.updatedAt)
    return docs
  }

  async getDoc(file: IFile, type: ApplicationType, id: string): Promise<IApplicationDocument | null> {
    const apps = getFileApplications(file)
    const jsonDoc = ((apps[type] ?? []) as Record<string, unknown>[]).find((d) => d.id === id)
    return hydrateDoc(file, jsonDoc)
  }

  async countDocs(file: IFile, type: ApplicationType): Promise<number> {
    const apps = getFileApplications(file)
    return (apps[type] ?? []).length
  }

  /**
   * 保存（新建/更新）：
   * - JSON 部分写入工程数据 file.applications（随「保存工程/导出工程」持久化）
   * - 字体副本写入 IndexedDB 缓存（按 工程+应用 隔离）
   * - 同步工程快照并广播给主窗口
   */
  async saveDoc(file: IFile, doc: IApplicationDocument): Promise<void> {
    doc.updatedAt = Date.now()
    const apps = getFileApplications(file)
    const list = (apps[doc.type] ?? []) as Record<string, unknown>[]
    const jsonDoc = toJsonDoc(doc)
    const index = list.findIndex((d) => d.id === doc.id)
    if (index >= 0) list[index] = jsonDoc
    else list.push(jsonDoc)
    apps[doc.type] = list as never

    try {
      await indexedDBManager.set(fontCacheKey(file.uuid, doc.id), doc.fontBuffer)
    } catch (err) {
      if ((err as Error)?.name === 'QuotaExceededError') {
        const quotaError = new Error('QUOTA_EXCEEDED')
        quotaError.name = 'QuotaExceededError'
        throw quotaError
      }
      throw err
    }
    pushApplicationFileUpdate(file.uuid)
  }

  async removeDoc(file: IFile, type: ApplicationType, id: string): Promise<void> {
    const apps = getFileApplications(file)
    const list = (apps[type] ?? []) as Record<string, unknown>[]
    apps[type] = list.filter((d) => d.id !== id) as never
    try {
      await indexedDBManager.remove(fontCacheKey(file.uuid, id))
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[applications] remove font cache failed:', err)
      }
    }
    pushApplicationFileUpdate(file.uuid)
  }

  // ---------------- 编辑草稿（未保存工作的自动持久化） ----------------

  /** 保存草稿（JSON 部分 + 字体二进制分键缓存；防路由跳转/关窗丢失编辑内容） */
  async saveDraft(file: IFile, doc: IApplicationDocument, appKey: string): Promise<void> {
    doc.updatedAt = Date.now()
    try {
      await indexedDBManager.set(draftKey(file.uuid, doc.type, appKey), toJsonDoc(doc))
      if (doc.fontBuffer && doc.fontBuffer.byteLength > 0) {
        await indexedDBManager.set(draftFontKey(file.uuid, doc.type, appKey), doc.fontBuffer)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[applications] save draft failed:', err)
      }
    }
  }

  async loadDraft(file: IFile, type: ApplicationType, appKey: string): Promise<IApplicationDocument | null> {
    try {
      const jsonDoc = await indexedDBManager.get<Record<string, unknown>>(
        draftKey(file.uuid, type, appKey)
      )
      if (!jsonDoc) return null
      const doc = JSON.parse(JSON.stringify(jsonDoc)) as unknown as IApplicationDocument
      if (!doc.schemaVersion || doc.schemaVersion < APP_DOC_SCHEMA_VERSION) {
        doc.schemaVersion = APP_DOC_SCHEMA_VERSION
      }
      const font = await indexedDBManager.get<ArrayBuffer>(draftFontKey(file.uuid, type, appKey))
      doc.fontBuffer = font ?? new ArrayBuffer(0)
      return doc
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[applications] load draft failed:', err)
      }
      return null
    }
  }

  async clearDraft(file: IFile, type: ApplicationType, appKey: string): Promise<void> {
    try {
      await indexedDBManager.remove(draftKey(file.uuid, type, appKey))
      await indexedDBManager.remove(draftFontKey(file.uuid, type, appKey))
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[applications] clear draft failed:', err)
      }
    }
  }
}

export const applicationStorage = new ApplicationStorageService()
