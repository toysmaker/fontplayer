<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import {
  useAdvancedEditStore,
  PanelType,
} from '@/stores/advancedEdit'
import { useProjectStore } from '@/stores/project'
import { DEFAULT_TEMPLATE_PROJECT_TAG } from '@/features/editor/services/ProjectLoader'
import GlobalParamsPanel from './GlobalParamsPanel.vue'
import ConditionFilterPanel from './ConditionFilterPanel.vue'
import ScriptsPanel from './ScriptsPanel.vue'
import StrokeReplacePanel from './StrokeReplacePanel.vue'
import StyleSwitchPanel from './StyleSwitchPanel.vue'

const advancedEdit = useAdvancedEditStore()
const projectStore = useProjectStore()

const showScriptTab = computed(
  () => projectStore.selectedFile?.tag === DEFAULT_TEMPLATE_PROJECT_TAG,
)

watch(
  showScriptTab,
  (show) => {
    if (!show && advancedEdit.activePanel === PanelType.Script) {
      advancedEdit.setActivePanel(PanelType.GlobalVariables)
    }
  },
  { immediate: true },
)

onMounted(() => {
  void advancedEdit.enterPanel()
})

onUnmounted(() => {
  advancedEdit.exitPanel()
})
</script>

<template>
  <div class="advanced-edit-panel">
    <header class="advanced-edit-panel-header">
      <div class="title">
        <n-button
          size="small"
          :type="advancedEdit.activePanel === PanelType.GlobalVariables ? 'primary' : 'default'"
          @pointerdown="() => advancedEdit.setActivePanel(PanelType.GlobalVariables)"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'wrench']" />
          </template>
          全局变量
        </n-button>
        <n-button
          size="small"
          :type="advancedEdit.activePanel === PanelType.StrokeReplace ? 'primary' : 'default'"
          @pointerdown="() => advancedEdit.setActivePanel(PanelType.StrokeReplace)"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'wrench']" />
          </template>
          笔画替换
        </n-button>
        <n-button
          size="small"
          :type="advancedEdit.activePanel === PanelType.StyleSwitch ? 'primary' : 'default'"
          @pointerdown="() => advancedEdit.setActivePanel(PanelType.StyleSwitch)"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'wrench']" />
          </template>
          风格切换
        </n-button>
        <n-button
          size="small"
          :type="advancedEdit.activePanel === PanelType.ConditionFilter ? 'primary' : 'default'"
          @pointerdown="() => advancedEdit.setActivePanel(PanelType.ConditionFilter)"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'wrench']" />
          </template>
          条件筛选
        </n-button>
        <n-button
          v-if="showScriptTab"
          size="small"
          :type="advancedEdit.activePanel === PanelType.Script ? 'primary' : 'default'"
          @pointerdown="() => advancedEdit.setActivePanel(PanelType.Script)"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'wrench']" />
          </template>
          脚本
        </n-button>
      </div>
      <div class="to-list" @pointerdown="advancedEdit.exitToList">
        <font-awesome-icon class="to-list-icon" :icon="['fas', 'table-cells']" />
        <span class="to-list-label">字符列表</span>
      </div>
    </header>
    <main class="advanced-edit-panel-main">
      <GlobalParamsPanel v-if="advancedEdit.activePanel === PanelType.GlobalVariables" />
      <ConditionFilterPanel v-else-if="advancedEdit.activePanel === PanelType.ConditionFilter" />
      <ScriptsPanel v-else-if="showScriptTab && advancedEdit.activePanel === PanelType.Script" />
      <StrokeReplacePanel v-else-if="advancedEdit.activePanel === PanelType.StrokeReplace" />
      <StyleSwitchPanel v-else-if="advancedEdit.activePanel === PanelType.StyleSwitch" />
    </main>
  </div>
</template>

<style scoped>
.advanced-edit-panel {
  width: 100%;
  height: 100%;
}
.advanced-edit-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;
  padding-left: 5px;
  flex-wrap: wrap;
  gap: 6px;
}
.title {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.to-list {
  margin: 5px;
  margin-left: auto;
  line-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 100px;
  cursor: pointer;
  background-color: var(--primary-5);
  color: var(--primary-0);
}
.to-list:hover {
  background-color: var(--primary-4);
}
.to-list-icon {
  flex: 0 0 32px;
  text-align: center;
  color: var(--primary-0);
}
.to-list-label {
  color: var(--primary-0);
}
.advanced-edit-panel-main {
  width: 100%;
  height: calc(100% - 50px);
  background-color: white;
  overflow: hidden;
}
</style>
