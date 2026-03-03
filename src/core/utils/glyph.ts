/**
 * 字形工具函数
 * 从原代码迁移的字形相关工具函数
 */

import type { ICustomGlyph, IComponent } from '../types'

/**
 * 根据 UUID 查找组件或组
 */
function selectedItemByUUID(
  items: Array<{ uuid: string }>,
  uuid: string
): any | null {
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    if (items[i].uuid === uuid) {
      return items[i]
    }
  }
  return null
}

/**
 * 获取字形的有序组件列表（包含组件本身）
 * 根据 orderedList 从 components 或 groups 中查找对应的组件
 */
export function orderedListWithItemsForGlyph(glyph: ICustomGlyph): IComponent[] {
  if (!glyph.orderedList || !Array.isArray(glyph.orderedList)) {
    return glyph.components || []
  }

  return glyph.orderedList.map((item: { type: string; uuid: string }) => {
    if (item.type === 'group') {
      // 如果是组，从 groups 中查找
      if (glyph.groups) {
        return selectedItemByUUID(glyph.groups, item.uuid)
      }
      return null
    } else {
      // 如果是组件，从 components 中查找
      if (glyph.components) {
        return selectedItemByUUID(glyph.components, item.uuid)
      }
      return null
    }
  }).filter((item): item is IComponent => item !== null)
}
