<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.exportFontDialog.title')"
    class="export-font-dialog"
    :style="{ width: '440px', height: '280px' }"
    :mask-closable="false"
    @update:show="onUpdateShow"
  >
    <div class="form-wrapper">
      <div class="contour-group">
        <div class="group-title">{{ t('dialogs.exportFontDialog.contourStorageTitle') }}</div>
        <n-radio-group v-model:value="contourStorage" class="contour-radio-group">
          <div class="contour-radio-row">
            <n-radio value="glyf" class="contour-radio">
              {{ t('dialogs.exportFontDialog.contourStorageTrueTypeLabel') }}
            </n-radio>
            <n-tooltip trigger="hover" placement="top">
              <template #trigger>
                <span class="export-font-help-icon" tabindex="0" role="button">?</span>
              </template>
              {{ t('dialogs.exportFontDialog.contourStorageTrueTypeTooltip') }}
            </n-tooltip>
          </div>
          <div class="contour-radio-row">
            <n-radio value="cff" class="contour-radio">
              {{ t('dialogs.exportFontDialog.contourStorageCffLabel') }}
            </n-radio>
            <n-tooltip trigger="hover" placement="top">
              <template #trigger>
                <span class="export-font-help-icon" tabindex="0" role="button">?</span>
              </template>
              {{ t('dialogs.exportFontDialog.contourStorageCffTooltip') }}
            </n-tooltip>
          </div>
        </n-radio-group>
      </div>
      <n-checkbox v-model:checked="removeOverlap" class="item-check">
        {{ t('dialogs.exportFontDialog.removeOverlap') }}
      </n-checkbox>
    </div>
    <template #action>
      <div class="dialog-footer">
        <n-button
          @click="handleCancel"
          @pointerup="handleCancel"
        >
          {{ t('dialogs.exportFontDialog.cancel') }}
        </n-button>
        <n-button
          type="primary"
          @click="handleConfirm"
          @pointerup="handleConfirm"
        >
          {{ t('dialogs.exportFontDialog.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NRadioGroup, NRadio, NCheckbox, NButton, NTooltip, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { exportFontLibrary, type ExportFontContourStorage } from '@/features/editor/services/ExportFontService'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const dialogsStore = useDialogsStore()

const contourStorage = ref<ExportFontContourStorage>('cff')
const removeOverlap = ref(false)

const visible = computed({
  get: () => dialogsStore.exportFontDialogVisible,
  set: (v: boolean) => {
    if (!v) dialogsStore.closeExportFontDialog()
  },
})

watch(visible, (v) => {
  if (v) {
    contourStorage.value = 'cff'
    removeOverlap.value = false
  }
})

function onUpdateShow(v: boolean) {
  if (!v) dialogsStore.closeExportFontDialog()
}

const _handleCancel = () => {
  dialogsStore.closeExportFontDialog()
}

const _handleConfirm = async () => {
  const file = projectStore.selectedFile
  if (!file) {
    message.warning(t('dialogs.exportFontDialog.needProject'))
    dialogsStore.closeExportFontDialog()
    return
  }
  dialogsStore.closeExportFontDialog()
  await exportFontLibrary({
    file,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    options: {
      contourStorage: contourStorage.value,
      removeOverlap: removeOverlap.value,
    },
    message,
    t,
    projectStore,
  })
}

const handleCancel = createDebouncedHandler(_handleCancel, 'ExportFontDialog.cancel')
const handleConfirm = createDebouncedHandler(_handleConfirm, 'ExportFontDialog.confirm')
</script>

<style scoped>
.form-wrapper {
  color: #d4d4d4;
  padding: 0 4px 4px;
}

.contour-group {
  margin-bottom: 20px;
}

.group-title {
  margin-bottom: 10px;
  font-size: 14px;
  line-height: 1.4;
  color: #d4d4d4;
}

.contour-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.contour-radio-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
}

.contour-radio-row:last-child {
  margin-bottom: 0;
}

.contour-radio {
  flex: 1;
  min-width: 0;
}

.export-font-help-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 6px;
  border-radius: 50%;
  background: #3c3c3c;
  color: #a0a0a0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: help;
  user-select: none;
}

.export-font-help-icon:hover {
  color: #cccccc;
  background: #4a4a4a;
}

.item-check {
  color: #d4d4d4 !important;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}
</style>

<!-- 与原版 Element 深色导出对话框对齐（n-dialog  teleport 到 body，需非 scoped） -->
<style>
.export-font-dialog.n-dialog {
  --n-color: #252526 !important;
  --n-text-color: #d4d4d4 !important;
  --n-title-text-color: #eeeeee !important;
  --n-title-font-size: 16px !important;
  --n-title-font-weight: 600 !important;
  --n-border: 1px solid #3e3e42 !important;
  --n-border-radius: 4px !important;
  --n-padding: 20px 24px 12px !important;
  --n-content-margin: 0 !important;
  --n-close-icon-color: #8a8a8a !important;
  --n-close-icon-color-hover: #e0e0e0 !important;
  --n-close-icon-color-pressed: #c0c0c0 !important;
  background-color: #252526 !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45) !important;
}

.export-font-dialog.n-dialog .n-dialog__content {
  margin-top: 20px !important;
  padding: 0 !important;
}

.export-font-dialog.n-dialog .n-dialog__action {
  padding: 16px 0 0 !important;
  margin-top: 10px !important;
  border-top: none !important;
  justify-content: flex-end !important;
}

/* 单选：未选空心白边，选中蓝环 + 白芯（对齐 Element 深色对话框） */
.export-font-dialog .n-radio .n-radio__dot {
  background-color: transparent !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55) !important;
}
.export-font-dialog .n-radio.n-radio--checked .n-radio__dot {
  background-color: #e8e8e8 !important;
  box-shadow: none !important;
}
.export-font-dialog .n-radio.n-radio--checked .n-radio__dot::before {
  background-color: var(--primary-0) !important;
}

.export-font-dialog .n-radio .n-radio__label {
  color: #e8e8e8 !important;
}

/* 取消：浅灰蓝底深字 */
.export-font-btn-cancel.n-button.n-button--default-type {
  --n-text-color: #1a1a2e !important;
  --n-text-color-hover: #0f0f1a !important;
  --n-text-color-pressed: #0f0f1a !important;
  --n-text-color-focus: #1a1a2e !important;
  --n-color: #d9e6f2 !important;
  --n-color-hover: #c8d9eb !important;
  --n-color-pressed: #b8cee4 !important;
  --n-color-focus: #d9e6f2 !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-pressed: none !important;
  --n-border-focus: none !important;
  border-radius: 3px !important;
  min-width: 72px !important;
  font-weight: 500 !important;
}

/* 确认：深蓝底、亮蓝描边、白字 */
.export-font-btn-confirm.n-button {
  --n-text-color: #ffffff !important;
  --n-text-color-hover: #ffffff !important;
  --n-text-color-pressed: #f0f0f0 !important;
  --n-text-color-focus: #ffffff !important;
  --n-color: #1d2b45 !important;
  --n-color-hover: #243556 !important;
  --n-color-pressed: #182038 !important;
  --n-color-focus: #1d2b45 !important;
  --n-border: 1px solid #35508a !important;
  --n-border-hover: 1px solid #4a6aa8 !important;
  --n-border-pressed: 1px solid #35508a !important;
  --n-border-focus: 1px solid #4a6aa8 !important;
  border-radius: 3px !important;
  min-width: 72px !important;
  font-weight: 500 !important;
}
</style>
