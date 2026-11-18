<template>
  <n-modal
    :show="store.previewMode"
    preset="card"
    :title="t('dialogs.microInteraction.preview')"
    class="micro-preview-modal"
    :style="{ width: '760px', maxWidth: '94vw' }"
    :mask-closable="true"
    @update:show="(v: boolean) => { if (!v) store.previewMode = false }"
  >
    <div class="mpm-body">
      <!-- 输入模拟控件（number/custom 输入仍可手动操作） -->
      <div class="mpm-controls">
        <div v-for="input in inputs" :key="input.id" class="mpm-control">
          <span class="mpm-control-name">{{ input.name }}</span>
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
            class="mpm-control-slider"
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

      <!-- 预览舞台：hover/click 自动绑定到对应变量的输入 -->
      <div ref="stageRef" class="mpm-stage">
        <ClipPlayer
          v-if="currentClip"
          :clip="currentClip"
          :char="character"
          :playing="true"
          :loop="currentState?.loop ?? false"
          :restart-token="store.playNonce"
          :size="360"
        />
        <n-empty v-else size="small" :description="t('dialogs.microInteraction.noState')" />
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
import { useAnimationStore } from '@/stores/animation'
import { useCharacterStore } from '@/stores/character'
import ClipPlayer from './ClipPlayer.vue'

const { t } = useI18n()
const store = useMicroInteractionStore()
const animationStore = useAnimationStore()
const characterStore = useCharacterStore()

const stageRef = ref<HTMLDivElement | null>(null)

const inputs = computed(() => store.draft?.inputs ?? [])
const character = computed(() => characterStore.editingCharacter)

const currentState = computed(() => {
  const id = store.currentStateId
  if (!id) return null
  return store.draft?.states.find((s) => s.id === id) ?? null
})

const currentClip = computed(() => {
  const segId = currentState.value?.segmentId
  if (!segId) return null
  return animationStore.clips.find((c) => c.id === segId) ?? null
})

/** 事件绑定契约：hover → 指针进入/离开；click → 点击（trigger 瞬时复位 / boolean 切换） */
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

const onPointerEnter = () => applyHover(true)
const onPointerLeave = () => applyHover(false)
const onClick = () => applyClick()

let boundEl: HTMLElement | null = null
function bindStageEvents() {
  const el = stageRef.value
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

onUnmounted(unbindStageEvents)

const handleTrigger = createDebouncedHandler(
  (id: string) => store.triggerPreviewInput(id),
  'MicroPreviewModal.trigger',
  (args) => args[0],
)
</script>

<style scoped>
.mpm-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 540px;
  min-height: 0;
}

.mpm-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.mpm-control {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.mpm-control-name {
  flex: 0 0 auto;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpm-control-slider {
  width: 120px;
}

/* 固定大小舞台：内容居中，超出等比缩放 */
.mpm-stage {
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
  cursor: pointer;
}

.mpm-stage :deep(.clip-player-canvas) {
  max-width: 100%;
  max-height: 100%;
}
</style>
