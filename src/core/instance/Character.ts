/**
 * Character 类
 * 字符实例，提供字符操作 API
 * 
 * 注意：这个类应该只在编辑时实例化，通过 InstanceManager 管理
 */

import type { ICharacterFileLite, ICustomGlyph, IComponent } from '../types'
import { CustomGlyph } from './CustomGlyph'
import type { IInstance } from './InstanceManager'

export class Character implements IInstance {
  public uuid: string
  public type: 'character' = 'character'
  public lastUsed: number = Date.now()
  
  private _character: ICharacterFileLite

  constructor(character: ICharacterFileLite) {
    this._character = character
    this.uuid = character.uuid
  }

  /**
   * 获取组件
   */
  getComponent(name: string): IComponent | null {
    for (let i = 0; i < this._character.components.length; i++) {
      if (this._character.components[i].name === name) {
        return this._character.components[i]
      }
    }
    return null
  }

  /**
   * 获取字形（通过组件名）
   */
  getGlyph(name: string): any {
    for (let i = 0; i < this._character.components.length; i++) {
      const component = this._character.components[i]
      if (component.name === name && component.type === 'glyph') {
        // Do not attach instances to glyph data; use InstanceManager from call site if needed.
        return null
      }
    }
    return null
  }

  /**
   * 获取布局节点（通过 ID）
   */
  getLayoutByID(id: string): any {
    if (this._character.info && this._character.info.layoutTree) {
      const tree = this._character.info.layoutTree
      return getNodeByID(id, tree)
    }
    return null
  }

  /**
   * 获取坐标
   */
  getCoords(layout: any, col: number, row: number, n: number): { x: number; y: number } {
    const rect = layout.rect
    const { x, y, w, h } = rect
    const _x = x + (w / n) * col
    const _y = y + (h / n) * row
    return { x: _x, y: _y }
  }

  /**
   * 获取比例坐标
   */
  getRatioCoords(layout: any, col: number, row: number, n: number): { x: number; y: number } {
    // TODO: 实现比例坐标计算
    // 需要从原代码迁移 getRatioCoords 函数
    const { dx, dy, size, centerSquareSize } = this._character.info?.gridSettings || {
      dx: 0,
      dy: 0,
      size: 1000,
      centerSquareSize: 1000 / 3,
    }
    
    const x1 = Math.round((size - centerSquareSize) / 2) + dx
    const x2 = Math.round((size - centerSquareSize) / 2 + centerSquareSize) + dx
    const y1 = Math.round((size - centerSquareSize) / 2) + dy
    const y2 = Math.round((size - centerSquareSize) / 2 + centerSquareSize) + dy
    
    // TODO: 调用 getRatioCoords 函数
    // return getRatioCoords(layout, col, row, n, { x1, x2, y1, y2, l: size })
    
    // 临时实现
    return { x: 0, y: 0 }
  }

  /**
   * 获取比例布局
   */
  getRatioLayout(value: any): any {
    // TODO: 实现比例布局获取
    // 需要从原代码迁移 getCharacterRatioLayout 函数
    return null
  }

  /**
   * 清理资源
   */
  cleanup() {
  }

  /**
   * 获取字符数据
   */
  getCharacter(): ICharacterFileLite {
    return this._character
  }

  /**
   * 获取参数
   */
  getParam(name: string): number {
    return null
  }

  /**
   * 获取字形（通过 ID）
   */
  getGlyphByID(id: string): ICustomGlyph | null {
    return null
  }

  /**
   * 获取字形（通过外层组件名称）
   */
  getGlyphByComponentName(name: string): CustomGlyph | null {
    return null
  }

  /**
   * 获取字形（通过外层组件ID）
   */
  getGlyphByComponentID(id: string): CustomGlyph | null {
    return null
  }

  /**
   * 获取字形实例（通过字形名称）
   */
  getGlyphInstance(name: string): CustomGlyph | null {
    return null
  }

  /**
   * 获取字形实例（通过字形ID）
   */
  getGlyphInstanceByID(id: string): CustomGlyph | null {
    return null
  }

  /**
   * 获取字形实例（通过外层组件名称）
   */
  getGlyphInstanceByComponentName(name: string): CustomGlyph | null {
    return null
  }

  /**
   * 获取字形实例（通过外层组件ID）
   */
  getGlyphInstanceByComponentID(id: string): CustomGlyph | null {
    return null
  }

  /**
   * 清除所有组件
   */
  clearComponents(): void {
  }

  /**
   * 移除组件（通过名称）
   */
  removeComponent(name: string): void {
  }

  /**
   * 移除组件（通过 ID）
   */
  removeComponentByID(id: string): void {
  }

  /**
   * 组件选择器（通过名称、ID、字形名称、字形ID），选择符合条件的所有组件
   */
  selectComponents(options: { name: string, id: string, glyphName: string, glyphID: string }): void {
  }

  /**
   * 添加包含指定名称或id字形的组件，如果有多个满足条件的字形，选择第一个
   * 参数：
   * - componentName: 将要添加的组件名称
   * - glyphName: 组件包含的字形名称
   * - glyphID: 组件包含的字形ID
   * - glyphStyleTag: 组件包含的字形样式标签
   * - ox: 组件ox
   * - oy: 组件oy
   */
  addGlyphComponent(options: { componentName: string, glyphName: string, glyphID: string, glyphStyleTag: string }): void {
    return null
  }
}

/**
 * 在树中查找节点（通过 ID）
 */
function getNodeByID(id: string, tree: any[]): any {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node.id === id) {
      return node
    } else if (node.children) {
      const found = getNodeByID(id, node.children)
      if (found) {
        return found
      }
    }
  }
  return null
}
