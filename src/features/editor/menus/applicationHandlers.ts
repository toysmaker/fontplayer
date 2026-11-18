import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import { openApplicationWindow } from '@/features/applications/applicationWindowBridge'
import type { ApplicationType } from '@/features/applications/types'

/**
 * 「应用」菜单（卡片、屏保与壁纸 / Logo / 头像）handlers。
 *
 * 参照排版预览：在独立窗口打开（Tauri：WebviewWindow 单例；web：window.open），
 * 打开前把工程快照写入 IndexedDB 供应用窗口恢复，主窗口不做路由跳转。
 */
export function createApplicationHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, message, t } = ctx

  const openApplication = async (type: ApplicationType) => {
    if (!projectStore.selectedFile) {
      message.warning(t('applications.listPage.noProject'))
      return
    }
    await openApplicationWindow(type)
  }

  return {
    'application-card': () => openApplication('card'),
    'application-logo': () => openApplication('logo'),
    'application-avatar': () => openApplication('avatar'),
  }
}
