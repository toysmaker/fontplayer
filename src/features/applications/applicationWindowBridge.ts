/**
 * 应用窗口桥（参照 typesettingPreviewBridge）：
 * - 「应用」子选项在独立窗口打开（Tauri：WebviewWindow 单例；web：window.open）
 * - 打开前把当前工程快照写入 IndexedDB（同 origin 跨窗口共享），
 *   应用窗口从快照恢复工程（projectStore.addFile + selectFile）
 * - 字符数据经由 CharacterDataManager 直接读写共享 IndexedDB，无需额外通道
 */

import { getEnv } from '@/utils/env'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { broadcastApplicationsUpdated } from './applicationChannel'
import type { ApplicationType } from './types'

const WINDOW_LABELS: Record<ApplicationType, string> = {
  card: 'application-card',
  logo: 'application-logo',
  avatar: 'application-avatar',
}

const windowOpenFlags: Record<ApplicationType, boolean> = {
  card: false,
  logo: false,
  avatar: false,
}

export function getApplicationWindowLabel(type: ApplicationType): string {
  return WINDOW_LABELS[type]
}

/** 应用窗口的工程快照键（fileUUID 隔离） */
export function generateApplicationKeys(fileUUID: string) {
  return {
    file: `application_file_${fileUUID}`,
  }
}

/** 当前编辑字符落库 + 工程快照写 IndexedDB（跨窗口共享） */
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
        console.warn('[applications] flush editing character failed:', err)
      }
    }
  }

  await indexedDBManager.set(generateApplicationKeys(fileUUID).file, JSON.stringify(file))
}

/** 最近一次恢复的工程 UUID（同窗口内列表页 ↔ 编辑页切换时复用） */
let lastRestoredFileUUID = ''

export function getRestoredFileUUID(): string {
  return lastRestoredFileUUID
}

/** 应用窗口内：从快照恢复工程到 store（返回是否成功） */
export async function restoreApplicationProject(fileUUID: string): Promise<boolean> {
  const projectStore = useProjectStore()
  if (fileUUID) lastRestoredFileUUID = fileUUID
  try {
    // 已恢复过（同窗口内列表页 ↔ 编辑页切换）则直接返回
    if (projectStore.selectedFile?.uuid === fileUUID) return true
    const raw = await indexedDBManager.get<string>(generateApplicationKeys(fileUUID).file)
    if (!raw) return false
    const file = JSON.parse(raw)
    projectStore.addFile(file)
    projectStore.selectFile(file.uuid)
    return true
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[applications] restore project failed:', err)
    }
    return false
  }
}

/**
 * 应用数据变更后：把最新工程快照写回 IndexedDB（本窗口/下次打开的应用窗口
 * 都能读到），并广播给主窗口合并进工程数据。
 */
export function pushApplicationFileUpdate(fileUUID: string): void {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file || file.uuid !== fileUUID) return
  indexedDBManager
    .set(generateApplicationKeys(fileUUID).file, JSON.stringify(file))
    .catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[applications] push snapshot failed:', err)
      }
    })
  if (file.applications) {
    broadcastApplicationsUpdated(fileUUID, file.applications)
  }
}

/** 关闭当前应用窗口（应用页返回按钮；主窗口不经过此路径） */
export async function closeApplicationWindow(): Promise<void> {
  if (getEnv() === 'tauri') {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    if (win.label === 'main') return
    await win.close()
    return
  }
  window.close()
}

/**
 * 主窗口侧：从 IndexedDB 快照合并应用数据。
 * BroadcastChannel 在 Tauri 多 WKWebView 间可能不可靠，快照（IDB）是
 * 已验证的跨窗口通道——打开应用窗口前先合并，保证保存的应用不丢。
 */
async function mergeApplicationsFromSnapshot(fileUUID: string): Promise<void> {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file || file.uuid !== fileUUID) return
  try {
    const raw = await indexedDBManager.get<string>(generateApplicationKeys(fileUUID).file)
    if (!raw) return
    const snapshot = JSON.parse(raw) as { applications?: unknown }
    if (!snapshot.applications) return
    const current = JSON.stringify(file.applications ?? {})
    const incoming = JSON.stringify(snapshot.applications)
    if (current !== incoming) {
      file.applications = snapshot.applications as never
      projectStore.markFileUnsaved(file.uuid)
      if (import.meta.env.DEV) {
        console.log('[applications] merged applications from snapshot')
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[applications] merge snapshot failed:', err)
    }
  }
}

/** 打开（或聚焦）应用子选项窗口 */
export async function openApplicationWindow(type: ApplicationType): Promise<void> {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file) return

  const label = WINDOW_LABELS[type]
  const hashBase = `${location.origin}${location.pathname}`
  // 点开子选项先进入应用列表（添加新应用按钮进入创建/编辑界面）
  const url = `${hashBase}#/applications/${type}?file=${file.uuid}`

  // 先合并快照中的应用数据（保存/删除后关窗重开不丢），再写最新快照
  await mergeApplicationsFromSnapshot(file.uuid)

  if (getEnv() === 'web') {
    await writeFileSnapshot(file.uuid)
    const popup = window.open(
      url,
      label,
      `popup,width=1280,height=800,left=${(screen.width - 1280) / 2},top=${(screen.height - 800) / 2}`,
    )
    popup?.focus()
    return
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

  // 单例：已存在则聚焦（防止主窗口重载后 flag 失真导致重复创建）
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    try {
      await existing.unminimize()
      await existing.setFocus()
    } catch {
      /* ignore */
    }
    windowOpenFlags[type] = true
    return
  }

  await writeFileSnapshot(file.uuid)

  const { i18n } = await import('@/i18n')
  const w = new WebviewWindow(label, {
    url,
    width: 1280,
    height: 800,
    x: (screen.width - 1280) / 2,
    y: (screen.height - 800) / 2,
    title: i18n.global.t(`applications.listPage.title.${type}`),
  })
  windowOpenFlags[type] = true
  w.once('tauri://destroyed', () => {
    windowOpenFlags[type] = false
  })
}
