<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="tm('dialogs.randomCharDialog.title')"
    class="random-char-dialog"
    :style="{ width: '480px' }"
  >
    <n-form :model="formData" label-placement="top">
      <n-form-item :label="tm('dialogs.randomCharDialog.charsLabel')">
        <n-input
          v-model:value="formData.text"
          type="textarea"
          :rows="4"
          :maxlength="200"
          show-count
          :disabled="generating || !!selectedFile"
          :placeholder="t('dialogs.randomCharDialog.charsLabel')"
        />
      </n-form-item>
      <div class="txt-row">
        <n-button size="small" :disabled="generating" @click="handleBatchBtnClick" @pointerup="handleBatchBtnClick">
          {{ t('dialogs.randomCharDialog.useTxt') }}
        </n-button>
        <span v-if="selectedFile" class="txt-info">
          {{ t('dialogs.randomCharDialog.txtLoaded', { name: selectedFile.name, count: selectedChars.length }) }}
        </span>
        <n-button v-if="selectedFile" size="small" quaternary :disabled="generating" @click="handleClearFile" @pointerup="handleClearFile">
          ✕
        </n-button>
      </div>
      <div v-if="generating" class="progress-row">
        <template v-if="phase === 'inference'">
          <n-spin size="small" />
          <span class="progress-text wide">{{ t('dialogs.randomCharDialog.runningModel') }}</span>
        </template>
        <template v-else>
          <n-progress type="line" :percentage="progress" :height="10" />
          <span class="progress-text">{{ progress }}%</span>
        </template>
      </div>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button :disabled="generating" @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.randomCharDialog.cancel') }}
        </n-button>
        <n-button type="primary" :disabled="generating" @click="handleConfirm" @pointerup="handleConfirm">
          {{ generating ? t('dialogs.randomCharDialog.generating') : t('dialogs.randomCharDialog.generate') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NProgress, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { isTauri } from '@/utils/env'
import { generateCharGlyphs } from '@/features/aiGeneration/charGeneration'

const { t, tm } = useI18n()
const message = useMessage()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const formData = ref({
  text: '',
})

const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])

const generating = ref(false)
const progress = ref(0)
const phase = ref<'inference' | 'processing'>('inference')

// ---- txt 文件选择 (与 AddCharacterDialog 交互一致) ----
async function pickTxtFileTauri(): Promise<File | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const picked = await open({ multiple: false, filters: [{ name: 'Text', extensions: ['txt'] }] })
  if (picked == null) return null
  const fp = typeof picked === 'string' ? picked : (picked as any)?.path ?? null
  if (!fp) return null
  const content = await readTextFile(fp)
  return new File([content], fp.split('/').pop() || 'chars.txt', { type: 'text/plain' })
}

function pickTxtFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,text/plain'
    input.style.display = 'none'
    input.onchange = () => {
      resolve(input.files?.[0] || null)
      input.remove()
    }
    document.body.appendChild(input)
    input.click()
  })
}

async function pickTxtFile() {
  try {
    const f = isTauri() ? await pickTxtFileTauri() : await pickTxtFileWeb()
    if (!f) return
    const text = await f.text()
    const chars = Array.from(new Set(Array.from(text).filter((ch: string) => ch.trim() && ch !== '\n' && ch !== '\r')))
    if (!chars.length) {
      message.warning(t('dialogs.randomCharDialog.txtEmpty'))
      return
    }
    selectedFile.value = f
    selectedChars.value = chars
  } catch (e: any) {
    if (import.meta.env.DEV) {
      console.error(e)
    }
    message.warning(t('dialogs.randomCharDialog.txtReadFailed'))
  }
}

const handleBatchBtnClick = createDebouncedHandler(() => {
  if (selectedFile.value) {
    // 已加载 txt: 重新选择
    pickTxtFile()
  } else {
    pickTxtFile()
  }
}, 'RandomCharDialog.batch')

const handleClearFile = createDebouncedHandler(() => {
  selectedFile.value = null
  selectedChars.value = []
}, 'RandomCharDialog.clear')

// ---- 生成 ----
const resetForm = () => {
  formData.value.text = ''
  selectedFile.value = null
  selectedChars.value = []
  progress.value = 0
  phase.value = 'inference'
}

const _handleConfirm = async () => {
  if (generating.value) return
  const hasBatch = selectedChars.value.length > 0
  const singleText = formData.value.text
  if (!hasBatch && !singleText.trim()) {
    message.warning(t('dialogs.randomCharDialog.emptyChars'))
    return
  }
  const chars = hasBatch ? [...selectedChars.value] : Array.from(singleText).filter((c: string) => c.trim())
  if (chars.length === 0) {
    message.warning(t('dialogs.randomCharDialog.emptyChars'))
    return
  }

  generating.value = true
  progress.value = 0
  phase.value = 'inference'
  try {
    const result = await generateCharGlyphs({
      chars,
      onProgress: (done, total) => {
        progress.value = Math.round((done / total) * 100)
      },
      onPhase: (p) => {
        phase.value = p
      },
    })
    if (result.skippedNotInTemplate.length > 0) {
      message.warning(t('dialogs.randomCharDialog.charsNotInTemplate', { chars: result.skippedNotInTemplate.join('、') }))
    }
    if (result.generated > 0) {
      message.success(t('dialogs.randomCharDialog.success', { count: result.generated }))
    }
    resetForm()
    visible.value = false
  } catch (e: any) {
    if (import.meta.env.DEV) {
      console.error('[aiGeneration] 字符生成失败:', e)
    }
    if (e?.dupes?.length) {
      message.warning(t('dialogs.randomCharDialog.duplicateChars', { chars: e.dupes.join('、') }))
    } else if (e?.message === 'empty') {
      message.warning(t('dialogs.randomCharDialog.emptyChars'))
    } else {
      const detail = e?.message ? `：${e.message}` : ''
      message.error(t('dialogs.randomCharDialog.failed') + detail)
    }
  } finally {
    generating.value = false
  }
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'RandomCharDialog.confirm')

const _handleCancel = () => {
  resetForm()
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'RandomCharDialog.cancel')
</script>

<style scoped>
.txt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: -8px;
  margin-bottom: 8px;
}

.txt-info {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.progress-row :deep(.n-progress) {
  flex: 1;
}

.progress-text {
  font-size: 12px;
  color: #606266;
  min-width: 36px;
  text-align: right;
}

.progress-text.wide {
  min-width: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
