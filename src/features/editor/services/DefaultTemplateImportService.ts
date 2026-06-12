/**
 * 桌面端：从打包资源加载默认模板 .fpz 并打开为工程。
 */

import { isTauri } from '@/utils/env'
import { projectLoader } from '@/features/editor/services/ProjectLoader'
import { useProjectStore } from '@/stores/project'

/** Tauri bundle.resources 中的相对路径（见 tauri.conf.json） */
export const BUNDLED_DEFAULT_TEMPLATE_RESOURCE = 'resources/default-template.fpz'

export async function readBundledDefaultTemplateFpzBytes(): Promise<ArrayBuffer> {
  if (!isTauri()) {
    throw new Error('Bundled template is only available in the desktop app')
  }
  const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
  const u8 = await readFile(BUNDLED_DEFAULT_TEMPLATE_RESOURCE, { baseDir: BaseDirectory.Resource })
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
}

/**
 * 读取 .fpz 并加入工程列表、选中；需在编辑器路由下调用以便显示进度条。
 */
export async function importBundledDefaultTemplate(): Promise<void> {
  const buf = await readBundledDefaultTemplateFpzBytes()
  const projectFile = await projectLoader.loadProjectFromFpzArrayBuffer(buf)
  projectFile.tag = '字玩标准黑体'
  const store = useProjectStore()
  const ok = store.addFile(projectFile)
  if (!ok) {
    throw new Error('Failed to add template project to list')
  }
  store.selectFile(projectFile.uuid)
}
