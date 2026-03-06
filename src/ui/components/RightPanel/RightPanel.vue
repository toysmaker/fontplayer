<script setup lang="ts">
/**
 * 右面板
 * 根据编辑状态和选中的组件类型显示相应的参数编辑面板
 */

import { computed, watch } from 'vue'
import { NEmpty } from 'naive-ui'
import { useComponentEditor } from './composables/useComponentEditor'
import { EditStatus } from '@/core/types'

// 导入各个参数编辑面板
import PenEditPanel from './paramsEditPanels/PenEditPanel.vue'
import EllipseEditPanel from './paramsEditPanels/EllipseEditPanel.vue'
import RectangleEditPanel from './paramsEditPanels/RectangleEditPanel.vue'
import PolygonEditPanel from './paramsEditPanels/PolygonEditPanel.vue'
import PictureEditPanel from './paramsEditPanels/PictureEditPanel.vue'
import GlyphEditPanel from './paramsEditPanels/GlyphEditPanel.vue'

const { selectedComponent, selectedComponentUUID, editStatus } = useComponentEditor()

// 调试信息
if (import.meta.env.DEV) {
  watch([selectedComponent, selectedComponentUUID, editStatus], ([comp, uuid, status]) => {
    console.log('[RightPanel] State changed:', {
      editStatus: status,
      selectedComponentUUID: uuid,
      selectedComponent: comp ? { type: comp.type, name: comp.name, uuid: comp.uuid } : null
    })
  }, { immediate: true })
}
</script>

<template>
  <div class="right-panel">
    <!-- 基础组件面板（不区分字符/字形） -->
    <pen-edit-panel
      v-if="selectedComponentUUID && selectedComponent?.type === 'pen'"
    />
    <ellipse-edit-panel
      v-else-if="selectedComponentUUID && selectedComponent?.type === 'ellipse'"
    />
    <rectangle-edit-panel
      v-else-if="selectedComponentUUID && selectedComponent?.type === 'rectangle'"
    />
    <polygon-edit-panel
      v-else-if="selectedComponentUUID && selectedComponent?.type === 'polygon'"
    />
    <picture-edit-panel
      v-else-if="selectedComponentUUID && selectedComponent?.type === 'picture'"
    />
    
    <!-- 字形组件（合并后，内部会根据 editStatus 自动选择正确的 store） -->
    <glyph-edit-panel
      v-else-if="selectedComponentUUID && selectedComponent?.type === 'glyph'"
    />
    
    <!-- 未选中组件时的提示 -->
    <div v-else class="empty-panel">
      <n-empty description="请选择一个组件进行编辑" />
    </div>
  </div>
</template>

<style scoped>
.right-panel {
  width: 100%;
  height: 100%;
  text-align: left;
  overflow-y: auto;
  z-index: 99;
  background-color: var(--dark-1);
}

.empty-panel {
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
