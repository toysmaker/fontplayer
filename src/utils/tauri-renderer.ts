/**
 * Tauri 渲染器初始化
 */
import { isTauri } from '@/utils/env'

export function initTauri() {
  // 检查是否在 Tauri 环境中
  if (isTauri()) {
    // Tauri 特定初始化逻辑
    console.log('Tauri environment detected')
    
    // 设置全局环境标识
    if (typeof window !== 'undefined') {
      (window as any).__is_web = false
    }
  } else {
    // Web 环境
    console.log('Web environment')
    
    // 设置全局环境标识
    if (typeof window !== 'undefined') {
      (window as any).__is_web = true
    }
  }
}
