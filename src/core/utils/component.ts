/**
 * 组件工具函数
 */

/**
 * 根据 UUID 查找组件或组
 */
export function selectedItemByUUID<T extends { uuid: string }>(
  items: Array<T> | undefined | null,
  uuid: string
): T | null {
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    if (items[i].uuid === uuid) {
      return items[i]
    }
  }
  return null
}
