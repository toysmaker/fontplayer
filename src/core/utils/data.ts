/**
 * 数据处理工具函数
 */

/**
 * 将列表转换为Map（以指定key为索引）
 */
export function listToMap<T extends Record<string, any>>(
  list: Array<T>,
  key: string
): Record<string, T> {
  const map: Record<string, T> = {}
  list.forEach((item: T) => {
    map[item[key]] = item
  })
  return map
}
