/**
 * 组件编辑 Composable
 * 统一处理字符和字形编辑模式下的组件编辑逻辑
 */

import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { EditStatus, IComponent } from '@/core/types'

/**
 * 统一的组件编辑逻辑
 * 根据 editStatus 自动选择正确的 store（characterStore 或 glyphStore）
 */
export function useComponentEditor() {
  const editorStore = useEditorStore()
  const characterStore = useCharacterStore()
  const glyphStore = useGlyphStore()
  
  const selectedComponent = computed<IComponent | null>(() => {
    if (editorStore.editStatus === EditStatus.Edit) {
      return characterStore.selectedComponent
    } else if (editorStore.editStatus === EditStatus.Glyph) {
      return glyphStore.selectedComponent
    }
    return null
  })
  
  const selectedComponentUUID = computed(() => {
    if (editorStore.editStatus === EditStatus.Edit) {
      return characterStore.selectedComponentUUID
    } else if (editorStore.editStatus === EditStatus.Glyph) {
      return glyphStore.selectedComponentUUID
    }
    return ''
  })
  
  const modifyComponent = (updates: Partial<IComponent>) => {
    if (!selectedComponentUUID.value) return
    if (editorStore.editStatus === EditStatus.Edit) {
      characterStore.modifyComponent(selectedComponentUUID.value, updates)
    } else if (editorStore.editStatus === EditStatus.Glyph) {
      glyphStore.modifyComponent(selectedComponentUUID.value, updates)
    }
  }
  
  return {
    selectedComponent,
    selectedComponentUUID,
    modifyComponent,
    editStatus: computed(() => editorStore.editStatus)
  }
}
