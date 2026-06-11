<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.exportColorFontDialog.title')"
    class="export-color-font-dialog"
    :style="{ width: '460px' }"
    :mask-closable="false"
    @update:show="onUpdateShow"
  >
    <p class="export-color-font-hint">{{ t('dialogs.exportColorFontDialog.volumeHint') }}</p>
    <n-form label-placement="left" label-width="auto">
      <n-form-item :show-label="false">
        <n-checkbox v-model:checked="removeOverlap">{{ t('dialogs.exportColorFontDialog.removeOverlap') }}</n-checkbox>
      </n-form-item>
      <p class="export-color-font-subhint">{{ t('dialogs.exportColorFontDialog.removeOverlapHint') }}</p>
    </n-form>

    <div class="batch-section">
      <div class="batch-row">
        <n-button class="batch-btn" :type="selectedFile ? 'success' : 'default'"
          @click="handleBatchBtnClick" @pointerup="handleBatchBtnClick">
          <template v-if="selectedFile">
            <span class="check-icon">&#10003;</span> {{ t('dialogs.exportColorFontDialog.viewSelectedChars') }}
          </template>
          <template v-else>{{ t('dialogs.exportColorFontDialog.partialCharExport') }}</template>
        </n-button>
        <n-popover trigger="hover" v-if="!selectedFile">
          <template #trigger><span class="help-icon">&#9432;</span></template>
          <span>{{ t('dialogs.exportColorFontDialog.partialCharExportTip') }}</span>
        </n-popover>
        <span v-else class="delete-icon" @click="handleClearFile" @pointerup="handleClearFile">&#10005;</span>
      </div>
    </div>

    <n-modal v-model:show="showCharListModal" preset="dialog" title="已选字符列表" :style="{ width: '440px' }">
      <n-scrollbar style="max-height: 280px;">
        <div class="char-grid"><span v-for="(ch, idx) in displayChars" :key="idx" class="char-item">{{ ch }}</span></div>
      </n-scrollbar>
      <div class="char-count">共 {{ selectedChars.length }} 个字符</div>
      <template #action><n-button @click="showCharListModal = false">关闭</n-button></template>
    </n-modal>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.exportColorFontDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">{{ t('dialogs.exportColorFontDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NCheckbox, NButton, NPopover, NScrollbar, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { exportColorFontLibrary } from '@/features/editor/services/ExportColorFontService'
import { isTauri } from '@/utils/env'
import * as R from 'ramda'
import type { IFile, ICharacterFileMetadata } from '@/core/types'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const dialogsStore = useDialogsStore()

const removeOverlap = ref(false)
const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])
const showCharListModal = ref(false)
const displayChars = computed(() => selectedChars.value.slice(0, 500))

const visible = computed({
  get: () => dialogsStore.exportColorFontDialogVisible,
  set: (v: boolean) => { if (!v) dialogsStore.closeExportColorFontDialog() },
})

watch(visible, (v) => {
  if (v) { removeOverlap.value = false; selectedFile.value = null; selectedChars.value = [] }
})

function onUpdateShow(v: boolean) { if (!v) dialogsStore.closeExportColorFontDialog() }

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
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.txt,text/plain'; input.style.display = 'none'
    input.onchange = () => { resolve(input.files?.[0] || null); input.remove() }
    document.body.appendChild(input); input.click()
  })
}
async function pickTxtFile() {
  try {
    const file = isTauri() ? await pickTxtFileTauri() : await pickTxtFileWeb()
    if (!file) return
    const text = await file.text()
    const chars = Array.from(new Set(Array.from(text).filter((ch: string) => ch.trim() && ch !== '\n' && ch !== '\r')))
    if (!chars.length) { message.warning('文件中没有可识别的字符'); return }
    selectedFile.value = file; selectedChars.value = chars
  } catch (e: any) { console.error(e); message.warning('文件读取失败') }
}
const handleBatchBtnClick = createDebouncedHandler(
  () => { selectedFile.value ? (showCharListModal.value = true) : pickTxtFile() }, 'ExportColorFontDialog.batchBtn')
const handleClearFile = createDebouncedHandler(
  () => { selectedFile.value = null; selectedChars.value = [] }, 'ExportColorFontDialog.clearFile')

const _handleCancel = () => { dialogsStore.closeExportColorFontDialog() }
const handleCancel = createDebouncedHandler(_handleCancel, 'ExportColorFontDialog.cancel')

const _handleConfirm = async () => {
  const file = projectStore.selectedFile
  if (!file) { message.warning(t('dialogs.exportColorFontDialog.needProject')); dialogsStore.closeExportColorFontDialog(); return }
  dialogsStore.closeExportColorFontDialog()

  let exportFile: IFile = file
  if (selectedChars.value.length > 0) {
    const charSet = new Set(selectedChars.value)
    exportFile = R.clone(file)
    exportFile.characterList = (file.characterList || []).filter((m: ICharacterFileMetadata) => charSet.has(m.character?.text || ''))
  }

  await exportColorFontLibrary({
    file: exportFile,
    removeOverlap: removeOverlap.value,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    message, t, projectStore,
  })
  selectedChars.value = []; selectedFile.value = null
}
const handleConfirm = createDebouncedHandler(_handleConfirm, 'ExportColorFontDialog.confirm')
</script>

<style scoped>
.export-color-font-hint { margin: 0 0 12px 0; color: var(--n-text-color-2); font-size: 13px; line-height: 1.45; }
.export-color-font-subhint { margin: 0 0 8px 0; color: var(--n-text-color-3); font-size: 12px; line-height: 1.4; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; }
.batch-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--n-divider-color); }
.batch-row { display: flex; align-items: center; gap: 8px; }
.batch-btn { flex: 1; }
.check-icon { margin-right: 4px; font-weight: bold; color: #18a058; }
.help-icon { font-size: 16px; color: #2080f0; cursor: pointer; }
.delete-icon { font-size: 16px; color: #d03050; cursor: pointer; }
.char-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.char-item { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--light-5); border-radius: 4px; font-size: 18px; color: var(--light-0); }
.char-count { margin-top: 12px; font-size: 13px; color: var(--light-0); text-align: center; }
</style>
