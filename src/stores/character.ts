/**
 * 字符编辑 Store
 * 管理字符编辑相关的状态
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import type { ICharacterFileLite, IComponent } from '@/core/types'
import { useProjectStore } from './project'
import { useEditorStore } from './editor'
import { instanceManager } from '@/core/instance'
import { Character } from '@/core/instance/Character'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'

export const useCharacterStore = defineStore('character', () => {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  
  // 状态
  const editingCharacterUUID = ref<string>('')
  const selectedComponentUUID = ref<string>('')
  const selectedComponentsTree = ref<string[]>([])

  // 剪贴板
  const clipBoard = reactive<{ value: Array<IComponent> }>({
    value: []
  })
  
  // 是否支持多选
  const enableMultiSelect = ref(false)

  // 当前编辑的字符文件（独立对象，与列表分离，提升性能）
  // 由于列表中有大量字符时，computed属性计算过慢，editCharacterFile改用手动赋值，不使用computed
  const editingCharacter = ref<ICharacterFileLite | null>(null)

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
    
    // 标记为正在编辑，触发实例化
    instanceManager.markEditing(uuid)
    // 获取或创建实例（延迟实例化）
    getCharacterInstance()
  }

  /**
   * 重置编辑字符（退出编辑时调用）
   */
  function resetEditCharacterFile() {
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
    
    const characterList = projectStore.selectedFile.characterList
    const index = characterList.findIndex(
      c => c.uuid === editingCharacterUUID.value
    )
    
    if (index >= 0) {
      // 深拷贝编辑字符的数据回列表
      characterList[index] = R.clone(editingCharacter.value) as ICharacterFileLite
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
    }
    
    // 从列表中设置编辑字符
    setEditCharacterFileByUUID(uuid)
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
      if (key === 'value' && typeof optionValue === 'object') {
        // 合并 value 对象，保留现有属性（如 editMode）
        const compAny = component as any
        const currentValue = compAny.value || {}
        compAny.value = { ...currentValue, ...R.clone(optionValue) }
      } else {
        (component as any)[key] = optionValue
      }
    })
    
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

  return {
    // State
    editingCharacterUUID,
    selectedComponentUUID,
    selectedComponentsTree,
    clipBoard,
    enableMultiSelect,
    
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
    getCharacterInstance,
    selectComponent,
    clearSelection,
    updateComponent,
    modifyComponent,
    removeComponent,
    insertComponent,
    setOrderedList,
    setSelection,
    setClipBoard,
    addComponent,
  }
})
