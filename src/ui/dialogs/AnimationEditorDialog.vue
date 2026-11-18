<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('dialogs.animationEditor.title')"
    class="animation-editor-dialog"
    :style="{ width: '1180px', maxWidth: '96vw' }"
    :mask-closable="false"
    @update:show="(v: boolean) => emit('update:visible', v)"
  >
    <!-- 顶部：名称（必填） -->
    <div class="anim-editor-top">
      <span class="anim-editor-label">{{ t('dialogs.animationEditor.name') }}</span>
      <n-input
        v-model:value="draftName"
        class="anim-editor-name"
        :placeholder="t('dialogs.animationEditor.namePlaceholder')"
        :status="nameError ? 'error' : undefined"
        maxlength="40"
        show-count
        @update:value="nameError = false"
      />
      <span v-if="nameError" class="anim-editor-name-error">{{ t('dialogs.animationEditor.nameRequired') }}</span>
      <span class="anim-editor-render">
        <span class="anim-editor-label">{{ t('panels.settingsPanel.render.title') }}</span>
        <n-radio-group v-model:value="draftRenderStyle" size="small">
          <n-radio value="contour">{{ t('panels.settingsPanel.render.contour') }}</n-radio>
          <n-radio value="black">{{ t('panels.settingsPanel.render.black') }}</n-radio>
          <n-radio value="color">{{ t('panels.settingsPanel.render.color') }}</n-radio>
        </n-radio-group>
      </span>
    </div>

    <div class="anim-editor-body">
      <!-- 左栏：关键帧 / 组件列表（tab 切换，可拖拽排序） -->
      <div class="anim-editor-left">
        <div class="anim-editor-tabs">
          <n-button
            size="small"
            :type="activeTab === 'keyframes' ? 'primary' : 'default'"
            :text-color="activeTab === 'keyframes' ? undefined : 'var(--primary-3)'"
            @click="activeTab = 'keyframes'"
            @pointerup="activeTab = 'keyframes'"
          >{{ t('dialogs.animationEditor.tabs.keyframes') }}</n-button>
          <n-button
            size="small"
            :type="activeTab === 'components' ? 'primary' : 'default'"
            :text-color="activeTab === 'components' ? undefined : 'var(--primary-3)'"
            @click="activeTab = 'components'"
            @pointerup="activeTab = 'components'"
          >{{ t('dialogs.animationEditor.tabs.components') }}</n-button>
        </div>

        <!-- 关键帧列表 -->
        <div v-show="activeTab === 'keyframes'" class="anim-editor-list">
          <n-empty
            v-if="sortedKeyframes.length === 0"
            size="small"
            :description="t('dialogs.animationEditor.keyframes.empty')"
          />
          <div
            v-for="(kf, index) in sortedKeyframes"
            :key="kf.id"
            class="anim-kf-row"
            :class="{ selected: kf.id === selectedKeyframeId }"
            draggable="true"
            @click="selectKeyframe(kf.id)"
            @pointerup="selectKeyframe(kf.id)"
            @dragstart="onKfDragStart(index)"
            @dragover.prevent
            @drop="onKfDrop(index)"
          >
            <font-awesome-icon class="anim-kf-drag" :icon="['fas', 'grip-vertical']" />
            <span class="anim-kf-name">#{{ index + 1 }}</span>
            <span v-if="kf.hidden" class="anim-kf-hidden-tag">{{ t('dialogs.animationEditor.keyframes.hiddenTag') }}</span>
            <n-input-number
              class="anim-kf-time"
              size="small"
              :value="kf.time"
              :min="0"
              :step="0.1"
              :precision="2"
              :show-button="false"
              @update:value="(v: number | null) => onKfTimeChange(kf.id, v)"
            />
            <span class="anim-kf-unit">{{ t('dialogs.animationEditor.second') }}</span>
          </div>
        </div>

        <!-- 组件列表（可拖拽排序，仅影响编辑器内显示顺序） -->
        <div v-show="activeTab === 'components'" class="anim-editor-list">
          <n-empty
            v-if="componentRows.length === 0"
            size="small"
            :description="t('dialogs.animationEditor.components.noComponents')"
          />
          <div
            v-for="(row, index) in componentRows"
            :key="row.uuid"
            class="anim-comp-row"
            :class="{ selected: row.uuid === selectedComponentUUID }"
            draggable="true"
            @click="selectComponent(row.uuid)"
            @pointerup="selectComponent(row.uuid)"
            @dragstart="onCompDragStart(index)"
            @dragover.prevent
            @drop="onCompDrop(index)"
          >
            <font-awesome-icon class="anim-kf-drag" :icon="['fas', 'grip-vertical']" />
            <span class="anim-comp-name">{{ row.name }}</span>
          </div>
        </div>
      </div>

      <!-- 中栏：画布预览 + 底部按钮行 -->
      <div class="anim-editor-center">
        <div class="anim-editor-canvas-wrap">
          <canvas ref="previewCanvasRef" class="anim-editor-canvas" width="420" height="420" />
        </div>
        <div class="anim-editor-buttons">
          <n-button size="small" type="primary" @click="handleInsertKeyframe" @pointerup="handleInsertKeyframe">
            {{ t('dialogs.animationEditor.keyframes.insert') }}
          </n-button>
          <n-button size="small" :type="playback.playing.value ? 'warning' : 'default'" @click="handleTogglePlay" @pointerup="handleTogglePlay">
            <template #icon>
              <font-awesome-icon :icon="['fas', playback.playing.value ? 'stop' : 'play']" />
            </template>
            {{ playback.playing.value ? t('dialogs.animationEditor.keyframes.stop') : t('dialogs.animationEditor.keyframes.play') }}
          </n-button>
          <n-button size="small" @click="exportVisible = true" @pointerup="exportVisible = true">
            <template #icon>
              <font-awesome-icon :icon="['fas', 'download']" />
            </template>
            {{ t('dialogs.animationEditor.keyframes.export') }}
          </n-button>
        </div>
      </div>

      <!-- 右栏：参数列表（默认字符参数；选中组件后切换为组件参数） -->
      <div class="anim-editor-right">
        <div class="anim-editor-params-head">
          <span class="anim-editor-params-title">{{ t('dialogs.animationEditor.params.title') }}</span>
          <n-switch
            :value="hideSwitchValue"
            :disabled="!selectedKeyframe"
            @update:value="onHideSwitchChange"
          >
            <template #checked>{{ hideSwitchLabel }}</template>
            <template #unchecked>{{ hideSwitchLabel }}</template>
          </n-switch>
        </div>
        <div class="anim-editor-params-hint">
          {{ selectedComponentUUID ? t('dialogs.animationEditor.params.hideComponentHint') : t('dialogs.animationEditor.params.hideAllHint') }}
        </div>

        <div class="anim-editor-params-comp-name">
          {{ selectedComponentUUID ? t('dialogs.animationEditor.params.componentParams') + ' · ' + (selectedComponentRow?.name ?? '') : t('dialogs.animationEditor.params.characterParams') }}
        </div>

        <n-empty
          v-if="displayRows.length === 0"
          size="small"
          :description="selectedComponentUUID ? t('dialogs.animationEditor.components.noParams') : t('dialogs.animationEditor.params.noCharacterParams')"
        />
        <div
          v-for="row in displayRows"
          :key="row.uuid"
          class="anim-editor-param-row"
        >
          <span class="anim-editor-param-name">{{ row.name }}</span>
          <div class="anim-editor-param-input">
            <!-- Number / Number 常量：输入框 + slider -->
            <template v-if="row.type === ParameterType.Number || isNumberConstant(row)">
              <n-input-number
                size="small"
                :value="getRowValue(row)"
                :min="getRowMin(row)"
                :max="getRowMax(row)"
                :step="getRowStep(row)"
                :precision="getRowPrecision(row)"
                :disabled="paramControlsDisabled"
                @update:value="(v: number | null) => setRowValue(row, v)"
              />
              <n-slider
                class="anim-editor-param-slider"
                :value="getRowValue(row)"
                :min="getRowMin(row)"
                :max="getRowMax(row)"
                :step="getRowStep(row)"
                :disabled="paramControlsDisabled"
                @update:value="(v: number) => setRowValue(row, v)"
              />
            </template>
            <!-- Enum -->
            <n-select
              v-else-if="row.type === ParameterType.Enum"
              size="small"
              :value="getRowValue(row)"
              :options="row.options || []"
              :disabled="paramControlsDisabled"
              @update:value="(v: number) => setRowValue(row, v)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <template #footer>
      <div class="anim-editor-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.animationEditor.cancel') }}</n-button>
        <n-button type="primary" @click="handleSaveClip" @pointerup="handleSaveClip">{{ t('dialogs.animationEditor.saveClip') }}</n-button>
      </div>
    </template>
  </n-modal>

  <!-- 导出小对话框（叠加在当前对话框之上，不关闭编辑对话框） -->
  <AnimationExportDialog
    v-model:visible="exportVisible"
    :clip="draftClip"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { NButton, NEmpty, NInput, NInputNumber, NModal, NSelect, NSlider, NSwitch, useMessage , NRadioGroup, NRadio } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import { ParameterType, type IAnimationClip, type IAnimationKeyframe, type ICustomGlyph, type IGlyphComponent, type IParameter } from '@/core/types'
import { useAnimationStore } from '@/stores/animation'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import {
  characterGlyphComponents,
  characterParameterRows,
  editableParameterRows,
} from '@/features/animation/render'
import { useAnimationPlayback } from '@/features/animation/useAnimationPlayback'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { fontRenderStyle } from '@/core/script/globals'
import AnimationExportDialog from './AnimationExportDialog.vue'

const { t } = useI18n()
const message = useMessage()
const animationStore = useAnimationStore()
const characterStore = useCharacterStore()
const projectStore = useProjectStore()

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref<'keyframes' | 'components'>('keyframes')
const draftName = ref('')
const nameError = ref(false)
/** 渲染模式草稿（创建时默认取当前预览模式，可修改） */
const draftRenderStyle = ref<'contour' | 'black' | 'color'>(fontRenderStyle.value as 'contour' | 'black' | 'color')
/** 关键帧草稿（深拷贝，保存时写回 store） */
const keyframes = ref<IAnimationKeyframe[]>([])
const selectedKeyframeId = ref<string | null>(null)
/** 选中的组件（null = 显示字符参数列表） */
const selectedComponentUUID = ref<string | null>(null)
/** 选中组件在当前关键帧下的参数草稿 */
/** 组件列表显示顺序（仅编辑器内排序） */
const componentRows = ref<Array<{ uuid: string; name: string; glyph: ICustomGlyph }>>([])
const exportVisible = ref(false)
let dragIndex = -1

const selectedKeyframe = computed(() => keyframes.value.find((k) => k.id === selectedKeyframeId.value) ?? null)
/** 显式读取 time 建立响应式依赖（时间编辑后列表即时重排） */
const sortedKeyframes = computed(() =>
  keyframes.value
    .map((k) => ({ k, t: k.time }))
    .sort((a, b) => a.t - b.t)
    .map((x) => x.k),
)
const selectedComponentRow = computed(() => componentRows.value.find((r) => r.uuid === selectedComponentUUID.value) ?? null)
const paramControlsDisabled = computed(() => !!selectedKeyframe.value?.hidden)

/** 字符参数行（字符与字形一样可以包含参数） */
const charParamRows = computed<IParameter[]>(() => {
  const ch = characterStore.editingCharacter
  if (!ch) return []
  return characterParameterRows(ch)
})

/** 组件参数行 */
const selectedParamRows = computed<IParameter[]>(() => {
  const row = selectedComponentRow.value
  if (!row) return []
  return editableParameterRows(row.glyph)
})

type DisplayRow = IParameter & {
  kind: 'char' | 'component'
  constUuid: string | null
  /** 合成行：组件位置 X/Y */
  posAxis?: 'x' | 'y'
}

/** 右侧展示的参数行（字符参数 / 组件参数；组件模式顶部加位置 X/Y） */
const displayRows = computed<DisplayRow[]>(() => {
  if (!selectedComponentUUID.value) {
    return charParamRows.value
      .filter((r) => r.type === ParameterType.Number || r.type === ParameterType.Enum || isNumberConstant(r))
      .map((r) => ({ ...r, kind: 'char' as const, constUuid: constantUuidOf(r) }))
  }
  const posRows: DisplayRow[] = [
    {
      uuid: '__pos_x',
      name: t('dialogs.animationEditor.params.positionX'),
      type: ParameterType.Number,
      value: 0,
      kind: 'component',
      constUuid: null,
      posAxis: 'x',
    },
    {
      uuid: '__pos_y',
      name: t('dialogs.animationEditor.params.positionY'),
      type: ParameterType.Number,
      value: 0,
      kind: 'component',
      constUuid: null,
      posAxis: 'y',
    },
  ]
  const rows = selectedParamRows.value
    .filter((r) => r.type === ParameterType.Number || r.type === ParameterType.Enum || isNumberConstant(r))
    .map((r) => ({ ...r, kind: 'component' as const, constUuid: constantUuidOf(r) }))
  return [...posRows, ...rows]
})

// ---------------- 常量（引用类型为 Number 的 constant） ----------------

function constantMetaOf(row: IParameter) {
  const uuid = String(row.value)
  return projectStore.selectedFile?.constants?.find((c) => c.uuid === uuid) ?? null
}

function constantUuidOf(row: IParameter): string | null {
  if (row.type !== ParameterType.Constant) return null
  const meta = constantMetaOf(row)
  return meta && meta.type === ParameterType.Number ? meta.uuid : null
}

function isNumberConstant(row: IParameter): boolean {
  return row.type === ParameterType.Constant && constantUuidOf(row) !== null
}

function resolvedConstantValue(uuid: string): number {
  const cm = projectStore.constantsMap as { getByUUID?: (u: string) => unknown } | null
  const v = cm?.getByUUID?.(uuid)
  return typeof v === 'number' ? v : 0
}

/** 常量行当前值：关键帧覆盖优先，回退到工程常量解析值 */
function constantValue(row: IParameter): number {
  const uuid = constantUuidOf(row)
  if (!uuid) return 0
  const override = selectedKeyframe.value?.constants?.[uuid]
  return override !== undefined ? override : resolvedConstantValue(uuid)
}

// ---------------- 行值读写（字符/组件/常量统一入口） ----------------

/** 组件当前位置默认值（ox/oy） */
function componentPositionDefault(): { x: number; y: number } {
  const compUuid = selectedComponentUUID.value
  const char = characterStore.editingCharacter
  const comp = compUuid && char ? (char.components || []).find((c) => c.uuid === compUuid) : null
  const gc = comp as IGlyphComponent | null
  return { x: gc?.ox ?? 0, y: gc?.oy ?? 0 }
}

function getRowValue(row: DisplayRow): number {
  const kf = selectedKeyframe.value
  const compUuid = selectedComponentUUID.value
  if (row.posAxis) {
    const stored = compUuid ? kf?.positions?.[compUuid] : undefined
    if (stored && stored[row.posAxis] !== undefined) return stored[row.posAxis]
    const def = componentPositionDefault()
    return row.posAxis === 'x' ? def.x : def.y
  }
  if (row.constUuid) return constantValue(row)
  if (row.kind === 'char') {
    const stored = kf?.charParams?.[row.uuid]
    return stored !== undefined ? stored : Number(row.value)
  }
  const stored = compUuid ? kf?.params?.[compUuid]?.[row.uuid] : undefined
  return stored !== undefined ? stored : Number(row.value)
}

/** 滑块高频拖动时防抖重烘焙（120ms 合并一次） */
let reRenderTimer: number | null = null
function scheduleReRender(kfId: string) {
  if (reRenderTimer != null) clearTimeout(reRenderTimer)
  reRenderTimer = window.setTimeout(() => {
    reRenderTimer = null
    playback.invalidate(kfId)
    renderCurrentKeyframe()
  }, 120)
}

/** 参数修改实时写入当前关键帧（与隐藏开关一致，无需保存） */
function setRowValue(row: DisplayRow, v: number | null) {
  if (v === null || v === undefined) return
  const kf = selectedKeyframe.value
  if (!kf) return
  const compUuid = selectedComponentUUID.value
  if (row.posAxis) {
    if (compUuid) {
      if (!kf.positions) kf.positions = {}
      if (!kf.positions[compUuid]) kf.positions[compUuid] = { ...componentPositionDefault() }
      kf.positions[compUuid][row.posAxis] = v
    }
  } else if (row.constUuid) {
    if (!kf.constants) kf.constants = {}
    kf.constants[row.constUuid] = v
  } else if (row.kind === 'char') {
    if (!kf.charParams) kf.charParams = {}
    kf.charParams[row.uuid] = v
  } else if (compUuid) {
    if (!kf.params[compUuid]) kf.params[compUuid] = {}
    kf.params[compUuid][row.uuid] = v
  }
  scheduleReRender(kf.id)
}

function getRowMin(row: DisplayRow): number {
  if (row.constUuid) {
    const meta = projectStore.selectedFile?.constants?.find((c) => c.uuid === row.constUuid)
    return meta?.min ?? -10000
  }
  return row.min ?? -10000
}

function getRowMax(row: DisplayRow): number {
  if (row.constUuid) {
    const meta = projectStore.selectedFile?.constants?.find((c) => c.uuid === row.constUuid)
    return meta?.max ?? 10000
  }
  return row.max ?? 10000
}

function getRowStep(row: DisplayRow): number {
  const max = getRowMax(row)
  return max <= 10 ? 0.01 : 1
}

function getRowPrecision(row: DisplayRow): number {
  return getRowMax(row) <= 10 ? 2 : 0
}

// ---------------- 草稿片段（供播放/导出使用） ----------------

const draftClip = computed<IAnimationClip | null>(() => {
  if (keyframes.value.length === 0) return null
  return {
    id: animationStore.editingClipId ?? '__draft__',
    name: draftName.value || 'draft',
    keyframes: R.clone(sortedKeyframes.value),
    fps: 30,
    renderStyle: draftRenderStyle.value,
    createdAt: 0,
    updatedAt: 0,
  }
})

const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const playback = useAnimationPlayback({
  canvasRef: previewCanvasRef,
  clipRef: draftClip,
  charRef: computed(() => characterStore.editingCharacter),
  // 参数编辑实时写入关键帧，预览直接渲染关键帧，无需草稿覆盖
})

// ---------------- 初始化 ----------------

function loadDraft() {
  const id = animationStore.editingClipId
  const existing = id ? animationStore.getClip(id) : null
  draftName.value = existing?.name ?? ''
  draftRenderStyle.value = (existing?.renderStyle ?? fontRenderStyle.value) as 'contour' | 'black' | 'color'
  keyframes.value = existing ? R.clone(existing.keyframes) : [{ id: genUUID(), time: 0, hidden: false, params: {} }]
  if (keyframes.value.length > 0) selectedKeyframeId.value = keyframes.value[0].id
  nameError.value = false
  refreshComponentRows()
  // 默认展示字符参数列表（不自动选中组件）
  selectedComponentUUID.value = null
  nextTick(() => renderCurrentKeyframe())
}

function refreshComponentRows() {
  const ch = characterStore.editingCharacter
  if (!ch) {
    componentRows.value = []
    return
  }
  componentRows.value = characterGlyphComponents(ch).map((gc: IGlyphComponent) => ({
    uuid: gc.uuid,
    name: (gc as any).name || (gc.value as ICustomGlyph)?.name || gc.uuid,
    glyph: gc.value as ICustomGlyph,
  }))
}

onMounted(() => {
  loadDraft()
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      loadDraft()
      exportVisible.value = false
    } else {
      // 关闭时停止播放（矢量渲染无 GPU 资源，重开时按需重建画布）
      playback.dispose()
      animationStore.closeClipEditor()
    }
  },
)

// ---------------- 参数草稿 ----------------


function renderCurrentKeyframe() {
  playback.pause()
  const kf = selectedKeyframe.value
  if (!kf) return
  // 对话框刚打开时 canvas 可能尚未挂载（n-modal 内容延迟渲染），下一帧重试
  if (!previewCanvasRef.value) {
    requestAnimationFrame(() => renderCurrentKeyframe())
    return
  }
  playback.renderKeyframe(kf)
}

// ---------------- 关键帧操作 ----------------

function selectKeyframe(id: string) {
  if (playback.playing.value) return
  if (selectedKeyframeId.value === id) return
  selectedKeyframeId.value = id
  playback.invalidate(id)
  renderCurrentKeyframe()
}

function onKfTimeChange(id: string, v: number | null) {
  if (v === null || !isFinite(v) || v < 0) return
  const kf = keyframes.value.find((k) => k.id === id)
  if (!kf) return
  kf.time = v
  if (playback.playing.value) {
    playback.pause()
    playback.play()
  }
}

/**
 * 隐藏开关：
 * - 字符参数模式（未选组件）→ 隐藏所有组件（整字符隐藏，淡入淡出）
 * - 组件模式 → 仅隐藏当前组件（keyframe.hiddenComponents）
 */
const hideSwitchLabel = computed(() =>
  selectedComponentUUID.value
    ? t('dialogs.animationEditor.params.hideComponent')
    : t('dialogs.animationEditor.params.hideAll'),
)

const hideSwitchValue = computed(() => {
  const kf = selectedKeyframe.value
  if (!kf) return false
  if (!selectedComponentUUID.value) return kf.hidden
  return (kf.hiddenComponents ?? []).includes(selectedComponentUUID.value)
})

function onHideSwitchChange(v: boolean) {
  const kf = selectedKeyframe.value
  if (!kf) return
  if (!selectedComponentUUID.value) {
    kf.hidden = v
  } else {
    const uuid = selectedComponentUUID.value
    const list = kf.hiddenComponents ?? []
    const idx = list.indexOf(uuid)
    if (v && idx < 0) {
      if (!kf.hiddenComponents) kf.hiddenComponents = []
      kf.hiddenComponents.push(uuid)
    } else if (!v && idx >= 0) {
      list.splice(idx, 1)
    }
  }
  playback.invalidate(kf.id)
  renderCurrentKeyframe()
}

/** 插入新关键帧：当前参数数值插入到选中关键帧之后 */
const _insertKeyframe = () => {
  if (!selectedKeyframeId.value) return
  const idx = keyframes.value.findIndex((k) => k.id === selectedKeyframeId.value)
  if (idx < 0) return
  const sel = keyframes.value[idx]
  const kf: IAnimationKeyframe = {
    id: genUUID(),
    time: Math.round((sel.time + 1) * 100) / 100,
    hidden: false,
    hiddenComponents: R.clone(sel.hiddenComponents ?? []),
    positions: R.clone(sel.positions ?? {}),
    params: R.clone(sel.params),
    charParams: R.clone(sel.charParams ?? {}),
    constants: R.clone(sel.constants ?? {}),
  }
  keyframes.value.splice(idx + 1, 0, kf)
  selectedKeyframeId.value = kf.id
  playback.invalidate(kf.id)
  renderCurrentKeyframe()
}
const handleInsertKeyframe = createDebouncedHandler(_insertKeyframe, 'AnimationEditorDialog.insertKeyframe')

const _togglePlay = () => {
  if (playback.playing.value) {
    playback.pause()
  } else {
    playback.play()
  }
}
const handleTogglePlay = createDebouncedHandler(_togglePlay, 'AnimationEditorDialog.togglePlay')

// ---------------- 拖拽排序 ----------------

function onKfDragStart(index: number) {
  dragIndex = index
}
function onKfDrop(index: number) {
  if (dragIndex < 0 || dragIndex === index) return
  const item = keyframes.value.splice(dragIndex, 1)[0]
  if (!item) return
  keyframes.value.splice(index, 0, item)
  dragIndex = -1
  renderCurrentKeyframe()
}

function onCompDragStart(index: number) {
  dragIndex = index
}
function onCompDrop(index: number) {
  if (dragIndex < 0 || dragIndex === index) return
  const item = componentRows.value.splice(dragIndex, 1)[0]
  if (!item) return
  componentRows.value.splice(index, 0, item)
  dragIndex = -1
}

// ---------------- 组件选择 ----------------

function selectComponent(uuid: string) {
  selectedComponentUUID.value = uuid
  renderCurrentKeyframe()
}

// ---------------- 保存 / 取消 ----------------

const _saveClip = () => {
  const name = draftName.value.trim()
  if (!name) {
    nameError.value = true
    message.warning(t('dialogs.animationEditor.nameRequired'))
    return
  }
  const id = animationStore.editingClipId
  const existing = id ? animationStore.getClip(id) : null
  const clip: IAnimationClip = {
    id: existing?.id ?? genUUID(),
    name,
    fps: 30,
    keyframes: R.clone(sortedKeyframes.value),
    renderStyle: draftRenderStyle.value,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
  animationStore.saveClip(clip)
  emit('update:visible', false)
  message.success(t('dialogs.animationEditor.saveSuccess', { name }))
}
// click + pointerup 会触发两次（Tauri Webview 修复规范），必须防抖，否则列表出现两个 item
const handleSaveClip = createDebouncedHandler(_saveClip, 'AnimationEditorDialog.saveClip')

const _cancel = () => {
  if (playback.playing.value) playback.pause()
  emit('update:visible', false)
}
const handleCancel = createDebouncedHandler(_cancel, 'AnimationEditorDialog.cancel')

// 编辑页面渲染样式变化（轮廓/黑白/彩色）时刷新静态预览
watch(fontRenderStyle, () => {
  if (!playback.playing.value) renderCurrentKeyframe()
})

// 动效自身渲染模式变化时刷新静态预览
watch(draftRenderStyle, () => {
  if (!playback.playing.value) renderCurrentKeyframe()
})

// 卸载时清理待执行的重烘焙定时器
onUnmounted(() => {
  if (reRenderTimer != null) {
    clearTimeout(reRenderTimer)
    reRenderTimer = null
  }
})
</script>

<style scoped>
.animation-editor-dialog {
  height: 760px;
}
.anim-editor-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
/* 渲染模式固定在最右侧 */
.anim-editor-render {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
/* radio 灰色化：naive-ui 用 box-shadow 画描边、::before 画实心，逐状态覆盖 */
.anim-editor-render :deep(.n-radio__label) {
  color: #9aa3b2 !important;
}
.anim-editor-render :deep(.n-radio__dot) {
  box-shadow: inset 0 0 0 1px #7a8089 !important;
}
.anim-editor-render :deep(.n-radio:hover .n-radio__dot),
.anim-editor-render :deep(.n-radio--checked .n-radio__dot),
.anim-editor-render :deep(.n-radio--checked:hover .n-radio__dot) {
  box-shadow: inset 0 0 0 1px #7a8089 !important;
}
.anim-editor-render :deep(.n-radio__dot::before),
.anim-editor-render :deep(.n-radio__dot:before) {
  background: #9aa3b2 !important;
}
.anim-editor-label {
  flex: 0 0 auto;
  font-size: 13px;
}
.anim-editor-name {
  max-width: 360px;
}
.anim-editor-name-error {
  color: #d03050;
  font-size: 12px;
}
.anim-editor-body {
  display: flex;
  gap: 10px;
  height: 560px;
  padding: 6px;
  border-radius: 4px;
}
.anim-editor-left {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 4px;
  padding: 8px;
  color: var(--light-0);
}
.anim-editor-tabs {
  display: flex;
  gap: 6px;
}
.anim-editor-list {
  flex: 1;
  overflow-y: auto;
}
.anim-kf-row,
.anim-comp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}
.anim-kf-row:hover,
.anim-comp-row:hover {
  background-color: var(--primary-0);
  color: var(--light-0);
}
.anim-kf-row.selected,
.anim-comp-row.selected {
  border-color: var(--primary-3);
  background-color: var(--primary-5);
  color: var(--primary-0);
}
.anim-kf-drag {
  color: #999;
  cursor: grab;
}
.anim-kf-name {
  flex: 0 0 auto;
}
.anim-kf-hidden-tag {
  font-size: 10px;
  color: #e6a23c;
  border: 1px solid #e6a23c;
  border-radius: 2px;
  padding: 0 2px;
}
.anim-kf-time {
  flex: 1;
  min-width: 60px;
}
.anim-kf-unit {
  flex: 0 0 auto;
  color: #999;
}
.anim-comp-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.anim-editor-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 4px;
  padding: 8px;
}
.anim-editor-canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  width: 100%;
}
.anim-editor-canvas {
  max-width: 100%;
  max-height: 100%;
}
.anim-editor-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.anim-editor-right {
  flex: 0 0 260px;
  border-radius: 4px;
  padding: 8px;
  overflow-y: auto;
  color: var(--light-0);
}
.anim-editor-params-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.anim-editor-params-title {
  font-size: 13px;
  font-weight: 600;
}
.anim-editor-params-hint {
  font-size: 11px;
  color: #999;
  margin: 4px 0 8px;
}
.anim-editor-params-comp-name {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.anim-editor-param-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.anim-editor-param-name {
  flex: 0 0 64px;
  font-size: 12px;
  padding-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.anim-editor-param-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.anim-editor-param-slider {
  margin: 0 2px;
}
.anim-editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
