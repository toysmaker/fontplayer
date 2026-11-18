import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { buildExportFontBuffer } from '@/features/editor/services/ExportFontService'
import { buildExportColorFontBuffer } from '@/features/editor/services/ExportColorFontService'
import { parse } from '@/fontManager'

/**
 * 应用字库服务：把当前工程的**全部字符**构建成字体，并仅缓存在内存中
 * （用户明确要求：不写 IndexedDB/localStorage）。
 *
 * - 默认对所有字形去除重叠（removeOverlap: true），contourStorage: 'cff'。
 * - 彩色模式走 ExportColorFontService（COLR/CPAL）。
 * - 字体通过 FontFace 注册给 canvas fillText 使用；parsed 供轮廓渲染/SVG 提取。
 * - 页面卸载时调用 dispose()（或重建时自动释放旧 face）。
 */

export interface FontLibrary {
  buffer: ArrayBuffer
  family: string
  face: FontFace
  /** fontManager parse 结果（轮廓/度量/SVG 提取用） */
  parsed: ReturnType<typeof parse>
  dispose: () => void
}

let currentLibrary: FontLibrary | null = null

/** 上次构建字库的缓存键（参照排版预览 typesetting_font_v2_${fileUUID}，按工程文件隔离） */
export function applicationFontCacheKey(fileUUID: string): string {
  return `application_font_${fileUUID}`
}

/** 读取上次缓存的字库（存在则进入时可选择「使用上次缓存字体」） */
export async function getCachedApplicationFont(fileUUID: string): Promise<ArrayBuffer | null> {
  try {
    const buffer = await indexedDBManager.get<ArrayBuffer>(applicationFontCacheKey(fileUUID))
    return buffer && buffer.byteLength > 0 ? buffer : null
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[applications] read cached font failed:', err)
    }
    return null
  }
}

/** 写入上次构建的字库缓存（后台写，不阻塞） */
export function storeCachedApplicationFont(fileUUID: string, buffer: ArrayBuffer): void {
  indexedDBManager.set(applicationFontCacheKey(fileUUID), buffer).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[applications] write cached font failed:', err)
    }
  })
}

function flushEditingCharacter(): void {
  const projectStore = useProjectStore()
  const characterStore = useCharacterStore()
  const file = projectStore.selectedFile
  if (!file) return
  const editingUUID = characterStore.editingCharacterUUID
  const editing = characterStore.editingCharacter
  if (editingUUID && editing) {
    // 与排版预览 writeFileSnapshot 同款逻辑：先落库再构建，保证读到最新编辑数据
    characterDataManager
      .updateCharacter(file.uuid, JSON.parse(JSON.stringify(editing)))
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[applications] flush editing character failed:', err)
        }
      })
  }
}

function disposeCurrent(): void {
  if (currentLibrary) {
    try {
      document.fonts.delete(currentLibrary.face)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[applications] dispose font face failed:', err)
      }
    }
    currentLibrary = null
  }
}

export async function buildFontLibrary(options: {
  /** 彩色字体（logo 彩色模式） */
  colorFont?: boolean
  /** 每个应用唯一的 family 后缀 */
  familySuffix?: string
  onProgress?: (done: number, total: number) => void
}): Promise<FontLibrary> {
  const { colorFont = false, familySuffix = 'default', onProgress } = options

  const projectStore = useProjectStore()
  const characterStore = useCharacterStore()
  const file = projectStore.selectedFile
  if (!file) {
    throw new Error('no project opened')
  }

  flushEditingCharacter()

  const ctx = {
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    onProgress,
  }

  // 静音构建日志：逐字符脚本执行会刷大量 console.log，且 Tauri webview 输出极慢
  // （与 TypesettingPreviewPage 同款处理）
  const originalLog = console.log
  console.log = () => {}
  let buffer: ArrayBuffer
  try {
    buffer = colorFont
      ? await buildExportColorFontBuffer(file, ctx, { removeOverlap: true })
      : await buildExportFontBuffer(file, ctx, { contourStorage: 'cff', removeOverlap: true })
  } finally {
    console.log = originalLog
  }

  // 构建结果写入按工程文件的缓存，供下次进入复用（参照排版预览）
  storeCachedApplicationFont(file.uuid, buffer)

  const family = `fp-app-${familySuffix}`

  // 同 family 重建时先删旧 face
  if (currentLibrary && currentLibrary.family === family) {
    disposeCurrent()
  }

  const face = new FontFace(family, buffer)
  await face.load()
  document.fonts.add(face)

  const parsed = parse(buffer)

  currentLibrary = {
    buffer,
    family,
    face,
    parsed,
    dispose: () => {
      if (currentLibrary?.family === family) {
        disposeCurrent()
      }
    },
  }

  return currentLibrary
}

/**
 * 从已保存的字体副本（doc.fontBuffer）注册字库——编辑已有应用时，
 * 画布用该应用上次保存的字体渲染；保存时再重建并覆盖。
 */
export async function loadFontLibraryFromBuffer(
  buffer: ArrayBuffer,
  familySuffix: string
): Promise<FontLibrary> {
  const family = `fp-app-${familySuffix}`
  if (currentLibrary && currentLibrary.family === family) {
    disposeCurrent()
  }
  const face = new FontFace(family, buffer)
  await face.load()
  document.fonts.add(face)

  const parsed = parse(buffer)
  currentLibrary = {
    buffer,
    family,
    face,
    parsed,
    dispose: () => {
      if (currentLibrary?.family === family) {
        disposeCurrent()
      }
    },
  }
  return currentLibrary
}

export function getCurrentFontLibrary(): FontLibrary | null {
  return currentLibrary
}

/** 页面卸载统一调用 */
export function disposeFontLibrary(): void {
  disposeCurrent()
}
