<template>
  <div class="preview-panel">
    <!-- 输入模拟控件 -->
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

    <!-- 当前状态片段播放 -->
    <div class="preview-player">
      <div class="preview-state-name">
        {{ currentStateName }}
      </div>
      <ClipPlayer
        :clip="currentClip"
        :char="character"
        :playing="true"
        :loop="currentState?.loop ?? false"
        :restart-token="store.playNonce"
        :size="160"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 预览模式：模拟输入变化，根据当前状态与转换条件自动切换状态并播放对应片段。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NEmpty, NSlider, NSwitch } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { useAnimationStore } from '@/stores/animation'
import { useCharacterStore } from '@/stores/character'
import ClipPlayer from './ClipPlayer.vue'

const { t } = useI18n()
const store = useMicroInteractionStore()

// click + pointerup 双触发会把触发器脉冲执行两次，防抖（按输入 id 区分）
const handleTrigger = createDebouncedHandler(
  (id: string) => store.triggerPreviewInput(id),
  'PreviewPanel.trigger',
  (args) => args[0],
)
const animationStore = useAnimationStore()
const characterStore = useCharacterStore()

const inputs = computed(() => store.draft?.inputs ?? [])
const character = computed(() => characterStore.editingCharacter)

const currentState = computed(() => {
  const id = store.currentStateId
  if (!id) return null
  return store.draft?.states.find((s) => s.id === id) ?? null
})

const currentStateName = computed(() => {
  const st = currentState.value
  return st ? `${st.name}${st.loop ? ' ↻' : ''}` : t('dialogs.microInteraction.noState')
})

const currentClip = computed(() => {
  const segId = currentState.value?.segmentId
  if (!segId) return null
  return animationStore.clips.find((c) => c.id === segId) ?? null
})
</script>

<style scoped>
.preview-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.97);
  border-bottom: 1px solid #e0e0e6;
  padding: 8px;
  display: flex;
  gap: 12px;
  align-items: stretch;
  flex-wrap: wrap;
}
.preview-controls {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}
.preview-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.preview-control-name {
  flex: 0 0 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-control-slider {
  flex: 1;
}
.preview-player {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.preview-state-name {
  font-size: 12px;
  font-weight: 600;
}
</style>
