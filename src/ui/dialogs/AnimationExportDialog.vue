<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.animationExport.title')"
    class="animation-export-dialog"
    :style="{ width: '420px' }"
    :mask-closable="!exporting"
    @update:show="(v: boolean) => !exporting && emit('update:visible', v)"
  >
    <div class="anim-export-body">
      <div class="anim-export-row">
        <span class="anim-export-label">{{ t('dialogs.animationExport.format') }}</span>
        <n-radio-group v-model:value="format" :disabled="exporting">
          <n-radio-button value="mp4">mp4</n-radio-button>
          <n-radio-button value="gif">gif</n-radio-button>
          <n-radio-button value="webm">webm</n-radio-button>
          <n-radio-button value="lottie">lottieJson</n-radio-button>
        </n-radio-group>
      </div>

      <div v-if="exporting" class="anim-export-progress">
        <n-progress
          type="line"
          :percentage="progressPercent"
          :indicator-placement="'inside'"
        />
        <div class="anim-export-progress-text">
          {{ t('dialogs.animationExport.progress', { done: progressDone, total: progressTotal }) }}
        </div>
      </div>
      <n-alert v-if="errorMsg" type="error" :title="errorMsg" style="margin-top: 8px" />
      <n-alert v-if="successMsg" type="success" :title="successMsg" style="margin-top: 8px" />
    </div>

    <template #action>
      <div class="anim-export-footer">
        <n-button
          v-if="!exporting && !successMsg"
          @click="handleCancel"
          @pointerup="handleCancel"
        >{{ t('dialogs.animationExport.cancel') }}</n-button>
        <n-button
          v-if="!exporting && !successMsg"
          type="primary"
          @click="handleExport"
          @pointerup="handleExport"
        >{{ t('dialogs.animationExport.export') }}</n-button>
        <n-button
          v-if="successMsg"
          type="primary"
          @click="handleClose"
          @pointerup="handleClose"
        >{{ t('dialogs.animationExport.close') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NAlert, NButton, NModal, NProgress, NRadioButton, NRadioGroup } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { saveAs } from 'file-saver'
import type { IAnimationClip } from '@/core/types'
import { exportAnimationClip, type ExportFormat } from '@/features/animation/exporters'
import { useCharacterStore } from '@/stores/character'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const characterStore = useCharacterStore()

const props = defineProps<{ visible: boolean; clip: IAnimationClip | null }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const format = ref<ExportFormat>('mp4')
const exporting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const progressDone = ref(0)
const progressTotal = ref(1)

const progressPercent = computed(() =>
  Math.min(100, Math.round((progressDone.value / Math.max(1, progressTotal.value)) * 100)),
)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      errorMsg.value = ''
      successMsg.value = ''
      exporting.value = false
      progressDone.value = 0
    }
  },
)

function sanitizeName(name: string): string {
  return (name || 'animation').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
}

const _handleExport = async () => {
  const clip = props.clip
  const ch = characterStore.editingCharacter
  if (!clip || !ch) return
  exporting.value = true
  errorMsg.value = ''
  successMsg.value = ''
  progressDone.value = 0
  progressTotal.value = 1
  try {
    const blob = await exportAnimationClip({
      clip,
      char: ch,
      format: format.value,
      onProgress: (done, total) => {
        progressDone.value = done
        progressTotal.value = total
      },
    })
    const ext = format.value === 'lottie' ? 'json' : format.value
    saveAs(blob, `${sanitizeName(clip.name)}.${ext}`)
    successMsg.value = t('dialogs.animationExport.done')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('unsupported:')) {
      errorMsg.value = t('dialogs.animationExport.unsupported')
    } else {
      errorMsg.value = t('dialogs.animationExport.failed') + (msg ? ` (${msg})` : '')
    }
    if (import.meta.env.DEV) {
      console.warn('[AnimationExportDialog] export failed:', e)
    }
  } finally {
    exporting.value = false
  }
}
const handleExport = createDebouncedHandler(_handleExport, 'AnimationExportDialog.export')

function handleCancel() {
  emit('update:visible', false)
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.anim-export-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0;
}
.anim-export-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.anim-export-label {
  flex: 0 0 auto;
  font-size: 13px;
}
.anim-export-progress-text {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
.anim-export-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
