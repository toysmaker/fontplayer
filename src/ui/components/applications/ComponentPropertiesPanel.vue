<template>
  <div class="component-panel">
    <div class="panel-toolbar">
      <n-button size="tiny" @click="handleAddImage" @pointerup="handleAddImage">
        {{ t('applications.cardEditor.addImage') }}
      </n-button>
      <n-button size="tiny" @click="handleAddFreeText" @pointerup="handleAddFreeText">
        {{ t('applications.cardEditor.addFreeText') }}
      </n-button>
      <n-button size="tiny" @click="handleAddCharGrid" @pointerup="handleAddCharGrid">
        {{ t('applications.cardEditor.addCharGrid') }}
      </n-button>
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

          <div class="param-row">
            <span class="param-label">{{ t('applications.cardEditor.x') }}</span>
            <n-input-number v-model:value="selected.x" size="small" />
            <span class="param-label">{{ t('applications.cardEditor.y') }}</span>
            <n-input-number v-model:value="selected.y" size="small" />
          </div>
          <div class="param-row">
            <span class="param-label">{{ t('applications.cardEditor.w') }}</span>
            <n-input-number v-model:value="selected.width" size="small" :min="10" />
            <span class="param-label">{{ t('applications.cardEditor.h') }}</span>
            <n-input-number v-model:value="selected.height" size="small" :min="10" />
          </div>

          <!-- 图片组件 -->
          <template v-if="selected.kind === 'image'">
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.opacity') }}</span>
              <n-slider v-model:value="selected.opacity" :min="0" :max="1" :step="0.05" class="slider" />
            </div>
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.imageSource') }}</span>
              <n-select
                v-model:value="selectedPatternId"
                size="small"
                :options="patternOptions"
                class="grow"
              />
              <n-button size="tiny" @click="handleImportImage" @pointerup="handleImportImage">
                {{ t('applications.cardEditor.importImage') }}
              </n-button>
            </div>
          </template>

          <!-- 自由排版 -->
          <template v-else-if="selected.kind === 'freeText'">
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.text') }}</span>
            </div>
            <n-input v-model:value="selected.text" type="textarea" size="small" :rows="2" />
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.fontSize') }}</span>
              <n-input-number v-model:value="selected.fontSize" size="small" :min="1" />
              <span class="param-label">{{ t('applications.cardEditor.lineHeight') }}</span>
              <n-input-number v-model:value="selected.lineHeight" size="small" :min="0.5" :step="0.1" />
            </div>
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.direction') }}</span>
              <n-radio-group v-model:value="selected.direction" size="small">
                <n-radio-button value="horizontal">{{ t('applications.cardEditor.horizontal') }}</n-radio-button>
                <n-radio-button value="vertical">{{ t('applications.cardEditor.vertical') }}</n-radio-button>
              </n-radio-group>
            </div>
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.align') }}</span>
              <n-radio-group v-model:value="selectedAlign" size="small">
                <n-radio-button value="left">{{ t('applications.cardEditor.alignLeft') }}</n-radio-button>
                <n-radio-button value="center">{{ t('applications.cardEditor.alignCenter') }}</n-radio-button>
                <n-radio-button value="right">{{ t('applications.cardEditor.alignRight') }}</n-radio-button>
              </n-radio-group>
            </div>
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.text') }}</span>
              <n-color-picker v-model:value="selected.color" size="small" :show-alpha="false" :modes="['hex']" />
            </div>
          </template>

          <!-- 字符网格 -->
          <template v-else-if="selected.kind === 'charGrid'">
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.gridContent') }}</span>
            </div>
            <n-input v-model:value="selected.content" type="textarea" size="small" :rows="2" />
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.cols') }}</span>
              <n-input-number v-model:value="selected.cols" size="small" :min="1" />
              <span class="param-label">{{ t('applications.cardEditor.rows') }}</span>
              <n-input-number v-model:value="selected.rows" size="small" :min="1" />
            </div>
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.gapX') }}</span>
              <n-input-number v-model:value="selected.gapX" size="small" :min="0" />
              <span class="param-label">{{ t('applications.cardEditor.gapY') }}</span>
              <n-input-number v-model:value="selected.gapY" size="small" :min="0" />
            </div>
            <div class="param-row">
              <span class="param-label">{{ t('applications.cardEditor.fontSize') }}</span>
              <n-input-number v-model:value="selected.fontSize" size="small" :min="1" />
              <span class="param-label">{{ t('applications.cardEditor.text') }}</span>
              <n-color-picker v-model:value="selected.color" size="small" :show-alpha="false" :modes="['hex']" />
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
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSlider,
} from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { BUILTIN_PATTERNS } from '@/features/applications/canvas/patterns'
import type { useAppCanvasEditor } from '@/features/applications/canvas/useAppCanvasEditor'
import type { IAppComponent } from '@/features/applications/types'

const props = defineProps<{
  editor: ReturnType<typeof useAppCanvasEditor>
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)

const components = computed(() => props.editor.components.value)
/** 显示顺序：z 序倒序（顶行 = 最上层），与画布层级直觉一致 */
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
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.panel-scroll {
  flex: 1;
  min-height: 0;
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

.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.param-label {
  font-size: 12px;
  opacity: 0.8;
  flex-shrink: 0;
}

.slider {
  flex: 1;
  min-width: 60px;
}

.grow {
  flex: 1;
  min-width: 90px;
}

.hidden-input {
  display: none;
}
</style>
