/**
 * Character 类
 * 字符实例，提供字符操作 API 供字符脚本使用
 *
 * 通过 InstanceManager 管理生命周期，避免内存泄漏
 */

import type { ICharacterFileLite, ICustomGlyph, IComponent, IParameter } from '../types'
import { ParameterType } from '../types'
import { CustomGlyph } from './CustomGlyph'
import { instanceManager } from './InstanceManager'
import type { IInstance } from './InstanceManager'
import { genUUID } from '@/utils/uuid'
import { getGlobalConstantsMap } from '../script/ParametersMap'
import { useProjectStore } from '@/stores/project'

/** 查找工程文件中所有字形表 */

/** 字形别名：脚本中使用的名称与工程中实际字形名不一致时使用 */
const GLYPH_NAME_ALIASES: Record<string, string> = {
  '脸形': '脸型',
}

function findGlyphInProject(name: string): ICustomGlyph | null {
  const file = useProjectStore().selectedFile
  if (!file) return null

  // 构建搜索名称列表（原名 + 别名）
  const searchNames = [name]
  const alias = GLYPH_NAME_ALIASES[name]
  if (alias) searchNames.push(alias)
  // 同时检查包含别名的组合名（如 '脸形阴影' → '脸型阴影'）
  for (const [from, to] of Object.entries(GLYPH_NAME_ALIASES)) {
    if (name.includes(from)) {
      const replaced = name.replace(new RegExp(from, 'g'), to)
      if (!searchNames.includes(replaced)) searchNames.push(replaced)
    }
  }

  for (const list of [file.glyphs, file.stroke_glyphs, file.radical_glyphs, file.comp_glyphs]) {
    if (!list) continue
    for (const g of list) {
      // 1. 精确匹配
      if (searchNames.includes(g.name)) return g
      const glyphNameStripped = g.name.replace(/_/g, '')
      for (const sn of searchNames) {
        if (glyphNameStripped.endsWith(sn) || g.name.endsWith('_' + sn)) {
          return g
        }
      }
    }
  }
  return null
}

function findGlyphInProjectByID(id: string): ICustomGlyph | null {
  const file = useProjectStore().selectedFile
  if (!file) return null
  for (const list of [file.glyphs, file.stroke_glyphs, file.radical_glyphs, file.comp_glyphs]) {
    if (!list) continue
    const g = list.find((g: ICustomGlyph) => g.uuid === id)
    if (g) return g
  }
  return null
}

export class Character implements IInstance {
  public uuid: string
  public type: 'character' = 'character'
  public lastUsed: number = Date.now()

  /** 脚本生成的渲染用组件（glyph-pen 等实例） */
  public _components: Array<any> = []

  public _character: ICharacterFileLite
  /** 缓存已获取的字形实例，cleanup 时统一释放 */
  private _glyphInstances: Map<string, CustomGlyph> = new Map()

  constructor(character: ICharacterFileLite) {
    this._character = character
    this.uuid = character.uuid
  }

  // ==================== 参数操作 ====================

  private _findParam(name: string): IParameter | undefined {
    if (!this._character.parameters?.length) return undefined
    return this._character.parameters.find((p) => p.name === name)
  }

  getParam(name: string): number | null {
    const param = this._findParam(name)
    if (!param) return null

    if (param.type === ParameterType.Constant) {
      const constantsMap = getGlobalConstantsMap() || useProjectStore().constantsMap
      if (!constantsMap) return Number(param.value ?? 0)
      const resolved = constantsMap.getByUUID(param.value as string)
      return typeof resolved === 'number' ? resolved : Number(param.value ?? 0)
    }

    return Number(param.value ?? 0)
  }

  setParam(name: string, value: number): void {
    const param = this._findParam(name)
    if (!param || param.type !== ParameterType.Number) return

    const min = Number(param.min ?? 0)
    const max = Number(param.max === 0 ? 0 : (param.max ?? 1000))
    const clamped = Math.max(min, Math.min(max, value))
    param.value = Math.round(clamped * 100) / 100
  }

  getParamRange(name: string): { min: number; max: number } | undefined {
    const param = this._findParam(name)
    if (!param) return undefined
    const min = Number(param.min ?? 0)
    const max = Number(param.max === 0 ? 0 : (param.max ?? 1000))
    return { min, max }
  }

  // ==================== 组件操作 ====================

  getComponent(name: string): IComponent | null {
    for (let i = 0; i < this._character.components.length; i++) {
      if (this._character.components[i].name === name) {
        return this._character.components[i]
      }
    }
    return null
  }

  clearComponents(): void {
    this._character.components.length = 0
    this._character.orderedList.length = 0
    this._components.length = 0
    // 释放所有缓存的字形实例
    for (const [key, instance] of this._glyphInstances) {
      if (instanceManager.isTemporary(key)) {
        instanceManager.releaseTemporaryInstance(key)
      }
    }
    this._glyphInstances.clear()
  }

  removeComponent(name: string): void {
    const idx = this._character.components.findIndex((c) => c.name === name)
    if (idx === -1) return
    const comp = this._character.components[idx]
    this._character.components.splice(idx, 1)
    // 同步清理 orderedList
    const olIdx = this._character.orderedList.findIndex((o) => o.uuid === comp.uuid)
    if (olIdx !== -1) this._character.orderedList.splice(olIdx, 1)
  }

  removeComponentByID(id: string): void {
    const idx = this._character.components.findIndex((c) => c.uuid === id)
    if (idx === -1) return
    this._character.components.splice(idx, 1)
    const olIdx = this._character.orderedList.findIndex((o) => o.uuid === id)
    if (olIdx !== -1) this._character.orderedList.splice(olIdx, 1)
  }

  selectComponents(options: { name?: string; id?: string; glyphName?: string; glyphID?: string }): IComponent[] {
    return this._character.components.filter((c) => {
      if (c.type !== 'glyph') return false
      const v = c.value as any
      if (options.name && c.name !== options.name) return false
      if (options.id && c.uuid !== options.id) return false
      if (options.glyphName && v?.name !== options.glyphName) return false
      if (options.glyphID && v?.uuid !== options.glyphID) return false
      return true
    })
  }

  addGlyphComponent(options: {
    name?: string
    glyphName?: string
    glyphID?: string
    glyphStyleTag?: string
    ox?: number
    oy?: number
  }): { uuid: string; id: string } | null {
    // 查找工程中的字形定义
    let glyphData: ICustomGlyph | null = null
    if (options.glyphID) {
      glyphData = findGlyphInProjectByID(options.glyphID)
    }
    if (!glyphData && options.glyphName) {
      glyphData = findGlyphInProject(options.glyphName)
    }
    if (!glyphData && options.glyphStyleTag) {
      const file = useProjectStore().selectedFile
      if (file) {
        for (const list of [file.glyphs, file.stroke_glyphs, file.radical_glyphs, file.comp_glyphs]) {
          if (!list) continue
          const g = list.find((g: ICustomGlyph) => (g as any).style === options.glyphStyleTag && g.name === (options.glyphName || options.name))
          if (g) { glyphData = g; break }
        }
      }
    }

    const uuid = genUUID()
    const compName = options.name || options.glyphName || 'glyph'

    // 构建组件值：保存字形引用数据
    const glyphValue: any = glyphData
      ? JSON.parse(JSON.stringify(glyphData))
      : { uuid: options.glyphID || '', name: options.glyphName || '', type: 'system' }

    const component: IComponent = {
      uuid,
      type: 'glyph',
      name: compName,
      lock: false,
      visible: true,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      rotation: 0,
      flipX: false,
      flipY: false,
      usedInCharacter: true,
      ox: options.ox ?? 0,
      oy: options.oy ?? 0,
      value: glyphValue as any,
    } as IComponent

    this._character.components.push(component)
    this._character.orderedList.push({ type: 'component', uuid })

    if (import.meta.env.DEV) {
      console.log(`[Character.addGlyphComponent] 添加组件: ${compName} uuid=${uuid}`)
    }

    return { uuid, id: uuid }
  }

  // ==================== 字形访问 ====================

  getGlyph(name: string): ICustomGlyph | null {
    const comp = this._character.components.find(
      (c) => c.name === name && c.type === 'glyph'
    )
    if (!comp) return null
    return (comp as any).value as ICustomGlyph
  }

  getGlyphByID(id: string): ICustomGlyph | null {
    const comp = this._character.components.find(
      (c) => c.uuid === id && c.type === 'glyph'
    )
    if (!comp) return null
    return (comp as any).value as ICustomGlyph
  }

  getGlyphByComponentName(name: string): CustomGlyph | null {
    const comp = this._character.components.find(
      (c) => c.name === name && c.type === 'glyph'
    )
    if (!comp) return null
    return this._getOrCreateGlyphInstance(comp as any)
  }

  getGlyphByComponentID(id: string): CustomGlyph | null {
    const comp = this._character.components.find(
      (c) => c.uuid === id && c.type === 'glyph'
    )
    if (!comp) return null
    return this._getOrCreateGlyphInstance(comp as any)
  }

  getGlyphInstance(name: string): CustomGlyph | null {
    const glyph = this.getGlyph(name)
    if (!glyph) return null
    // 直接在工程中查找字形实例
    const projectGlyph = findGlyphInProject(name)
    if (!projectGlyph) return null
    return this._getOrCreateGlyphInstanceForGlyph(projectGlyph)
  }

  getGlyphInstanceByID(id: string): CustomGlyph | null {
    const glyph = this.getGlyphByID(id)
    if (!glyph) return null
    const projectGlyph = findGlyphInProjectByID(id)
    if (!projectGlyph) return null
    return this._getOrCreateGlyphInstanceForGlyph(projectGlyph)
  }

  getGlyphInstanceByComponentName(name: string): CustomGlyph | null {
    return this.getGlyphByComponentName(name)
  }

  getGlyphInstanceByComponentID(id: string): CustomGlyph | null {
    return this.getGlyphByComponentID(id)
  }

  // ==================== 内部方法 ====================

  private _getOrCreateGlyphInstance(component: IComponent): CustomGlyph | null {
    if (component.type !== 'glyph') return null
    const key = component.uuid
    // 检查缓存
    const cached = this._glyphInstances.get(key)
    if (cached) return cached

    const glyphValue = (component as any).value as ICustomGlyph
    const instance = instanceManager.acquireTemporaryInstance(
      key,
      () => new CustomGlyph(glyphValue),
      'glyph'
    ) as CustomGlyph
    this._glyphInstances.set(key, instance)
    return instance
  }

  private _getOrCreateGlyphInstanceForGlyph(glyph: ICustomGlyph): CustomGlyph | null {
    const key = glyph.uuid
    const cached = this._glyphInstances.get(key)
    if (cached) return cached

    const instance = instanceManager.acquireTemporaryInstance(
      key,
      () => new CustomGlyph(glyph),
      'glyph'
    ) as CustomGlyph
    this._glyphInstances.set(key, instance)
    return instance
  }

  // ==================== 布局与坐标 ====================

  getLayoutByID(id: string): any {
    if (this._character.info?.layoutTree) {
      return getNodeByID(id, this._character.info.layoutTree)
    }
    return null
  }

  getCoords(layout: any, col: number, row: number, n: number): { x: number; y: number } {
    const rect = layout.rect
    const { x, y, w, h } = rect
    const _x = x + (w / n) * col
    const _y = y + (h / n) * row
    return { x: _x, y: _y }
  }

  getRatioCoords(layout: any, col: number, row: number, n: number): { x: number; y: number } {
    const { dx = 0, dy = 0, size = 1000, centerSquareSize = 1000 / 3 } =
      this._character.info?.gridSettings || {}
    return { x: 0, y: 0 }
  }

  getRatioLayout(value: any): any {
    return null
  }

  // ==================== 生命周期 ====================

  getCharacter(): ICharacterFileLite {
    return this._character
  }

  /** 重置脚本生成状态（不清除 components/orderedList，脚本负责调用 clearComponents） */
  clear(): void {
    this._components = []
  }

  cleanup(): void {
    this._components = []
    for (const [key, instance] of this._glyphInstances) {
      if (instanceManager.isTemporary(key)) {
        instanceManager.releaseTemporaryInstance(key)
      }
    }
    this._glyphInstances.clear()
  }
}

// ==================== 工具函数 ====================

function getNodeByID(id: string, tree: any[]): any {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node.id === id) {
      return node
    } else if (node.children) {
      const found = getNodeByID(id, node.children)
      if (found) return found
    }
  }
  return null
}
