<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.exportFontDialog.title')"
    class="export-font-dialog"
    :style="{ width: '460px' }"
    :mask-closable="false"
    @update:show="onUpdateShow"
  >
    <div class="form-wrapper">
      <div class="contour-group">
        <div class="group-title">{{ t('dialogs.exportFontDialog.contourStorageTitle') }}</div>
        <n-radio-group v-model:value="contourStorage" class="contour-radio-group">
          <div class="contour-radio-row">
            <n-radio value="glyf" class="contour-radio">{{ t('dialogs.exportFontDialog.contourStorageTrueTypeLabel') }}</n-radio>
            <n-tooltip trigger="hover" placement="top">
              <template #trigger><span class="export-font-help-icon" tabindex="0" role="button">?</span></template>
              {{ t('dialogs.exportFontDialog.contourStorageTrueTypeTooltip') }}
            </n-tooltip>
          </div>
          <div class="contour-radio-row">
            <n-radio value="cff" class="contour-radio">{{ t('dialogs.exportFontDialog.contourStorageCffLabel') }}</n-radio>
            <n-tooltip trigger="hover" placement="top">
              <template #trigger><span class="export-font-help-icon" tabindex="0" role="button">?</span></template>
              {{ t('dialogs.exportFontDialog.contourStorageCffTooltip') }}
            </n-tooltip>
          </div>
        </n-radio-group>
      </div>
      <n-checkbox v-model:checked="removeOverlap" class="item-check">{{ t('dialogs.exportFontDialog.removeOverlap') }}</n-checkbox>

      <!-- 使用部分字符 -->
      <div class="batch-section">
        <div class="batch-row">
          <n-button class="batch-btn" :type="selectedFile ? 'success' : 'default'"
            @click="handleBatchBtnClick" @pointerup="handleBatchBtnClick">
            <template v-if="selectedFile">
              <span class="check-icon">&#10003;</span> {{ t('dialogs.exportFontDialog.viewSelectedChars') }}
            </template>
            <template v-else>{{ t('dialogs.exportFontDialog.partialCharExport') }}</template>
          </n-button>
          <n-popover trigger="hover" v-if="!selectedFile">
            <template #trigger><span class="help-icon">&#9432;</span></template>
            <span>{{ t('dialogs.exportFontDialog.partialCharExportTip') }}</span>
          </n-popover>
          <span v-else class="delete-icon" @click="handleClearFile" @pointerup="handleClearFile">&#10005;</span>
        </div>
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
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.exportFontDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">{{ t('dialogs.exportFontDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NRadioGroup, NRadio, NCheckbox, NButton, NTooltip, NPopover, NScrollbar, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { exportFontLibrary, type ExportFontContourStorage } from '@/features/editor/services/ExportFontService'
import { isTauri } from '@/utils/env'
import * as R from 'ramda'
import type { IFile, ICharacterFileMetadata } from '@/core/types'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const dialogsStore = useDialogsStore()

const contourStorage = ref<ExportFontContourStorage>('cff')
const removeOverlap = ref(false)
const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])
const showCharListModal = ref(false)
const displayChars = computed(() => selectedChars.value.slice(0, 500))

const visible = computed({
  get: () => dialogsStore.exportFontDialogVisible,
  set: (v: boolean) => { if (!v) dialogsStore.closeExportFontDialog() },
})

watch(visible, (v) => {
  if (v) { contourStorage.value = 'cff'; removeOverlap.value = false; selectedFile.value = null; selectedChars.value = [] }
})

function onUpdateShow(v: boolean) { if (!v) dialogsStore.closeExportFontDialog() }

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
  () => { selectedFile.value ? (showCharListModal.value = true) : pickTxtFile() }, 'ExportFontDialog.batchBtn')
const handleClearFile = createDebouncedHandler(
  () => { selectedFile.value = null; selectedChars.value = [] }, 'ExportFontDialog.clearFile')

const _handleCancel = () => { dialogsStore.closeExportFontDialog() }
const handleCancel = createDebouncedHandler(_handleCancel, 'ExportFontDialog.cancel')

const _handleConfirm = async () => {
  const file = projectStore.selectedFile
  if (!file) { message.warning(t('dialogs.exportFontDialog.needProject')); dialogsStore.closeExportFontDialog(); return }
  dialogsStore.closeExportFontDialog()

  let exportFile: IFile = file
  if (selectedChars.value.length > 0) {
    const charSet = new Set(selectedChars.value)
    exportFile = R.clone(file)
    exportFile.characterList = (file.characterList || []).filter((m: ICharacterFileMetadata) => charSet.has(m.character?.text || ''))
  }

  await exportFontLibrary({
    file: exportFile,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    options: { contourStorage: contourStorage.value, removeOverlap: removeOverlap.value },
    message, t, projectStore,
  })
  selectedChars.value = []; selectedFile.value = null
}
const handleConfirm = createDebouncedHandler(_handleConfirm, 'ExportFontDialog.confirm')
</script>

<style scoped>
.form-wrapper { color: #d4d4d4; padding: 0 4px 4px; }
.contour-group { margin-bottom: 20px; }
.group-title { margin-bottom: 10px; font-size: 14px; line-height: 1.4; color: #d4d4d4; }
.contour-radio-group { display: flex; flex-direction: column; gap: 0; }
.contour-radio-row { display: flex; flex-direction: row; align-items: center; margin-bottom: 8px; }
.contour-radio-row:last-child { margin-bottom: 0; }
.contour-radio { flex: 1; min-width: 0; }
.export-font-help-icon { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: 6px; border-radius: 50%; background: #3c3c3c; color: #a0a0a0; font-size: 11px; font-weight: 600; line-height: 1; cursor: help; user-select: none; }
.export-font-help-icon:hover { color: #ccc; background: #4a4a4a; }
.item-check { color: #d4d4d4 !important; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; width: 100%; }
.batch-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid #3e3e42; }
.batch-row { display: flex; align-items: center; gap: 8px; }
.batch-btn { flex: 1; }
.check-icon { margin-right: 4px; font-weight: bold; color: #18a058; }
.help-icon { font-size: 16px; color: #2080f0; cursor: pointer; }
.delete-icon { font-size: 16px; color: #d03050; cursor: pointer; }
.char-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.char-item { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--light-5); border-radius: 4px; font-size: 18px; color: var(--light-0); }
.char-count { margin-top: 12px; font-size: 13px; color: var(--light-0); text-align: center; }
</style>

<style>
.export-font-dialog.n-dialog { --n-color: #252526 !important; --n-text-color: #d4d4d4 !important; --n-title-text-color: #eee !important; --n-title-font-size: 16px !important; --n-title-font-weight: 600 !important; --n-border: 1px solid #3e3e42 !important; --n-border-radius: 4px !important; --n-padding: 20px 24px 12px !important; --n-content-margin: 0 !important; --n-close-icon-color: #8a8a8a !important; --n-close-icon-color-hover: #e0e0e0 !important; --n-close-icon-color-pressed: #c0c0c0 !important; background-color: #252526 !important; box-shadow: 0 8px 32px rgba(0,0,0,0.45) !important; }
.export-font-dialog.n-dialog .n-dialog__content { margin-top: 20px !important; padding: 0 !important; }
.export-font-dialog.n-dialog .n-dialog__action { padding: 16px 0 0 !important; margin-top: 10px !important; border-top: none !important; justify-content: flex-end !important; }
.export-font-dialog .n-radio .n-radio__dot { background-color: transparent !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55) !important; }
.export-font-dialog .n-radio.n-radio--checked .n-radio__dot { background-color: #e8e8e8 !important; box-shadow: none !important; }
.export-font-dialog .n-radio.n-radio--checked .n-radio__dot::before { background-color: var(--primary-0) !important; }
.export-font-dialog .n-radio .n-radio__label { color: #e8e8e8 !important; }
</style>
