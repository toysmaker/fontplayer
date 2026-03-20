<script setup lang="ts">
/**
 * 右面板
 * 根据编辑状态和选中的组件类型显示相应的参数编辑面板
 */

import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NEmpty } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useComponentEditor } from './composables/useComponentEditor'
import { EditStatus } from '@/core/types'
import { useToolStore } from '@/stores/tool'
// 导入各个参数编辑面板
import PenEditPanel from './paramsEditPanels/PenEditPanel.vue'
import EllipseEditPanel from './paramsEditPanels/EllipseEditPanel.vue'
import RectangleEditPanel from './paramsEditPanels/RectangleEditPanel.vue'
import PolygonEditPanel from './paramsEditPanels/PolygonEditPanel.vue'
import PictureEditPanel from './paramsEditPanels/PictureEditPanel.vue'
import GlyphEditPanel from './paramsEditPanels/GlyphEditPanel.vue'
import GlyphParamsPanel from './paramsEditPanels/GlyphParamsPanel.vue'
import MetricsEditPanel from './paramsEditPanels/MetricsEditPanel.vue'

const { t } = useI18n()

const { selectedComponent, selectedComponentUUID, editStatus } = useComponentEditor()
const toolStore = useToolStore()
const { tool } = storeToRefs(toolStore)

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
  <div class="right-panel" data-testid="parameter-panel">
    <!-- 字符编辑 metrics 工具：度量参数 -->
    <metrics-edit-panel
      v-if="editStatus === EditStatus.Edit && tool === 'metrics'"
    />
    <!-- 字形编辑 params 工具：显示字形参数面板（骨架绑定等） -->
    <glyph-params-panel
      v-else-if="editStatus === EditStatus.Glyph && tool === 'params'"
    />
    <!-- 基础组件面板（不区分字符/字形） -->
    <pen-edit-panel
      v-else-if="selectedComponentUUID && selectedComponent?.type === 'pen'"
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
      <n-empty :description="t('panels.rightPanel.selectComponent')" />
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
