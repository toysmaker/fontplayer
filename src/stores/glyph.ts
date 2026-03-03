/**
 * 字形编辑 Store
 * 管理字形编辑相关的状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ICustomGlyph, IGlyphComponent } from '@/core/types'
import { useProjectStore } from './project'
import { instanceManager } from '@/core/instance'
import { CustomGlyph } from '@/core/instance/CustomGlyph'

export const useGlyphStore = defineStore('glyph', () => {
  const projectStore = useProjectStore()
  
  // 状态
  const editingGlyphUUID = ref<string>('')
  const selectedComponentUUID = ref<string>('')
  const selectedComponentsTree = ref<string[]>([])
  const glyphCategory = ref<'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'>('glyphs')

  // Getters
  const editingGlyph = computed(() => {
    if (!editingGlyphUUID.value || !projectStore.selectedFile) {
      return null
    }
    
    const glyphList = projectStore.selectedFile[glyphCategory.value] || []
    return glyphList.find(g => g.uuid === editingGlyphUUID.value) || null
  })

  const selectedComponent = computed(() => {
    if (!selectedComponentUUID.value || !editingGlyph.value) {
      return null
    }
    return findComponentInTree(
      editingGlyph.value.components,
      selectedComponentUUID.value
    )
  })

  /**
   * 在组件树中查找组件
   */
  function findComponentInTree(
    components: IGlyphComponent[],
    uuid: string
  ): IGlyphComponent | null {
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
   * 设置正在编辑的字形
   * 会触发实例化（延迟实例化）
   */
  function setEditingGlyph(uuid: string, category: typeof glyphCategory.value = 'glyphs') {
    // 取消之前的编辑标记
    if (editingGlyphUUID.value) {
      instanceManager.unmarkEditing(editingGlyphUUID.value)
    }
    
    editingGlyphUUID.value = uuid
    glyphCategory.value = category
    selectedComponentUUID.value = ''
    selectedComponentsTree.value = []
    
    // 标记为正在编辑，触发实例化
    if (uuid && editingGlyph.value) {
      instanceManager.markEditing(uuid)
      // 获取或创建实例（延迟实例化）
      getGlyphInstance()
    }
  }

  /**
   * 获取字形实例（延迟实例化）
   */
  function getGlyphInstance(): CustomGlyph | null {
    if (!editingGlyph.value) {
      return null
    }
    
    return instanceManager.getInstance(
      editingGlyph.value.uuid,
      () => new CustomGlyph(editingGlyph.value!),
      'glyph'
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
  function updateComponent(uuid: string, updates: Partial<IGlyphComponent>) {
    if (!editingGlyph.value) return false

    const component = findComponentInTree(editingGlyph.value.components, uuid)
    if (component) {
      Object.assign(component, updates)
      return true
    }
    return false
  }

  /**
   * 更新字形参数
   */
  function updateGlyphParameter(glyphUUID: string, paramName: string, value: any) {
    const glyph = editingGlyph.value
    if (!glyph || glyph.uuid !== glyphUUID) return false

    if (Array.isArray(glyph.parameters)) {
      const param = glyph.parameters.find(p => p.name === paramName)
      if (param) {
        param.value = value
        return true
      }
    } else if (
      glyph.parameters &&
      typeof glyph.parameters === 'object' &&
      typeof (glyph.parameters as Map<string, any>).get === 'function'
    ) {
      const param = (glyph.parameters as Map<string, { name: string; value: any }>).get(paramName)
      if (param) {
        param.value = value
        return true
      }
    }
    return false
  }

  return {
    // State
    editingGlyphUUID,
    selectedComponentUUID,
    selectedComponentsTree,
    glyphCategory,
    
    // Getters
    editingGlyph,
    selectedComponent,
    
    // Actions
    setEditingGlyph,
    getGlyphInstance,
    selectComponent,
    clearSelection,
    updateComponent,
    updateGlyphParameter,
  }
})
