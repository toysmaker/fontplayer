<template>
  <n-modal
    :show="dialogs.projectTagPromptVisible"
    preset="dialog"
    :title="t('dialogs.projectTagPrompt.title')"
    class="project-tag-prompt-dialog"
    @update:show="onUpdateShow"
    @close="handleCancel"
  >
    <div class="project-tag-prompt">
      <div class="label">{{ t('dialogs.projectTagPrompt.label') }}</div>
      <n-input
        v-model:value="draft"
        type="text"
        :placeholder="t('dialogs.projectTagPrompt.placeholder')"
        @keydown.enter.prevent="handleConfirm"
      />

      <!-- 导出部分字符（仅 dev 模式） -->
      <div v-if="isDev" class="batch-section">
        <div class="batch-row">
          <n-button
            class="batch-btn"
            :type="selectedFile ? 'success' : 'default'"
            @click="handleBatchBtnClick"
            @pointerup="handleBatchBtnClick"
          >
            <template v-if="selectedFile">
              <span class="check-icon">&#10003;</span> {{ t('dialogs.projectTagPrompt.viewSelectedChars') }}
            </template>
            <template v-else>{{ t('dialogs.projectTagPrompt.partialCharExport') }}</template>
          </n-button>
          <n-popover trigger="hover" v-if="!selectedFile">
            <template #trigger><span class="help-icon">&#9432;</span></template>
            <span>{{ t('dialogs.projectTagPrompt.partialCharExportTip') }}</span>
          </n-popover>
          <span v-else class="delete-icon" @click="handleClearFile" @pointerup="handleClearFile">&#10005;</span>
        </div>
      </div>
    </div>

    <!-- 已选字符预览 -->
    <n-modal v-model:show="showCharListModal" preset="dialog" title="已选字符列表" :style="{ width: '440px' }">
      <n-scrollbar style="max-height: 280px;">
        <div class="char-grid"><span v-for="(ch, idx) in displayChars" :key="idx" class="char-item">{{ ch }}</span></div>
      </n-scrollbar>
      <div class="char-count">共 {{ selectedChars.length }} 个字符</div>
      <template #action><n-button @click="showCharListModal = false" @pointerup="showCharListModal = false">关闭</n-button></template>
    </n-modal>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.projectTagPrompt.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.projectTagPrompt.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NInput, NButton, NPopover, NScrollbar, useMessage } from 'naive-ui'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { isTauri } from '@/utils/env'

const { t } = useI18n()
const message = useMessage()
const dialogs = useDialogsStore()

const isDev = import.meta.env.DEV

const draft = computed({
  get: () => dialogs.projectTagDraft,
  set: (v: string) => {
    dialogs.projectTagDraft = v
  },
})

// 部分字符导出
const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])
const showCharListModal = ref(false)
const displayChars = computed(() => selectedChars.value.slice(0, 500))

// ---- 文件选择 ----
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
    const file = isTauri() ? await pickTxtFileTauri() : await pickTxtFileWeb()
    if (!file) return
    const text = await file.text()
    const chars = Array.from(
      new Set(Array.from(text).filter((ch: string) => ch.trim() && ch !== '\n' && ch !== '\r')),
    )
    if (!chars.length) {
      message.warning('文件中没有可识别的字符')
      return
    }
    selectedFile.value = file
    selectedChars.value = chars
    dialogs.setProjectTagSelectedChars(chars, file)
  } catch (e: any) {
    console.error(e)
    message.warning('文件读取失败')
  }
}

const handleBatchBtnClick = createDebouncedHandler(
  () => {
    selectedFile.value ? (showCharListModal.value = true) : pickTxtFile()
  },
  'ProjectTagPromptDialog.batchBtn',
)

const handleClearFile = createDebouncedHandler(() => {
  selectedFile.value = null
  selectedChars.value = []
  dialogs.setProjectTagSelectedChars([], null)
}, 'ProjectTagPromptDialog.clearFile')

function onUpdateShow(v: boolean) {
  if (!v) handleCancel()
}

const _handleConfirm = () => {
  dialogs.confirmProjectTagPrompt()
}

const _handleCancel = () => {
  dialogs.cancelProjectTagPrompt()
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'ProjectTagPromptDialog.confirm')
const handleCancel = createDebouncedHandler(_handleCancel, 'ProjectTagPromptDialog.cancel')
</script>

<style scoped>
.project-tag-prompt {
  padding-top: 8px;
}
.label {
  margin-bottom: 8px;
  font-size: 13px;
  opacity: 0.85;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.batch-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #3e3e42;
}
.batch-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.batch-btn {
  flex: 1;
}
.check-icon {
  margin-right: 4px;
  font-weight: bold;
  color: #18a058;
}
.help-icon {
  font-size: 16px;
  color: #2080f0;
  cursor: pointer;
}
.delete-icon {
  font-size: 16px;
  color: #d03050;
  cursor: pointer;
}
.char-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.char-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--light-5);
  border-radius: 4px;
  font-size: 18px;
  color: var(--light-0);
}
.char-count {
  margin-top: 12px;
  font-size: 13px;
  color: var(--light-0);
  text-align: center;
}
</style>
