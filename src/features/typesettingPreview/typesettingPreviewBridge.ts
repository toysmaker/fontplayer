/**
 * 排版预览窗口桥接
 *
 * 从主窗口打开「排版预览」窗口（单例：已打开则聚焦不新建），
 * 并把工程快照与当前编辑字符写入 IndexedDB 供预览窗口使用。
 * 预览窗口与主窗口不共享 pinia 状态，唯一数据通道是 IndexedDB（同 origin 共享）。
 */
import { getEnv } from '@/utils/env'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { characterDataManager } from '@/core/storage/CharacterDataManager'

const TYPESETTING_WINDOW_LABEL = 'typesetting-preview'

let hasShowWindow = false

export function getTypesettingWindowOpen(): boolean {
  return hasShowWindow
}

function resetTypesettingWindowFlag() {
  hasShowWindow = false
}

/** 排版预览相关 IndexedDB 键（fileUUID 隔离，切换工程后自然重新生成） */
export function generateTypesettingKeys(fileUUID: string) {
  return {
    file: `typesetting_file_${fileUUID}`,
    // v2：字库构建修复（脚本字形注册）后旧缓存作废，强制重建一次
    font: `typesetting_font_v2_${fileUUID}`,
  }
}

/**
 * 写工程快照到 IndexedDB：
 * - 先把当前正在编辑的字符落库（预览窗口无 pinia 编辑态，重建字体时只能读 IDB，
 *   不落库则正在编辑的字符在预览中是旧数据）
 * - 工程文件存 JSON 字符串（防 DataCloneError，且稳定可反序列化）
 */
async function writeFileSnapshot(fileUUID: string): Promise<void> {
  const projectStore = useProjectStore()
  const characterStore = useCharacterStore()
  const file = projectStore.selectedFile
  if (!file) return

  const editingUUID = characterStore.editingCharacterUUID
  const editing = characterStore.editingCharacter
  if (editingUUID && editing) {
    try {
      await characterDataManager.updateCharacter(fileUUID, JSON.parse(JSON.stringify(editing)))
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[typesettingPreview] flush editing character failed:', err)
      }
    }
  }

  await indexedDBManager.set(generateTypesettingKeys(fileUUID).file, JSON.stringify(file))
}

export async function openTypesettingPreviewWindow(): Promise<void> {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file) return

  const hashBase = `${location.origin}${location.pathname}`
  const url = `${hashBase}#/typesetting-preview?file=${file.uuid}`

  if (getEnv() === 'web') {
    // 先写快照再开窗口，避免预览窗口挂载时快照尚未写入的竞态
    await writeFileSnapshot(file.uuid)
    // 命名窗口天然复用已打开的窗口
    const popup = window.open(
      url,
      TYPESETTING_WINDOW_LABEL,
      `popup,width=1280,height=800,left=${(screen.width - 1280) / 2},top=${(screen.height - 800) / 2}`,
    )
    popup?.focus()
    return
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

  // 单例：优先按 label 查找已有窗口（不依赖模块级 flag，
  // 防止主窗口重载后 flag 失真导致重复创建抛错），存在则聚焦
  const existing = await WebviewWindow.getByLabel(TYPESETTING_WINDOW_LABEL)
  if (existing) {
    try {
      await existing.unminimize()
      await existing.setFocus()
    } catch {
      /* ignore */
    }
    hasShowWindow = true
    return
  }

  await writeFileSnapshot(file.uuid)

  const { i18n } = await import('@/i18n')
  const w = new WebviewWindow(TYPESETTING_WINDOW_LABEL, {
    url,
    width: 1280,
    height: 800,
    x: (screen.width - 1280) / 2,
    y: (screen.height - 800) / 2,
    title: i18n.global.t('typesetting.windowTitle'),
  })
  hasShowWindow = true
  w.once('tauri://destroyed', () => resetTypesettingWindowFlag())
}
