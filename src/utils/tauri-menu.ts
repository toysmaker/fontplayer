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
    
    listen('open-file', () => {
      console.log('File -> Open')
      // TODO: 实现打开工程逻辑
    })
    
    listen('save-file', () => {
      console.log('File -> Save')
      // TODO: 实现保存工程逻辑
    })
    
    listen('save-as', () => {
      console.log('File -> Save As')
      // TODO: 实现另存为逻辑
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
      console.log('Edit -> Cut')
      // TODO: 实现剪切逻辑
    })
    
    listen('copy', () => {
      console.log('Edit -> Copy')
      // TODO: 实现复制逻辑
    })
    
    listen('paste', () => {
      console.log('Edit -> Paste')
      // TODO: 实现粘贴逻辑
    })
    
    listen('delete', () => {
      console.log('Edit -> Delete')
      // TODO: 实现删除逻辑
    })
    
    console.log('Tauri menu event listeners initialized')
  } catch (error) {
    console.error('Failed to initialize Tauri menu listeners:', error)
  }
}
