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
  
  const selectedComponentsUUIDs = computed(() => {
    if (editorStore.editStatus === EditStatus.Edit) {
      return characterStore.selectedComponentsUUIDs
    } else if (editorStore.editStatus === EditStatus.Glyph) {
      return glyphStore.selectedComponentsUUIDs
    }
    return []
  })

  const modifyComponent = (updates: Partial<IComponent>) => {
    if (!selectedComponentUUID.value) return

    const allUUIDs = selectedComponentsUUIDs.value

    // 分离 value 与其他属性：
    // - 简单属性（x, y, w, h, rotation 等）对所有选中组件生效
    // - value 对象（字形参数、钢笔路径等类型相关数据）只对主选中组件生效，
    //   因为编辑面板会基于主选中组件构造完整的 value 对象，直接应用到其他
    //   组件会覆盖掉它们独有的类型数据（如 glyph 的 script/skeleton/components）
    const { value: valueUpdate, ...commonUpdates } = updates as any
    const hasCommonUpdates = Object.keys(commonUpdates).length > 0
    const hasValueUpdate = valueUpdate !== undefined

    // 对简单属性做裁剪
    if (typeof commonUpdates.w === 'number' && commonUpdates.w < 0) commonUpdates.w = 0
    if (typeof commonUpdates.h === 'number' && commonUpdates.h < 0) commonUpdates.h = 0

    if (editorStore.editStatus === EditStatus.Edit) {
      if (hasCommonUpdates) {
        for (const uuid of allUUIDs) {
          characterStore.modifyComponent(uuid, commonUpdates)
        }
      }
      if (hasValueUpdate) {
        characterStore.modifyComponent(selectedComponentUUID.value, { value: valueUpdate })
      }
    } else if (editorStore.editStatus === EditStatus.Glyph) {
      if (hasCommonUpdates) {
        for (const uuid of allUUIDs) {
          glyphStore.modifyComponent(uuid, commonUpdates)
        }
      }
      if (hasValueUpdate) {
        glyphStore.modifyComponent(selectedComponentUUID.value, { value: valueUpdate })
      }
    }
  }

  const selectedComponents = computed(() => {
    if (editorStore.editStatus === EditStatus.Edit) {
      return characterStore.selectedComponents
    } else if (editorStore.editStatus === EditStatus.Glyph) {
      return glyphStore.selectedComponents
    }
    return []
  })

  return {
    selectedComponent,
    selectedComponentUUID,
    selectedComponentsUUIDs,
    selectedComponents,
    modifyComponent,
    editStatus: computed(() => editorStore.editStatus)
  }
}
