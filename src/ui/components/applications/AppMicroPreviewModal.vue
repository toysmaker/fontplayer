<template>
  <n-modal
    :show="store.previewMode"
    preset="card"
    :title="t('applications.microEditor.preview')"
    class="micro-preview-modal"
    :style="{ width: '920px', maxWidth: '94vw' }"
    :mask-closable="true"
    @update:show="(v: boolean) => { if (!v) store.previewMode = false }"
  >
    <div class="preview-body">
      <!-- 输入模拟控件（与内嵌 PreviewPanel 一致） -->
      <div class="preview-controls">
        <div v-for="input in inputs" :key="input.id" class="preview-control">
          <span class="preview-control-name">{{ input.name }}</span>
          <n-switch
            v-if="input.type === 'boolean'"
            size="small"
            :value="Boolean(store.previewValues[input.id])"
            @update:value="(v: boolean) => store.setPreviewValue(input.id, v)"
          />
          <n-button
            v-else-if="input.type === 'trigger'"
            size="tiny"
            type="primary"
            @click="handleTrigger(input.id)"
            @pointerup="handleTrigger(input.id)"
          >{{ t('dialogs.microInteraction.trigger') }}</n-button>
          <n-slider
            v-else
            class="preview-control-slider"
            :value="Number(store.previewValues[input.id] ?? input.defaultValue)"
            :min="0"
            :max="100"
            @update:value="(v: number) => store.setPreviewValue(input.id, v)"
          />
        </div>
        <n-empty
          v-if="inputs.length === 0"
          size="small"
          :description="t('dialogs.microInteraction.noInputs')"
        />
      </div>

      <!-- 预览画布：居中适配（小于区域用原尺寸，大于则等比缩放） -->
      <div ref="stageAreaRef" class="preview-canvas-area">
        <canvas
          ref="canvasRef"
          class="preview-canvas"
          :width="videoWidth"
          :height="videoHeight"
        />
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NEmpty, NModal, NSlider, NSwitch } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { renderAppVideoFrame } from '@/features/applications/video/compose'
import { videoTotalDuration } from '@/features/applications/video/videoData'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { ICardAppData, IApplicationDocument } from '@/features/applications/types'

const props = defineProps<{
  /** 实时文档/画布/字库：预览始终使用最新状态（避免打开对话框时字库未就绪导致空白） */
  doc: IApplicationDocument
  cardData: ICardAppData
  library: FontLibrary | null
}>()

const { t } = useI18n()
const store = useMicroInteractionStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const inputs = computed(() => store.draft?.inputs ?? [])

const currentState = computed(() => {
  const id = store.currentStateId
  if (!id) return null
  return store.draft?.states.find((s) => s.id === id) ?? null
})

const currentSegment = computed(() => {
  const segId = currentState.value?.segmentId
  if (!segId) return null
  const video = props.doc.videos.find((v) => v.id === segId) ?? null
  return video
    ? { id: segId, video, cardData: props.cardData, library: props.library }
    : null
})

const videoWidth = computed(() => (currentSegment.value?.video as { width?: number } | undefined)?.width ?? 320)
const videoHeight = computed(() => (currentSegment.value?.video as { height?: number } | undefined)?.height ?? 180)

let rafId = 0
let start = 0
let token = 0

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

function startLoop() {
  stopLoop()
  const seg = currentSegment.value
  const canvas = canvasRef.value
  if (!seg?.video || !seg.library) return
  if (!canvas) {
    // 模态内容尚未挂载：下一帧重试（修复初始空白）
    requestAnimationFrame(() => {
      if (store.previewMode) startLoop()
    })
    return
  }
  const video = seg.video as never
  const cardData = seg.cardData as never
  const library = seg.library as never
  const myToken = ++token
  start = performance.now()
  const loop = (now: number) => {
    if (myToken !== token) return
    const duration = Math.max(1, videoTotalDuration(video))
    const time = ((now - start) / 1000) % duration
    void renderAppVideoFrame(canvas, video, cardData, library, time).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[AppMicroPreview] render failed:', err)
      }
    })
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

// 预览开启/状态切换/画布尺寸变化时重启循环
watch(
  () => [store.previewMode, store.playNonce, currentState.value?.id, videoWidth.value, videoHeight.value, props.library] as const,
  () => {
    if (store.previewMode) startLoop()
    else stopLoop()
  },
  { immediate: true }
)

onUnmounted(() => {
  stopLoop()
  unbindStageEvents()
})

// ---- hover/click 事件自动绑定 ----
const stageAreaRef = ref<HTMLDivElement | null>(null)

function sourceOf(input: { source?: string; type: string }): 'hover' | 'click' | 'custom' {
  if (input.source === 'hover' || input.source === 'click') return input.source
  return input.type === 'trigger' ? 'click' : 'custom'
}

function applyHover(value: boolean) {
  for (const input of inputs.value) {
    if (sourceOf(input) === 'hover') store.setPreviewValue(input.id, value)
  }
}

function applyClick() {
  for (const input of inputs.value) {
    if (sourceOf(input) !== 'click') continue
    if (input.type === 'trigger') store.triggerPreviewInput(input.id)
    else if (input.type === 'boolean') {
      store.setPreviewValue(input.id, !Boolean(store.previewValues[input.id]))
    }
  }
}

let boundEl: HTMLElement | null = null
function bindStageEvents() {
  const el = stageAreaRef.value
  if (!el || boundEl === el) return
  boundEl = el
  el.addEventListener('pointerenter', onPointerEnter)
  el.addEventListener('pointerleave', onPointerLeave)
  el.addEventListener('click', onClick)
}

function unbindStageEvents() {
  if (!boundEl) return
  boundEl.removeEventListener('pointerenter', onPointerEnter)
  boundEl.removeEventListener('pointerleave', onPointerLeave)
  boundEl.removeEventListener('click', onClick)
  boundEl = null
}

const onPointerEnter = () => applyHover(true)
const onPointerLeave = () => applyHover(false)
const onClick = () => applyClick()

// 预览打开：等模态内容挂载后再绑定（nextTick 保证 ref 可用）
watch(
  () => store.previewMode,
  async (v) => {
    if (v) {
      await nextTick()
      bindStageEvents()
    } else {
      unbindStageEvents()
    }
  }
)

const handleTrigger = createDebouncedHandler(
  (id: string) => store.triggerPreviewInput(id),
  'AppMicroPreviewModal.trigger',
  (args) => args[0],
)
</script>

<style scoped>
.preview-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 560px;
  min-height: 0;
}

.preview-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.preview-control {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.preview-control-name {
  flex: 0 0 auto;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-control-slider {
  width: 120px;
}

/* 固定大小画布区：内容居中，超出等比缩放 */
.preview-canvas-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #14161a;
  border-radius: 6px;
  overflow: hidden;
  padding: 10px;
  box-sizing: border-box;
}

.preview-canvas {
  /* 只约束最大值：小于区域保持原尺寸，大于区域等比缩小，宽高比不变 */
  max-width: 100%;
  max-height: 100%;
  display: block;
  background: #fff;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}
</style>
