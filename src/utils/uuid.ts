/**
 * UUID 生成工具函数
 */

/**
 * 生成 UUID
 */
export function genUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
