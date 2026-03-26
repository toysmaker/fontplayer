/**
 * 字符编辑 Store
 * 管理字符编辑相关的状态
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive, watch } from 'vue'
import type { ICharacterFileLite, IComponent, IGridItem } from '@/core/types'
import { useProjectStore } from './project'
import { useEditorStore } from './editor'
import { instanceManager } from '@/core/instance'
import { Character } from '@/core/instance/Character'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'
import { characterDataManager } from '@/core/storage/CharacterDataManager'

export function defaultGridItem(): IGridItem {
  return {
    dx: 0,
    dy: 0,
    dx1: 0,
    dy1: 0,
    dx2: 0,
    dy2: 0,
    dx3: 0,
    dy3: 0,
    dx4: 0,
    dy4: 0,
    ox: 500,
    oy: 500,
    width: 1000,
    height: 1000,
    centerSquareScale: 1,
  }
}

/** 补全 info.gridSettings.initialGrid / currentGrid，兼容旧数据 */
export function ensureCharacterInfoGridSettings(character: ICharacterFileLite) {
  if (!character.info) {
    character.info = {}
  }
  const info = character.info
  if (!info.gridSettings) {
    const ig = defaultGridItem()
    info.gridSettings = {
      dx: 0,
      dy: 0,
      centerSquareSize: 1000 / 3,
      size: 1000,
      default: true,
      initialGrid: R.clone(ig),
      currentGrid: R.clone(ig),
    }
    return
  }
  const gs = info.gridSettings
  if (!gs.initialGrid) {
    gs.initialGrid = gs.currentGrid ? R.clone(gs.currentGrid) : defaultGridItem()
  }
  if (!gs.currentGrid) {
    gs.currentGrid = R.clone(gs.initialGrid)
  }
}

/**
 * 递归收集字符/复合字形树中所有字形组件的 placement uuid（与 executeGlyphScript / 临时实例的 instanceKey 一致）
 */
export function collectGlyphPlacementUUIDsRecursive(components: IComponent[]): string[] {
  const out: string[] = []
  const walk = (list: IComponent[]) => {
    for (const comp of list) {
      if (comp.type === 'glyph' && comp.uuid) {
        out.push(comp.uuid)
        const subs = (comp.value as { components?: IComponent[] })?.components
        if (subs?.length) walk(subs)
      }
    }
  }
  walk(components)
  return out
}

export const useCharacterStore = defineStore('character', () => {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  
  // 状态
  const editingCharacterUUID = ref<string>('')
  const selectedComponentUUID = ref<string>('')
  const selectedComponentsTree = ref<string[]>([])

  // 字符列表更新信号：退出编辑时递增，供虚拟列表监听以强制刷新预览
  const characterListVersion = ref(0)
  const lastUpdatedCharacterUUID = ref<string>('')

  // 剪贴板
  const clipBoard = reactive<{ value: Array<IComponent> }>({
    value: []
  })
  
  // 是否支持多选
  const enableMultiSelect = ref(false)

  // 当前编辑的字符文件（独立对象，与列表分离，提升性能）
  // 由于列表中有大量字符时，computed属性计算过慢，editCharacterFile改用手动赋值，不使用computed
  const editingCharacter = ref<ICharacterFileLite | null>(null)

  /** 已为「字符编辑中的字形 placement」调用过 markEditing 的 component.uuid，退出或切换时需 unmark */
  const markedGlyphPlacementUUIDsForCharacterEdit = ref<string[]>([])

  const selectedComponent = computed(() => {
    if (!selectedComponentUUID.value || !editingCharacter.value) {
      return null
    }
    return findComponentInTree(
      editingCharacter.value.components,
      selectedComponentUUID.value
    )
  })

  // 当前字符文件的排序组件（包含组件本身）列表
  const orderedListWithItemsForCurrentCharacterFile = computed(() => {
    if (!editingCharacter.value) {
      if (import.meta.env.DEV) {
        console.log('[CharacterStore] orderedListWithItemsForCurrentCharacterFile: editingCharacter is null')
      }
      return []
    }
    const characterFile = editingCharacter.value
    if (!characterFile.components || characterFile.components.length === 0) {
      if (import.meta.env.DEV) {
        console.log('[CharacterStore] orderedListWithItemsForCurrentCharacterFile: no components', {
          characterUUID: characterFile.uuid,
          hasComponents: !!characterFile.components,
          componentsLength: characterFile.components?.length || 0
        })
      }
      return []
    }
    if (!characterFile.orderedList || !characterFile.orderedList.length) {
      if (import.meta.env.DEV) {
        console.log('[CharacterStore] orderedListWithItemsForCurrentCharacterFile: no orderedList, using components directly', {
          componentsCount: characterFile.components.length,
          componentTypes: characterFile.components.map((c: IComponent) => c.type)
        })
      }
      return characterFile.components || []
    }
    
    const result = characterFile.orderedList.map((item: { type: string; uuid: string }) => {
      if (item.type === 'group') {
        // 如果是组，从 groups 中查找（暂时不支持组）
        return null
      }
      const found = selectedItemByUUID(characterFile.components, item.uuid)
      if (!found && import.meta.env.DEV) {
        console.warn('[CharacterStore] orderedListWithItemsForCurrentCharacterFile: component not found', {
          uuid: item.uuid,
          availableUUIDs: characterFile.components.map((c: IComponent) => c.uuid)
        })
      }
      return found
    }).filter((item): item is IComponent => item !== null)
    
    if (import.meta.env.DEV) {
      console.log('[CharacterStore] orderedListWithItemsForCurrentCharacterFile:', {
        orderedListCount: characterFile.orderedList.length,
        resultCount: result.length,
        componentsCount: characterFile.components.length,
        componentTypes: result.map(c => c.type)
      })
    }
    
    return result
  })

  // 当前字符文件的排序列表（不包含组件本身）
  const orderedListForCurrentCharacterFile = computed(() => {
    if (!editingCharacter.value) return []
    return editingCharacter.value.orderedList || []
  })

  // 选中的所有组件uuid列表
  const selectedComponentsUUIDs = computed(() => {
    if (!editingCharacter.value) return []
    return editingCharacter.value.selectedComponentsUUIDs || []
  })

  // 选中的所有组件列表
  const selectedComponents = computed(() => {
    if (!editingCharacter.value || !selectedComponentsUUIDs.value.length) return []
    const components: IComponent[] = []
    selectedComponentsUUIDs.value.forEach(uuid => {
      const component = findComponentInTree(editingCharacter.value!.components, uuid)
      if (component) {
        components.push(component)
      }
    })
    return components
  })

  // 用在字符中的组件列表（usedInCharacter 为 true 的组件）
  const usedComponents = computed(() => {
    return orderedListWithItemsForCurrentCharacterFile.value.filter((component: IComponent) => {
      return !!component.usedInCharacter
    })
  })

  /**
   * 在组件树中查找组件
   */
  function findComponentInTree(
    components: IComponent[],
    uuid: string
  ): IComponent | null {
    for (const comp of components) {
      if (comp.uuid === uuid) {
        return comp
      }
      // 如果是字形组件，递归查找子组件
      if (comp.type === 'glyph' && (comp.value as any).components) {
        const found = findComponentInTree(
          (comp.value as any).components,
          uuid
        )
        if (found) return found
      }
    }
    return null
  }

  function clearCharacterGlyphPlacementEditingMarks() {
    for (const id of markedGlyphPlacementUUIDsForCharacterEdit.value) {
      instanceManager.unmarkEditing(id)
    }
    markedGlyphPlacementUUIDsForCharacterEdit.value = []
  }

  /** 同步当前字符树中所有字形 placement 的编辑标记（先清除旧标记再按树重建） */
  function applyCharacterGlyphPlacementEditingMarks(components: IComponent[]) {
    clearCharacterGlyphPlacementEditingMarks()
    const ids = collectGlyphPlacementUUIDsRecursive(components)
    for (const id of ids) {
      instanceManager.markEditing(id)
    }
    markedGlyphPlacementUUIDsForCharacterEdit.value = ids
  }

  // Actions
  /**
   * 设置正在编辑的字符 UUID
   */
  function setEditingCharacterUUID(uuid: string) {
    editingCharacterUUID.value = uuid
  }

  /**
   * 从列表中设置编辑字符（深拷贝，与列表分离）
   * 将列表中指定uuid的字符数据设置为editCharacterFile
   * 注意：如果列表中的字符只有元数据，需要从IndexedDB加载完整数据
   */
  async function setEditCharacterFileByUUID(uuid: string) {
    if (!projectStore.selectedFile) return
    
    const characterMetadata = projectStore.selectedFile.characterList.find(
      c => c.uuid === uuid
    )
    
    if (!characterMetadata) {
      if (import.meta.env.DEV) {
        console.warn('[CharacterStore] setEditCharacterFileByUUID: character not found', uuid)
      }
      return
    }
    
    // 检查是否是完整数据（有 components 属性）还是只是元数据
    let character: ICharacterFileLite | null = null
    
    if ('components' in characterMetadata && Array.isArray((characterMetadata as any).components)) {
      // 已经是完整数据
      character = characterMetadata as ICharacterFileLite
    } else {
      // 只是元数据，需要从 IndexedDB 加载完整数据
      if (import.meta.env.DEV) {
        console.log('[CharacterStore] setEditCharacterFileByUUID: loading full character data from IndexedDB', uuid)
      }
      const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
      character = await characterDataManager.loadCharacter(projectStore.selectedFile.uuid, uuid)
    }
    
    if (!character) {
      if (import.meta.env.DEV) {
        console.error('[CharacterStore] setEditCharacterFileByUUID: failed to load character', uuid)
      }
      return
    }
    
    // 深拷贝字符数据，与列表分离
    editingCharacter.value = R.clone(character) as ICharacterFileLite
    editingCharacterUUID.value = uuid
    selectedComponentsTree.value = []
    
    // 确保必要的属性存在
    if (!editingCharacter.value.components) {
      editingCharacter.value.components = []
    }
    if (!editingCharacter.value.orderedList) {
      // 如果 orderedList 不存在，从 components 生成
      editingCharacter.value.orderedList = editingCharacter.value.components.map(comp => ({
        type: 'component',
        uuid: comp.uuid
      }))
    }
    if (!editingCharacter.value.selectedComponentsUUIDs) {
      editingCharacter.value.selectedComponentsUUIDs = []
    }
    if (!editingCharacter.value.groups) {
      editingCharacter.value.groups = []
    }
    
    // 如果文件中已经有选中的组件，恢复选中状态
    if (editingCharacter.value.selectedComponentsUUIDs && editingCharacter.value.selectedComponentsUUIDs.length > 0) {
      // 取第一个选中的组件作为当前选中组件
      selectedComponentUUID.value = editingCharacter.value.selectedComponentsUUIDs[0]
    } else {
      selectedComponentUUID.value = ''
    }
    
    if (import.meta.env.DEV) {
      console.log('[CharacterStore] setEditCharacterFileByUUID:', {
        uuid,
        componentsCount: editingCharacter.value.components.length,
        orderedListCount: editingCharacter.value.orderedList.length
      })
    }

    ensureCharacterInfoGridSettings(editingCharacter.value)
    
    // 标记为正在编辑，触发实例化
    instanceManager.markEditing(uuid)
    // 获取或创建实例（延迟实例化）
    getCharacterInstance()

    applyCharacterGlyphPlacementEditingMarks(editingCharacter.value.components)
  }

  /**
   * 重置编辑字符（退出编辑时调用）
   */
  function resetEditCharacterFile() {
    clearCharacterGlyphPlacementEditingMarks()
    editingCharacter.value = null
    editingCharacterUUID.value = ''
    selectedComponentUUID.value = ''
    selectedComponentsTree.value = []
  }

  /**
   * 将编辑字符的数据同步回列表
   * 在退出编辑时调用，将 editCharacterFile 的值赋给列表中相应字符
   */
  function updateCharacterListFromEditFile() {
    if (!editingCharacter.value || !projectStore.selectedFile) return

    // 清除预览和轮廓缓存引用，使列表项在重新可见时重新计算最新内容
    // previewRef 置空后，列表组件的 watcher 会检测到变化并触发重新渲染
    // contourRef 置空后，下次导出时轮廓会重新计算，确保导出内容是最新的
    editingCharacter.value.previewRef = undefined
    editingCharacter.value.contourRef = undefined

    const characterList = projectStore.selectedFile.characterList
    const index = characterList.findIndex(
      c => c.uuid === editingCharacterUUID.value
    )

    if (index >= 0) {
      // 深拷贝编辑字符的数据回列表
      const updatedCharacter = R.clone(editingCharacter.value) as ICharacterFileLite
      characterList[index] = updatedCharacter
      // 同步更新 characterDataManager 缓存，确保 loadFullCharacter 返回最新数据
      const fileUUID = projectStore.selectedFile.uuid
      characterDataManager.updateCharacter(fileUUID, updatedCharacter)
      // 更新信号，通知虚拟列表强制刷新该项预览
      lastUpdatedCharacterUUID.value = editingCharacterUUID.value
      characterListVersion.value++
    }
  }

  /**
   * 设置正在编辑的字符（兼容旧接口）
   * 会触发实例化（延迟实例化）
   */
  function setEditingCharacter(uuid: string) {
    // 取消之前的编辑标记
    if (editingCharacterUUID.value) {
      instanceManager.unmarkEditing(editingCharacterUUID.value)
      clearCharacterGlyphPlacementEditingMarks()
    }

    // 从列表中设置编辑字符
    void setEditCharacterFileByUUID(uuid)
  }

  /**
   * 获取字符实例（延迟实例化）
   */
  function getCharacterInstance(): Character | null {
    if (!editingCharacter.value) {
      return null
    }
    
    return instanceManager.getInstance(
      editingCharacter.value.uuid,
      () => new Character(editingCharacter.value!),
      'character'
    )
  }

  /**
   * 选择组件
   */
  function selectComponent(uuid: string, tree: string[] = []) {
    // 统一通过 setSelection 来更新选中状态（包括多选、高亮等）
    // 这样无论是组件列表还是画布上的选择，逻辑保持一致
    setSelection(uuid)

    // 同步 selectedComponentsTree（用于字形嵌套选择）
    selectedComponentsTree.value = tree
    
    // 如果选中的是字形组件，自动勾选 checkJoints 和 checkRefLines
    const component = selectedComponent.value
    if (component && component.type === 'glyph') {
      editorStore.checkJoints = true
      editorStore.checkRefLines = true
    }
  }

  /**
   * 清除选择
   */
  function clearSelection() {
    selectedComponentUUID.value = ''
    selectedComponentsTree.value = []
    // 同时清除 editingCharacter 中的 selectedComponentsUUIDs，确保组件列表的高亮状态也被清除
    if (editingCharacter.value) {
      editingCharacter.value.selectedComponentsUUIDs = []
    }
  }

  /**
   * 更新正在编辑字符的九宫格（initial 或 current），并同步简写字段供背景格 / 脚本 getRatioCoords
   */
  function patchEditingCharacterGridSettings(next: IGridItem, target: 'initialGrid' | 'currentGrid') {
    if (!editingCharacter.value) return
    ensureCharacterInfoGridSettings(editingCharacter.value)
    const gs = editingCharacter.value.info!.gridSettings!
    const clone = R.clone(next) as IGridItem
    if (target === 'currentGrid') {
      gs.currentGrid = clone
      gs.dx = clone.dx
      gs.dy = clone.dy
      gs.size = clone.width
      gs.centerSquareSize = (clone.width / 3) * clone.centerSquareScale
    } else {
      gs.initialGrid = clone
    }
  }

  /** 右栏直接改 currentGrid 数值时同步 dx/dy/size/centerSquareSize（背景格 / getRatioCoords） */
  function syncGridSettingsShorthandFromCurrentGrid() {
    if (!editingCharacter.value?.info?.gridSettings?.currentGrid) return
    ensureCharacterInfoGridSettings(editingCharacter.value)
    const gs = editingCharacter.value.info!.gridSettings!
    const c = gs.currentGrid!
    gs.dx = c.dx
    gs.dy = c.dy
    gs.size = c.width
    gs.centerSquareSize = (c.width / 3) * c.centerSquareScale
  }

  /**
   * 更新组件
   */
  function updateComponent(uuid: string, updates: Partial<IComponent>) {
    if (!editingCharacter.value) return false

    const component = findComponentInTree(editingCharacter.value.components, uuid)
    if (component) {
      Object.assign(component, updates)
      return true
    }
    return false
  }

  /**
   * 修改组件（支持更多选项）
   */
  function modifyComponent(uuid: string, options: Partial<IComponent>) {
    if (!editingCharacter.value) return false
    
    const component = findComponentInTree(editingCharacter.value.components, uuid)
    if (!component) return false
    
    Object.keys(options).forEach((key: string) => {
      const optionValue = (options as any)[key]
      if (key === 'value' && typeof optionValue === 'object' && optionValue !== null) {
        // 合并 value；patch 中显式为 undefined 的键表示删除（用于清除分色 fillColor 等）
        const compAny = component as any
        const currentValue = compAny.value || {}
        const cloned = R.clone(optionValue) as Record<string, unknown>
        const merged = { ...currentValue, ...cloned }
        for (const k of Object.keys(cloned)) {
          if (cloned[k] === undefined) {
            delete merged[k]
          }
        }
        compAny.value = merged
      } else if (key === 'fillColor' && optionValue === undefined) {
        delete (component as any).fillColor
      } else {
        (component as any)[key] = optionValue
      }
    })

    // 清除组件轮廓缓存：当变换属性或形状数据发生变化时，缓存的 contour/preview 已失效
    const TRANSFORM_KEYS = ['x', 'y', 'w', 'h', 'rotation', 'flipX', 'flipY', 'value']
    if (Object.keys(options).some(k => TRANSFORM_KEYS.includes(k))) {
      const v = (component as any).value
      if (v) {
        v.contour = undefined
        v.preview = undefined
      }
    }

    return true
  }

  /**
   * 将一个字形组件格式化为一组普通组件（用于“格式化字形组件”功能）
   */
  function replaceGlyphComponentWithComponents(
    uuid: string,
    components: IComponent[],
    orderedItems: { type: string; uuid: string }[],
  ) {
    if (!editingCharacter.value) return false

    const file = editingCharacter.value
    const index = file.components.findIndex((c) => c.uuid === uuid)
    if (index === -1) return false

    // 删除原组件
    file.components.splice(index, 1)

    // 追加新组件
    components.forEach((c) => file.components.push(c))

    // 更新 orderedList：用新的 orderedItems 替换原来的那个 uuid
    if (!file.orderedList) file.orderedList = []
    const oldIndex = file.orderedList.findIndex((i) => i.uuid === uuid)
    if (oldIndex >= 0) {
      file.orderedList.splice(oldIndex, 1, ...orderedItems)
    } else {
      file.orderedList.push(...orderedItems)
    }

    // 清除选中
    clearSelection()
    return true
  }

  /**
   * 删除组件
   */
  function removeComponent(uuid: string) {
    if (!editingCharacter.value) return false
    
    const characterFile = editingCharacter.value
    const index = characterFile.components.findIndex(comp => comp.uuid === uuid)
    if (index === -1) return false
    
    // 从 orderedList 中删除
    removeOrderedItem(uuid)
    
    // 从 components 中删除
    characterFile.components.splice(index, 1)
    
    // 清除选择
    if (selectedComponentUUID.value === uuid) {
      selectedComponentUUID.value = ''
      selectedComponentsTree.value = []
    }
    
    return true
  }

  /**
   * 从 orderedList 中删除项目
   */
  function removeOrderedItem(uuid: string) {
    if (!editingCharacter.value) return
    
    const characterFile = editingCharacter.value
    if (!characterFile.orderedList) return
    
    const index = characterFile.orderedList.findIndex(item => item.uuid === uuid)
    if (index >= 0) {
      characterFile.orderedList.splice(index, 1)
    }
  }

  /**
   * 插入组件
   */
  function insertComponent(component: IComponent, options: { uuid: string; pos: 'prev' | 'next' }) {
    if (!editingCharacter.value) return false
    
    const characterFile = editingCharacter.value
    characterFile.components.push(component)
    
    // 插入到 orderedList
    insertOrderedItem({
      type: 'component',
      uuid: component.uuid,
    }, options)
    
    return true
  }

  /**
   * 插入 orderedList 项目
   */
  function insertOrderedItem(
    item: { type: string; uuid: string },
    options: { uuid: string; pos: 'prev' | 'next' }
  ) {
    if (!editingCharacter.value) return
    
    const characterFile = editingCharacter.value
    if (!characterFile.orderedList) {
      characterFile.orderedList = []
    }
    
    const index = characterFile.orderedList.findIndex(item => item.uuid === options.uuid)
    if (index === -1) {
      // 如果找不到，直接添加到末尾
      characterFile.orderedList.push(item)
      return
    }
    
    if (options.pos === 'prev') {
      characterFile.orderedList.splice(index, 0, item)
    } else {
      characterFile.orderedList.splice(index + 1, 0, item)
    }
  }

  /**
   * 设置排序列表
   */
  function setOrderedList(list: Array<{ type: string; uuid: string }>) {
    if (!editingCharacter.value) return
    editingCharacter.value.orderedList = list
  }

  /**
   * 设置组件选择（支持多选）
   */
  function setSelection(uuid: string) {
    if (!editingCharacter.value) return
    
    const characterFile = editingCharacter.value
    if (!characterFile.selectedComponentsUUIDs) {
      characterFile.selectedComponentsUUIDs = []
    }
    
    if (uuid) {
      if (enableMultiSelect.value) {
        const index = characterFile.selectedComponentsUUIDs.indexOf(uuid)
        if (index === -1) {
          characterFile.selectedComponentsUUIDs.push(uuid)
        } else {
          characterFile.selectedComponentsUUIDs.splice(index, 1)
        }
        // 多选模式下，始终将 selectedComponentUUID 设置为当前点击的组件
        selectedComponentUUID.value = uuid
      } else {
        characterFile.selectedComponentsUUIDs = [uuid]
        // 同步更新 selectedComponentUUID
        selectedComponentUUID.value = uuid
      }
    } else {
      characterFile.selectedComponentsUUIDs = []
      selectedComponentUUID.value = ''
    }
  }

  /**
   * 设置剪贴板
   */
  function setClipBoard(components: IComponent | IComponent[]) {
    clipBoard.value = Array.isArray(components) ? R.clone(components) : [R.clone(components)]
  }

  /**
   * 添加组件到当前编辑的字符文件
   */
  /**
   * 清空工程中全部字符的预览/轮廓缓存引用并持久化，触发列表重绘（如高级编辑「一键更新全局变量」）
   */
  async function invalidateAllCachedCharacterPreviews() {
    const file = projectStore.selectedFile
    if (!file) return
    for (const meta of file.characterList) {
      const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      if (!ch) continue
      ch.previewRef = undefined
      ch.contourRef = undefined
      await characterDataManager.updateCharacter(file.uuid, ch)
    }
    characterListVersion.value++
  }

  function addComponent(component: IComponent) {
    if (!editingCharacter.value) return false

    const characterFile = editingCharacter.value
    characterFile.components.push(component)

    // 添加到 orderedList
    if (!characterFile.orderedList) {
      characterFile.orderedList = []
    }
    characterFile.orderedList.push({
      type: 'component',
      uuid: component.uuid,
    })

    // 选中新添加的组件
    selectComponent(component.uuid)

    return true
  }

  // 编辑过程中增删顶层笔画时，同步 instanceKey 的 markEditing，避免新组件仍被 LRU 驱逐
  watch(
    () => {
      const ch = editingCharacter.value
      if (!ch?.components?.length) return ''
      return ch.components.map((c) => c.uuid).join('\0')
    },
    () => {
      const ch = editingCharacter.value
      if (!ch?.components?.length || !editingCharacterUUID.value) return
      applyCharacterGlyphPlacementEditingMarks(ch.components)
    },
  )

  return {
    // State
    editingCharacterUUID,
    selectedComponentUUID,
    selectedComponentsTree,
    clipBoard,
    enableMultiSelect,
    characterListVersion,
    lastUpdatedCharacterUUID,
    
    // Getters
    editingCharacter,
    selectedComponent,
    orderedListWithItemsForCurrentCharacterFile,
    orderedListForCurrentCharacterFile,
    selectedComponentsUUIDs,
    selectedComponents,
    usedComponents,
    
    // Actions
    setEditingCharacter,
    setEditingCharacterUUID,
    setEditCharacterFileByUUID,
    resetEditCharacterFile,
    updateCharacterListFromEditFile,
    invalidateAllCachedCharacterPreviews,
    getCharacterInstance,
    selectComponent,
    clearSelection,
    patchEditingCharacterGridSettings,
    syncGridSettingsShorthandFromCurrentGrid,
    updateComponent,
    modifyComponent,
    replaceGlyphComponentWithComponents,
    removeComponent,
    insertComponent,
    setOrderedList,
    setSelection,
    setClipBoard,
    addComponent,
  }
})
