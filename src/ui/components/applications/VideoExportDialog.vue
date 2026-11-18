<template>
  <n-modal
    :show="show"
    preset="dialog"
    :title="t('applications.exportDialog.title')"
    :show-icon="false"
    @update:show="emit('update:show', $event)"
  >
    <div class="format-group">
      <div class="format-label">{{ t('applications.exportDialog.format') }}</div>
      <n-radio-group v-model:value="format" size="small">
        <n-radio-button value="mp4">{{ t('applications.exportDialog.mp4') }}</n-radio-button>
        <n-radio-button value="webm">{{ t('applications.exportDialog.webm') }}</n-radio-button>
        <n-radio-button value="html">{{ t('applications.exportDialog.html') }}</n-radio-button>
        <n-radio-button v-if="scenePkgVisible" value="scenePkg">
          {{ t('applications.exportDialog.scenePkg') }}
        </n-radio-button>
        <n-radio-button v-if="heicVisible" value="heic">
          {{ t('applications.exportDialog.heic') }}
        </n-radio-button>
      </n-radio-group>
    </div>
    <div v-if="formatNotSupported" class="hint-warning">
      {{ t('applications.exportDialog.webmFallback') }}
    </div>
    <div v-if="exporting" class="progress-row">
      <n-progress type="line" :percentage="progressPercent" :height="6" />
      <span class="progress-text">{{ progressDone }}/{{ progressTotal }}</span>
    </div>
    <template #action>
      <n-button size="small" @click="handleCancel" @pointerup="handleCancel">
        {{ t('applications.exportDialog.cancel') }}
      </n-button>
      <n-button size="small" type="primary" :loading="exporting" @click="handleConfirm" @pointerup="handleConfirm">
        {{ t('applications.exportDialog.confirm') }}
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NModal, NProgress, NRadioButton, NRadioGroup, useMessage } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { formatSupported, type AppVideoExportFormat } from '@/features/applications/export/videoExport'

const props = defineProps<{
  show: boolean
  /** 是否展示 Wallpaper Engine 场景包选项（Phase D 接入） */
  scenePkgVisible?: boolean
  /** 是否展示 macOS 动态壁纸选项（Phase G 接入，仅 macOS） */
  heicVisible?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  export: [format: string]
}>()

const { t } = useI18n()
const message = useMessage()

const format = ref<AppVideoExportFormat>('mp4')
const exporting = ref(false)
const progressDone = ref(0)
const progressTotal = ref(0)

const formatNotSupported = computed(() => !formatSupported(format.value))
const progressPercent = computed(() =>
  progressTotal.value > 0 ? Math.round((progressDone.value / progressTotal.value) * 100) : 0
)

watch(
  () => props.show,
  (v) => {
    if (v) {
      exporting.value = false
      progressDone.value = 0
      progressTotal.value = 0
    }
  }
)

const _handleCancel = () => {
  if (exporting.value) return
  emit('update:show', false)
}
const handleCancel = createDebouncedHandler(_handleCancel, 'VideoExportDialog.cancel')

const _handleConfirm = async () => {
  if (exporting.value) return
  if (formatNotSupported.value && format.value !== 'html') {
    message.warning(t('applications.exportDialog.webmFallback'))
    return
  }
  exporting.value = true
  try {
    emit('export', format.value)
  } finally {
    // 由父组件在导出完成后关闭对话框（重置 exporting）
  }
}
const handleConfirm = createDebouncedHandler(_handleConfirm, 'VideoExportDialog.confirm')

/** 父组件在导出完成/失败后调用 */
defineExpose({
  setProgress: (done: number, total: number) => {
    progressDone.value = done
    progressTotal.value = total
  },
  finish: () => {
    exporting.value = false
    progressDone.value = 0
    progressTotal.value = 0
    emit('update:show', false)
  },
  fail: () => {
    exporting.value = false
  },
})
</script>

<style scoped>
.format-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.format-label {
  font-size: 13px;
}

.hint-warning {
  margin-top: 10px;
  font-size: 12px;
  color: #e0a53c;
}

.progress-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-text {
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
}
</style>
