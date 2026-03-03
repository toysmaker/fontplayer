/**
 * 字符编辑 Store
 * 管理字符编辑相关的状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ICharacterFileLite, IComponent } from '@/core/types'
import { useProjectStore } from './project'
import { instanceManager } from '@/core/instance'
import { Character } from '@/core/instance/Character'

export const useCharacterStore = defineStore('character', () => {
  const projectStore = useProjectStore()
  
  // 状态
  const editingCharacterUUID = ref<string>('')
  const selectedComponentUUID = ref<string>('')
  const selectedComponentsTree = ref<string[]>([])

  // Getters
  const editingCharacter = computed(() => {
    if (!editingCharacterUUID.value || !projectStore.selectedFile) {
      return null
    }
    return projectStore.selectedFile.characterList.find(
      c => c.uuid === editingCharacterUUID.value
    ) || null
  })

  const selectedComponent = computed(() => {
    if (!selectedComponentUUID.value || !editingCharacter.value) {
      return null
    }
    return findComponentInTree(
      editingCharacter.value.components,
      selectedComponentUUID.value
    )
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
   * 设置正在编辑的字符
   * 会触发实例化（延迟实例化）
   */
  function setEditingCharacter(uuid: string) {
    // 取消之前的编辑标记
    if (editingCharacterUUID.value) {
      instanceManager.unmarkEditing(editingCharacterUUID.value)
    }
    
    editingCharacterUUID.value = uuid
    selectedComponentUUID.value = ''
    selectedComponentsTree.value = []
    
    // 标记为正在编辑，触发实例化
    if (uuid && editingCharacter.value) {
      instanceManager.markEditing(uuid)
      // 获取或创建实例（延迟实例化）
      getCharacterInstance()
    }
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
    selectedComponentUUID.value = uuid
    selectedComponentsTree.value = tree
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

  return {
    // State
    editingCharacterUUID,
    selectedComponentUUID,
    selectedComponentsTree,
    
    // Getters
    editingCharacter,
    selectedComponent,
    
    // Actions
    setEditingCharacter,
    getCharacterInstance,
    selectComponent,
    clearSelection,
    updateComponent,
  }
})
