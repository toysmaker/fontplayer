/**
 * 主题工具函数
 * 用于读取 CSS 变量值，供 Naive UI 主题系统使用
 */

/**
 * 读取 CSS 变量的实际值
 * @param varName CSS 变量名（如 '--primary-0'）
 * @param defaultValue 默认值（如果读取失败）
 * @returns 颜色值（如 '#153063'）
 */
export function getCSSVariable(varName: string, defaultValue: string): string {
  if (typeof window === 'undefined') {
    return defaultValue
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  return value || defaultValue
}
