<template>
  <div class="component-panel">
    <!-- 工具栏：图标按钮（hover 提示）+ 底部 border -->
    <div class="panel-toolbar">
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button quaternary circle size="small" @click="handleAddImage" @pointerup="handleAddImage">
            <template #icon><font-awesome-icon :icon="['fas', 'image']" /></template>
          </n-button>
        </template>
        {{ t('applications.cardEditor.addImage') }}
      </n-tooltip>
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button quaternary circle size="small" @click="handleAddFreeText" @pointerup="handleAddFreeText">
            <template #icon><font-awesome-icon :icon="['fas', 'font']" /></template>
          </n-button>
        </template>
        {{ t('applications.cardEditor.addFreeText') }}
      </n-tooltip>
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button quaternary circle size="small" @click="handleAddCharGrid" @pointerup="handleAddCharGrid">
            <template #icon><font-awesome-icon :icon="['fas', 'table-cells']" /></template>
          </n-button>
        </template>
        {{ t('applications.cardEditor.addCharGrid') }}
      </n-tooltip>
    </div>

    <n-scrollbar class="panel-scroll">
      <div class="panel-content">
        <div class="section-label">{{ t('applications.cardEditor.components') }}</div>
        <div v-if="components.length === 0" class="empty-hint">
          {{ t('applications.cardEditor.addComponent') }}
        </div>
        <div
          v-for="(comp, index) in displayComponents"
          :key="comp.id"
          class="component-row"
          :class="{ selected: comp.id === selectedId }"
          draggable="true"
          @click="handleSelectRow(comp.id)"
          @pointerup="handleSelectRow(comp.id)"
          @dragstart="handleDragStart(index)"
          @dragover.prevent
          @drop="handleDrop(index)"
        >
          <span class="component-name">{{ componentLabel(comp, index) }}</span>
          <span class="row-actions">
            <n-button size="tiny" quaternary @click.stop="handleLayerUp(comp.id)" @pointerup.stop="handleLayerUp(comp.id)">↑</n-button>
            <n-button size="tiny" quaternary @click.stop="handleLayerDown(comp.id)" @pointerup.stop="handleLayerDown(comp.id)">↓</n-button>
            <n-button size="tiny" quaternary type="error" @click.stop="handleRemove(comp.id)" @pointerup.stop="handleRemove(comp.id)">✕</n-button>
          </span>
        </div>

        <template v-if="selected">
          <div class="section-label params-label">{{ t('applications.cardEditor.components') }}</div>

          <!-- 通用：位置与尺寸（标签在上，输入占满，带滑杆） -->
          <div class="param-grid">
            <ParamNumberField v-model:model-value="selected.x" :label="t('applications.cardEditor.x')" :min="-4096" :max="4096" />
            <ParamNumberField v-model:model-value="selected.y" :label="t('applications.cardEditor.y')" :min="-4096" :max="4096" />
            <ParamNumberField v-model:model-value="selected.width" :label="t('applications.cardEditor.w')" :min="10" :max="8192" />
            <ParamNumberField v-model:model-value="selected.height" :label="t('applications.cardEditor.h')" :min="10" :max="8192" />
          </div>

          <!-- 图片组件 -->
          <template v-if="selected.kind === 'image'">
            <ParamNumberField v-model:model-value="selected.opacity" :label="t('applications.cardEditor.opacity')" :min="0" :max="1" :step="0.05" />
            <div class="param-field">
              <label class="param-field-label">{{ t('applications.cardEditor.imageSource') }}</label>
              <n-select
                v-model:value="selectedPatternId"
                size="small"
                :options="patternOptions"
                class="param-full"
              />
            </div>
            <n-button size="small" block @click="handleImportImage" @pointerup="handleImportImage">
              {{ t('applications.cardEditor.importImage') }}
            </n-button>
          </template>

          <!-- 自由排版 -->
          <template v-else-if="selected.kind === 'freeText'">
            <ParamTextField v-model:model-value="selected.text" :label="t('applications.cardEditor.text')" type="textarea" :rows="2" />
            <ParamNumberField v-model:model-value="selected.fontSize" :label="t('applications.cardEditor.fontSize')" :min="1" :max="1024" />
            <ParamNumberField v-model:model-value="selected.lineHeight" :label="t('applications.cardEditor.lineHeight')" :min="0.5" :max="3" :step="0.1" />
            <div class="param-field">
              <label class="param-field-label">{{ t('applications.cardEditor.direction') }}</label>
              <n-radio-group v-model:value="selected.direction" size="small" class="app-radio-gray app-radio-vertical">
                <n-radio value="horizontal">{{ t('applications.cardEditor.horizontal') }}</n-radio>
                <n-radio value="vertical">{{ t('applications.cardEditor.vertical') }}</n-radio>
              </n-radio-group>
            </div>
            <div class="param-field">
              <label class="param-field-label">{{ t('applications.cardEditor.align') }}</label>
              <n-radio-group v-model:value="selectedAlign" size="small" class="app-radio-gray">
                <n-radio value="left">{{ t('applications.cardEditor.alignLeft') }}</n-radio>
                <n-radio value="center">{{ t('applications.cardEditor.alignCenter') }}</n-radio>
                <n-radio value="right">{{ t('applications.cardEditor.alignRight') }}</n-radio>
              </n-radio-group>
            </div>
            <div class="param-field">
              <label class="param-field-label">{{ t('applications.cardEditor.textColor') }}</label>
              <n-color-picker v-model:value="selected.color" size="small" :show-alpha="false" :modes="['hex']" class="param-full" />
            </div>
          </template>

          <!-- 字符网格 -->
          <template v-else-if="selected.kind === 'charGrid'">
            <ParamTextField v-model:model-value="selected.content" :label="t('applications.cardEditor.gridContent')" type="textarea" :rows="2" />
            <div class="param-grid">
              <ParamNumberField v-model:model-value="selected.cols" :label="t('applications.cardEditor.cols')" :min="1" :max="64" />
              <ParamNumberField v-model:model-value="selected.rows" :label="t('applications.cardEditor.rows')" :min="1" :max="64" />
              <ParamNumberField v-model:model-value="selected.gapX" :label="t('applications.cardEditor.gapX')" :min="0" :max="1024" />
              <ParamNumberField v-model:model-value="selected.gapY" :label="t('applications.cardEditor.gapY')" :min="0" :max="1024" />
            </div>
            <ParamNumberField v-model:model-value="selected.fontSize" :label="t('applications.cardEditor.fontSize')" :min="1" :max="1024" />
            <div class="param-field">
              <label class="param-field-label">{{ t('applications.cardEditor.textColor') }}</label>
              <n-color-picker v-model:value="selected.color" size="small" :show-alpha="false" :modes="['hex']" class="param-full" />
            </div>
          </template>
        </template>
      </div>
    </n-scrollbar>

    <input ref="fileInputRef" type="file" accept="image/*" class="hidden-input" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NColorPicker,
  NInput,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NTooltip,
} from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { BUILTIN_PATTERNS } from '@/features/applications/canvas/patterns'
import type { useAppCanvasEditor } from '@/features/applications/canvas/useAppCanvasEditor'
import type { IAppComponent } from '@/features/applications/types'
import ParamNumberField from './ParamNumberField.vue'
import ParamTextField from './ParamTextField.vue'

const props = defineProps<{
  editor: ReturnType<typeof useAppCanvasEditor>
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)

const components = computed(() => props.editor.components.value)
/** 显示顺序：z 序倒序（顶行 = 最上层） */
const displayComponents = computed(() => [...components.value].reverse())
const selectedId = computed(() => props.editor.selectedId.value)
const selected = computed(() => props.editor.selected.value)

const patternOptions = computed(() =>
  BUILTIN_PATTERNS.map((p) => ({ label: p.name, value: p.id }))
)

const selectedPatternId = computed({
  get: () => {
    const s = selected.value
    if (s?.kind === 'image' && s.source.kind === 'pattern') return s.source.patternId
    return null
  },
  set: (val: string | null) => {
    const s = selected.value
    if (s?.kind === 'image' && val) {
      s.source = { kind: 'pattern', patternId: val }
    }
  },
})

const selectedAlign = computed({
  get: () => (selected.value?.kind === 'freeText' ? selected.value.align ?? 'left' : 'left'),
  set: (val: 'left' | 'center' | 'right') => {
    const s = selected.value
    if (s?.kind === 'freeText') s.align = val
  },
})

const componentLabel = (comp: IAppComponent, index: number): string => {
  const kindText = {
    image: t('applications.cardEditor.addImage'),
    freeText: t('applications.cardEditor.addFreeText'),
    charGrid: t('applications.cardEditor.addCharGrid'),
  }[comp.kind]
  return `${index + 1}. ${kindText}`
}

const _handleAddImage = () => props.editor.addComponent(props.editor.createImageComponent())
const handleAddImage = createDebouncedHandler(_handleAddImage, 'ComponentPropertiesPanel.addImage')

const _handleAddFreeText = () => props.editor.addComponent(props.editor.createFreeTextComponent())
const handleAddFreeText = createDebouncedHandler(_handleAddFreeText, 'ComponentPropertiesPanel.addFreeText')

const _handleAddCharGrid = () => props.editor.addComponent(props.editor.createCharGridComponent())
const handleAddCharGrid = createDebouncedHandler(_handleAddCharGrid, 'ComponentPropertiesPanel.addCharGrid')

const _handleSelectRow = (id: string) => props.editor.select(id)
const handleSelectRow = createDebouncedHandler(_handleSelectRow, 'ComponentPropertiesPanel.selectRow', (args) => args[0])

const _handleRemove = (id: string) => props.editor.removeComponent(id)
const handleRemove = createDebouncedHandler(_handleRemove, 'ComponentPropertiesPanel.remove', (args) => args[0])

// 图层上下移动：短防抖（80ms），吞掉 click+pointerup 双触发同时允许连点
const _handleLayerUp = (id: string) => props.editor.moveLayer(id, 1)
const handleLayerUp = createDebouncedHandler(_handleLayerUp, 'ComponentPropertiesPanel.layerUp', (args) => args[0], 80)

const _handleLayerDown = (id: string) => props.editor.moveLayer(id, -1)
const handleLayerDown = createDebouncedHandler(_handleLayerDown, 'ComponentPropertiesPanel.layerDown', (args) => args[0], 80)

// ---- 拖拽排序 ----
let dragRowIndex = -1

function handleDragStart(index: number) {
  dragRowIndex = index
}

function handleDrop(index: number) {
  if (dragRowIndex < 0 || dragRowIndex === index) return
  const comp = displayComponents.value[dragRowIndex]
  if (comp) props.editor.moveComponentToDisplayIndex(comp.id, index)
  dragRowIndex = -1
}

const _handleImportImage = () => {
  fileInputRef.value?.click()
}
const handleImportImage = createDebouncedHandler(_handleImportImage, 'ComponentPropertiesPanel.importImage')

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const s = selected.value
    if (s?.kind === 'image' && typeof reader.result === 'string') {
      s.source = { kind: 'file', dataUrl: reader.result }
    }
  }
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.component-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.panel-toolbar {
  display: flex;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--dark-4);
  margin-bottom: 10px;
  flex-shrink: 0;
}

/* 淡灰图标、无描边、无背景；hover 加 primary-3 背景。
   注意：naive-ui 图标颜色在 .n-button__icon 层（--n-icon-color），需逐层覆盖 */
.panel-toolbar :deep(.n-button) {
  background: transparent !important;
  border: none !important;
  color: #9aa3b2;
}

.panel-toolbar :deep(.n-button__icon) {
  color: #9aa3b2 !important;
}

.panel-toolbar :deep(.n-button__icon svg) {
  color: #9aa3b2 !important;
}

.panel-toolbar :deep(.n-button:hover) {
  background: #26282e !important;
  border: none !important;
  color: #e8ecf2;
}

/* 焦点态不复位会保持 hover 背景（点击后按钮持有焦点） */
.panel-toolbar :deep(.n-button:focus) {
  background: transparent !important;
  border: none !important;
  color: #9aa3b2;
}

.panel-toolbar :deep(.n-button:hover .n-button__icon),
.panel-toolbar :deep(.n-button:hover .n-button__icon svg) {
  color: #e8ecf2 !important;
}

.panel-toolbar :deep(.n-button:focus .n-button__icon),
.panel-toolbar :deep(.n-button:focus .n-button__icon svg) {
  color: #9aa3b2 !important;
}

.panel-scroll {
  flex: 1 1 0;
  min-height: 0;
}

.panel-scroll :deep(.n-scrollbar-container) {
  max-height: 100%;
}

.panel-content {
  padding-right: 4px;
  padding-bottom: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.params-label {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--dark-4);
}

.empty-hint {
  font-size: 12px;
  opacity: 0.5;
  margin-bottom: 10px;
}

.component-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border: 1px solid var(--dark-4);
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
  font-size: 12px;
}

.component-row.selected {
  border-color: #4a90e2;
  background: rgba(74, 144, 226, 0.12);
}

.component-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 10px;
}

.param-field {
  margin-bottom: 10px;
}

.param-field-label {
  display: block;
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 4px;
}

.param-full {
  width: 100%;
}

.hidden-input {
  display: none;
}
</style>
