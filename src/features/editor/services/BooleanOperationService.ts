/**
 * 组件布尔运算服务（并集/交集/差集）
 * 基于 paper.js + RemoveOverlapService 的路径转换逻辑实现
 */
import paper from 'paper'
import { ContourConverter } from '@/core/font/converter'
import type { IComponent } from '@/core/types'
import { createOptimizedPath, pathToEditingPenComponents } from './RemoveOverlapService'

export type BooleanOp = 'union' | 'intersect' | 'subtract'

/**
 * 将组件列表转换为 paper.Path 数组。
 * ContourConverter 递归展开 glyph 组件（包含脚本组件+普通组件）。
 */
function componentsToPaperPaths(components: IComponent[]): paper.Path[] {
  const allContours = ContourConverter.componentsToContoursEditing(components, { x: 0, y: 0 })
  return allContours.map((c) => createOptimizedPath(c))
}

/**
 * 将 paper 布尔运算结果转为 pen component。
 * 结果可能是 Path 或 CompoundPath，pathToEditingPenComponents 通过 children 递归处理两者。
 */
/**
 * 将 paper 布尔运算结果转为 pen component 数组。
 * CompoundPath 的每个子路径独立为一个组件（差集可能产生多个分离的片段）。
 */
function resultToPenComponents(result: paper.PathItem, prefix: string, generateUUID: () => string): IComponent[] {
  const results: IComponent[] = []
  const children = (result as any).children
  if (children) {
    for (const child of children) {
      if (child instanceof paper.Path) {
        const comps = pathToEditingPenComponents(child as paper.Path)
        for (const c of comps) {
          c.name = `${prefix}_${results.length}`
          c.uuid = generateUUID()
          results.push(c as IComponent)
        }
      }
    }
  } else {
    const comps = pathToEditingPenComponents(result as paper.Path)
    for (const c of comps) {
      c.name = `${prefix}_${results.length}`
      c.uuid = generateUUID()
      results.push(c as IComponent)
    }
  }
  return results
}

/**
 * 对选中的组件执行布尔运算。
 * @returns 新生成的 pen component 数组（差集可能产生多个分离片段），失败返回空数组
 */
export function applyBooleanOperation(
  components: IComponent[],
  operation: BooleanOp,
  generateUUID: () => string,
): IComponent[] {
  if (operation !== 'union' && components.length < 2) return []
  if (components.length < 1) return []

  try {
    const paths = componentsToPaperPaths(components)
    if (paths.length === 0) return []

    let result: paper.PathItem = paths[0]

    if (operation === 'union') {
      for (let i = 1; i < paths.length; i++) {
        result = result.unite(paths[i]) as paper.PathItem
      }
    } else if (operation === 'intersect') {
      for (let i = 1; i < paths.length; i++) {
        result = result.intersect(paths[i]) as paper.PathItem
      }
    } else if (operation === 'subtract') {
      for (let i = 1; i < paths.length; i++) {
        result = result.subtract(paths[i]) as paper.PathItem
      }
    }

    if (!result || result.isEmpty?.()) return []
    const uuid = generateUUID()
    return resultToPenComponents(result, `boolean_${operation}_${uuid.slice(0, 6)}`, generateUUID)
  } catch (e) {
    console.error(`[BooleanOp] ${operation} failed:`, e)
    return []
  }
}
