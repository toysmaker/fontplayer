/**
 * 应用数据跨窗口同步通道（BroadcastChannel）：
 * - 应用窗口保存/删除应用后广播，主窗口合并进工程数据（projectStore.selectedFile.applications）
 * - 应用列表随工程保存/导出持久化；不保存工程则仅存在于内存
 */

import { useProjectStore } from '@/stores/project'
import type { IFileApplications } from '@/core/types'

const CHANNEL_NAME = 'fontplayer-applications'

export interface ApplicationsUpdateMessage {
  type: 'applications-updated'
  fileUUID: string
  applications: IFileApplications
}

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
  }
  return channel
}

/** 应用窗口侧：广播应用列表更新 */
export function broadcastApplicationsUpdated(fileUUID: string, applications: IFileApplications): void {
  try {
    const message: ApplicationsUpdateMessage = { type: 'applications-updated', fileUUID, applications }
    getChannel().postMessage(message)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[applications] broadcast failed:', err)
    }
  }
}

/** 主窗口侧：监听并合并到工程数据（保存工程/导出工程即持久化） */
export function initApplicationChannel(): void {
  try {
    getChannel().onmessage = (event: MessageEvent<ApplicationsUpdateMessage>) => {
      const msg = event.data
      if (!msg || msg.type !== 'applications-updated') return
      const projectStore = useProjectStore()
      const file = projectStore.files.find((f) => f.uuid === msg.fileUUID)
      if (!file) return
      const current = JSON.stringify(file.applications ?? {})
      const incoming = JSON.stringify(msg.applications)
      if (current !== incoming) {
        file.applications = msg.applications
        // 标记工程未保存（保存工程/导出工程时才落盘）
        projectStore.markFileUnsaved(file.uuid)
        if (import.meta.env.DEV) {
          console.log('[applications] main window merged applications for', file.uuid)
        }
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[applications] channel init failed:', err)
    }
  }
}
