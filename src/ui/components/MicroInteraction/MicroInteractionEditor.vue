<template>
  <div class="micro-editor">
    <!-- 顶部工具栏 -->
    <div class="micro-toolbar">
      <div class="micro-toolbar-left">
        <n-button size="small" text-color="var(--primary-3)" @click="handleNewState" @pointerup="handleNewState">
          <template #icon><font-awesome-icon :icon="['fas', 'square-plus']" /></template>
          {{ t('dialogs.microInteraction.newState') }}
        </n-button>
        <n-button
          size="small"
          :type="store.previewMode ? 'warning' : 'default'"
          :text-color="store.previewMode ? undefined : 'var(--primary-3)'"
          @click="handleTogglePreview"
          @pointerup="handleTogglePreview"
        >
          <template #icon><font-awesome-icon :icon="['fas', store.previewMode ? 'eye-slash' : 'eye']" /></template>
          {{ store.previewMode ? t('dialogs.microInteraction.exitPreview') : t('dialogs.microInteraction.preview') }}
        </n-button>
        <!-- 使用说明：圆形黑色小问号，悬浮显示 tip -->
        <n-tooltip trigger="hover" placement="bottom" :overlay-style="{ background: '#000' }">
          <template #trigger>
            <span class="micro-help-icon">
              <font-awesome-icon :icon="['fas', 'question']" />
            </span>
          </template>
          <div class="micro-help-tip">{{ t('dialogs.microInteraction.helpContent') }}</div>
        </n-tooltip>
      </div>
      <div class="micro-toolbar-right">
        <n-button size="small" type="primary" @click="handleExport" @pointerup="handleExport">
          <template #icon><font-awesome-icon :icon="['fas', 'download']" /></template>
          {{ t('dialogs.microInteraction.export') }}
        </n-button>
        <n-button size="small" text-color="var(--primary-3)" @click="handleExportPage" @pointerup="handleExportPage">
          <template #icon><font-awesome-icon :icon="['fas', 'file-code']" /></template>
          {{ t('dialogs.microInteraction.exportPage') }}
        </n-button>
      </div>
    </div>

    <!-- 主体三栏 -->
    <div class="micro-main">
      <div class="micro-left">
        <SegmentList :segments="segments" />
        <n-divider style="margin: 8px 0" />
        <InputList
          :inputs="store.draft?.inputs ?? []"
          :selected-input-id="store.selected?.kind === 'input' ? store.selected.id : null"
          @select="(id: string) => store.select({ kind: 'input', id })"
        />
      </div>

      <div class="micro-center">
        <StateCanvas />
        <PreviewPanel v-if="store.previewMode" />
      </div>

      <div class="micro-right">
        <PropertiesPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 微交互编辑器主容器：管理状态机数据（store 草稿）、画布与面板。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NDivider, NTooltip, useMessage } from 'naive-ui'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { useAnimationStore } from '@/stores/animation'
import { useCharacterStore } from '@/stores/character'
import {
  clipDurationMs,
  exportMicroInteractionFile,
  exportMicroPlayerPage,
} from '@/features/animation/stateMachineExporter'
import { createDebouncedHandler } from '@/utils/debounce-click'
import SegmentList, { type SegmentItem } from './SegmentList.vue'
import InputList from './InputList.vue'
import StateCanvas from './StateCanvas.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import PreviewPanel from './PreviewPanel.vue'

const { t } = useI18n()
const message = useMessage()
const store = useMicroInteractionStore()
const animationStore = useAnimationStore()
const characterStore = useCharacterStore()


/** 动画片段（来自当前字符已有的动效视频列表） */
const segments = computed<SegmentItem[]>(() =>
  animationStore.clips.map((c) => ({
    id: c.id,
    name: c.name,
    duration: Math.round((clipDurationMs(c) / 1000) * 10) / 10,
  })),
)

const _newState = () => {
  if (!store.draft) return
  if (animationStore.clips.length === 0) {
    message.warning(t('dialogs.microInteraction.emptySegments'))
    return
  }
  const n = store.draft.states.length
  store.addState(
    animationStore.clips[0].name,
    animationStore.clips[0].id,
    { x: 60 + (n % 3) * 60, y: 60 + Math.floor(n / 3) * 90 },
  )
}
const handleNewState = createDebouncedHandler(_newState, 'MicroInteractionEditor.newState')

const _togglePreview = () => {
  store.togglePreviewMode()
}
// click + pointerup 双触发会把 toggle 执行两次（开→关），必须防抖
const handleTogglePreview = createDebouncedHandler(_togglePreview, 'MicroInteractionEditor.togglePreview')

const _export = () => {
  const draft = store.draft
  if (!draft) return
  if (draft.states.length === 0) {
    message.warning(t('dialogs.microInteraction.noStates'))
    return
  }
  const ch = characterStore.editingCharacter
  if (!ch) return
  message.info(t('dialogs.microInteraction.generating'))
  exportMicroInteractionFile(draft, animationStore.clips, ch)
  message.success(t('dialogs.microInteraction.exported'))
}
const handleExport = createDebouncedHandler(_export, 'MicroInteractionEditor.export')

/** 导出播放器演示页面：数据 + 通用播放器打包为单个 HTML，双击即可运行 */
const _exportPage = () => {
  const draft = store.draft
  if (!draft) return
  if (draft.states.length === 0) {
    message.warning(t('dialogs.microInteraction.noStates'))
    return
  }
  const ch = characterStore.editingCharacter
  if (!ch) return
  message.info(t('dialogs.microInteraction.generating'))
  exportMicroPlayerPage(draft, animationStore.clips, ch)
  message.success(t('dialogs.microInteraction.exportedPage'))
}
const handleExportPage = createDebouncedHandler(_exportPage, 'MicroInteractionEditor.exportPage')
</script>

<style scoped>
.micro-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.micro-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid #e0e0e6;
}
.micro-toolbar-left,
.micro-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.micro-help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #000;
  color: #9a9a9a;
  cursor: help;
  font-size: 11px;
  flex: 0 0 auto;
}
.micro-help-tip {
  max-width: 420px;
  color: #e8e8e8;
  font-size: 12px;
  line-height: 1.6;
  padding: 4px 2px;
  white-space: normal;
}
.micro-main {
  flex: 1;
  display: flex;
  min-height: 0;
}
.micro-left {
  flex: 0 0 220px;
  border-right: 1px solid #e0e0e6;
  padding: 8px;
  overflow-y: auto;
}
.micro-center {
  flex: 1;
  position: relative;
  min-width: 0;
}
.micro-right {
  flex: 0 0 260px;
  min-width: 0;
  border-left: 1px solid #e0e0e6;
  overflow: hidden;
}
</style>
