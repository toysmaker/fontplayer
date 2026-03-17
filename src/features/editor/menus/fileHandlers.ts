import { useProjectStore } from '@/stores/project'
import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'

/**
 * 文件相关菜单 handlers：
 * - create-file
 * - open-file
 * - save-file
 * - clear-cache
 * - sync-data
 * - save-as-json
 *
 * 这里尽量不直接操作具体组件的 ref，而是通过事件或 store 来驱动 UI。
 */
export function createFileHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const projectStore = useProjectStore()

  const handleCreateFile = async () => {
    try {
      if (projectStore.hasFiles) {
        ctx.message.warning(ctx.t('panels.editorSidebar.onlyOneProjectWarning'))
        return
      }
      // 通过事件让具体 UI（例如 EditorSidebar）打开新建工程对话框
      window.dispatchEvent(new CustomEvent('editor-show-new-project-dialog'))
    } catch (error) {
      console.error('Failed to create new project:', error)
    }
  }

  const handleOpenFile = async () => {
    try {
      await ctx.fileHandler.openFile()
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }

  const handleSaveFile = async () => {
    try {
      // 左侧栏“缓存工程”按钮：无论是否在 Tauri，都使用缓存逻辑
      await ctx.fileHandler.cacheProjectToWeb()
      ctx.message.success(ctx.t('panels.editorSidebar.cacheSuccess'))
    } catch (error) {
      console.error('Failed to cache project:', error)
      ctx.message.error((error as Error).message || '缓存工程失败')
    }
  }

  const handleClearCache = async () => {
    try {
      await ctx.fileHandler.clearProjectCache()
      ctx.message.success(ctx.t('panels.editorSidebar.clearCacheSuccess'))
    } catch (error) {
      console.error('Failed to clear cache:', error)
      ctx.message.error((error as Error).message || '清空缓存失败')
    }
  }

  const handleSyncData = async () => {
    try {
      await ctx.fileHandler.syncProjectFromCache()
      ctx.message.success(ctx.t('panels.editorSidebar.syncCacheSuccess'))
    } catch (error) {
      console.error('Failed to sync cache:', error)
      ctx.message.error((error as Error).message || '同步缓存失败')
    }
  }

  const handleSaveAsJson = async () => {
    try {
      await ctx.fileHandler.exportProject()
    } catch (error) {
      console.error('Failed to export project:', error)
      ctx.message.error((error as Error).message || '导出工程失败')
    }
  }

  return {
    'create-file': handleCreateFile,
    'open-file': handleOpenFile,
    'save-file': handleSaveFile,
    'clear-cache': handleClearCache,
    'sync-data': handleSyncData,
    'save-as-json': handleSaveAsJson,
  }
}

