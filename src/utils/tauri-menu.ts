/**
 * Tauri 原生菜单初始化
 * 仅在 Tauri 环境中使用
 */

import { isTauri } from '@/utils/env'

/**
 * 初始化 Tauri 原生菜单
 * 注意：在 Tauri 2.x 中，菜单在 Rust 端直接初始化
 * 前端只需要监听菜单事件即可
 */
export async function initTauriMenu() {
  if (!isTauri()) {
    console.warn('initTauriMenu: Not in Tauri environment')
    return
  }

  try {
    // 同步菜单语言（确保菜单语言与前端 i18n 一致）
    const { invoke } = await import('@tauri-apps/api/core')
    const { i18n } = await import('@/i18n')
    // 访问 i18n 的 locale，vue-i18n 的 locale 是一个 Ref<string>
    const localeRef = i18n.global.locale
    const currentLocale = typeof localeRef === 'string' ? localeRef : (localeRef as { value: string }).value || 'zh'
    await invoke('update_menu_language', { language: currentLocale })
    
    // 监听菜单事件
    const { listen } = await import('@tauri-apps/api/event')
    
    // 监听文件菜单事件
    // 注意：这些事件名称需要与 Rust 端发送的事件名称匹配
    // 在 Tauri 2.x 中，菜单事件通过 app.emit() 发送
    listen('create-file', async () => {
      console.log('File -> New')
      try {
        const { useProjectStore } = await import('@/stores/project')
        const projectStore = useProjectStore()
        
        // 检查是否已有工程打开
        if (projectStore.hasFiles) {
          // 通过事件通知 UI 层显示警告消息
          window.dispatchEvent(new CustomEvent('show-warning-message', {
            detail: {
              message: '目前字玩仅支持同时编辑一个工程，请关闭当前工程再新建。注意，关闭工程前请保存工程以避免数据丢失。'
            }
          }))
          return
        }
        
        // 显示新建工程对话框
        // 注意：在 Tauri 环境中，需要通过事件或全局状态来触发对话框显示
        // 这里可以通过 window 对象或事件总线来通知 UI 显示对话框
        window.dispatchEvent(new CustomEvent('show-new-project-dialog'))
      } catch (error) {
        console.error('Failed to handle create-file event:', error)
      }
    })
    
    listen('open-file', async () => {
      console.log('File -> Open')
      try {
        const { fileHandler } = await import('@/features/editor/services/FileHandler')
        await fileHandler.openFile()
      } catch (error) {
        console.error('Failed to handle open-file event:', error)
      }
    })
    
    listen('save-file', async () => {
      console.log('File -> Save')
      try {
        const { fileHandler } = await import('@/features/editor/services/FileHandler')
        await fileHandler.saveProjectTauriRememberPath()
      } catch (error) {
        console.error('Failed to handle save-file event:', error)
      }
    })
    
    listen('save-as', async () => {
      console.log('File -> Save As')
      try {
        const { fileHandler } = await import('@/features/editor/services/FileHandler')
        await fileHandler.saveProjectTauriAs()
      } catch (error) {
        console.error('Failed to handle save-as event:', error)
      }
    })
    
    listen('export-font-file', () => {
      console.log('File -> Export Font')
      // TODO: 实现导出字体逻辑
    })
    
    listen('export-svg', () => {
      console.log('File -> Export SVG')
      // TODO: 实现导出 SVG 逻辑
    })
    
    // 监听编辑菜单事件
    listen('undo', () => {
      console.log('Edit -> Undo')
      // TODO: 实现撤销逻辑
    })
    
    listen('redo', () => {
      console.log('Edit -> Redo')
      // TODO: 实现重做逻辑
    })
    
    listen('cut', () => {
      window.dispatchEvent(new CustomEvent('editor-cut'))
    })
    
    listen('copy', () => {
      window.dispatchEvent(new CustomEvent('editor-copy'))
    })
    
    listen('paste', () => {
      window.dispatchEvent(new CustomEvent('editor-paste'))
    })
    
    listen('delete', () => {
      window.dispatchEvent(new CustomEvent('editor-delete'))
    })

    // 监听字符菜单事件
    listen('add-character', () => {
      console.log('Character -> Add Character')
      window.dispatchEvent(new CustomEvent('editor-add-character'))
    })

    listen('add-icon', () => {
      console.log('Character -> Add Icon')
      window.dispatchEvent(new CustomEvent('editor-add-icon'))
    })
    
    console.log('Tauri menu event listeners initialized')
  } catch (error) {
    console.error('Failed to initialize Tauri menu listeners:', error)
  }
}
