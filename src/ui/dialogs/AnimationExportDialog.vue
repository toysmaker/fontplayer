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
        <n-radio-group
          v-model:value="format"
          :disabled="exporting"
          class="app-radio-gray app-radio-vertical"
        >
          <n-radio value="mp4">mp4</n-radio>
          <n-radio value="gif">gif</n-radio>
          <n-radio value="webm">webm</n-radio>
          <n-radio value="lottie">lottieJson</n-radio>
        </n-radio-group>
      </div>

      <!-- lottie 测试提示 -->
      <div v-if="format === 'lottie'" class="anim-export-hint">
        {{ t('dialogs.animationExport.lottieHint') }}
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
    </div>

    <template #action>
      <div class="anim-export-footer">
        <n-button
          v-if="!exporting"
          @click="handleExportPage"
          @pointerup="handleExportPage"
        >{{ t('dialogs.animationExport.exportPage') }}</n-button>
        <n-button
          v-if="!exporting"
          @click="handleCancel"
          @pointerup="handleCancel"
        >{{ t('dialogs.animationExport.cancel') }}</n-button>
        <n-button
          v-if="!exporting"
          type="primary"
          @click="handleExport"
          @pointerup="handleExport"
        >{{ t('dialogs.animationExport.export') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NAlert, NButton, NModal, NProgress, NRadio, NRadioGroup, useNotification } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { saveAs } from 'file-saver'
import type { IAnimationClip } from '@/core/types'
import { exportAnimationClip, type ExportFormat } from '@/features/animation/exporters'
import { buildClipPlayerHtml } from '@/features/animation/referencePlayerHtml'
import { useCharacterStore } from '@/stores/character'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const notification = useNotification()
const characterStore = useCharacterStore()

const props = defineProps<{ visible: boolean; clip: IAnimationClip | null }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const format = ref<ExportFormat>('mp4')
const exporting = ref(false)
const errorMsg = ref('')
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
    // 完成提示用窗口上方浮动通知，不在对话框内展示
    notification.success({
      title: t('dialogs.animationExport.done'),
      content: `${sanitizeName(clip.name)}.${ext}`,
      duration: 3000,
    })
    emit('update:visible', false)
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

/** 导出预览页面：数据（Lottie）+ 播放器打包为单个 HTML，双击即可播放 */
const _handleExportPage = async () => {
  const clip = props.clip
  const ch = characterStore.editingCharacter
  if (!clip || !ch) return
  exporting.value = true
  errorMsg.value = ''
  progressDone.value = 0
  progressTotal.value = 1
  try {
    const blob = await exportAnimationClip({
      clip,
      char: ch,
      format: 'lottie',
      onProgress: (done, total) => {
        progressDone.value = done
        progressTotal.value = total
      },
    })
    const json = await blob.text()
    const html = buildClipPlayerHtml(sanitizeName(clip.name), json)
    saveAs(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      `${sanitizeName(clip.name)}-player.html`,
    )
    notification.success({
      title: t('dialogs.animationExport.done'),
      content: `${sanitizeName(clip.name)}-player.html`,
      duration: 3000,
    })
    emit('update:visible', false)
  } catch (e) {
    errorMsg.value = t('dialogs.animationExport.failed')
    if (import.meta.env.DEV) {
      console.warn('[AnimationExportDialog] export page failed:', e)
    }
  } finally {
    exporting.value = false
  }
}
const handleExportPage = createDebouncedHandler(_handleExportPage, 'AnimationExportDialog.exportPage')

const _cancel = () => {
  emit('update:visible', false)
}
const handleCancel = createDebouncedHandler(_cancel, 'AnimationExportDialog.cancel')
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
  align-items: flex-start;
  gap: 10px;
}
.anim-export-label {
  flex: 0 0 auto;
  font-size: 13px;
  /* 灰色文本，与纵向灰色 radio 风格一致 */
  color: #9aa3b2;
  /* 与纵向 radio 首行文字对齐 */
  padding-top: 5px;
}
.anim-export-hint {
  font-size: 12px;
  color: var(--light-2);
  line-height: 1.5;
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
