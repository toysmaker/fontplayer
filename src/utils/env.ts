/**
 * 环境检测工具
 */

/**
 * 检测是否在 Tauri 环境中
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
}

/**
 * 获取当前环境
 */
export function getEnv(): 'web' | 'tauri' {
  return isTauri() ? 'tauri' : 'web'
}
