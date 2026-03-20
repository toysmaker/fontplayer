<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.exportFontDialog.title')"
    class="export-font-dialog"
    :style="{ width: '440px' }"
    :mask-closable="false"
    @update:show="onUpdateShow"
  >
    <div class="export-font-dialog-body">
      <p class="export-font-hint">{{ t('dialogs.exportFontDialog.exportMsg') }}</p>
      <n-form label-placement="left" label-width="auto">
        <n-form-item :label="t('dialogs.exportFontDialog.contourStorageTitle')">
          <n-radio-group v-model:value="contourStorage">
            <n-space vertical>
              <n-radio value="glyf">
                {{ t('dialogs.exportFontDialog.contourStorageTrueTypeLabel') }}
              </n-radio>
              <n-radio value="cff">
                {{ t('dialogs.exportFontDialog.contourStorageCffLabel') }}
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
        <n-form-item :show-label="false">
          <n-checkbox v-model:checked="removeOverlap">
            {{ t('dialogs.exportFontDialog.removeOverlap') }}
          </n-checkbox>
        </n-form-item>
      </n-form>
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
import {
  NModal,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadio,
  NSpace,
  NCheckbox,
  NButton,
  useMessage,
} from 'naive-ui'
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
.export-font-dialog-body {
  margin-top: 12px;
}
.export-font-hint {
  margin: 0 0 12px 0;
  color: var(--n-text-color-2);
  font-size: 13px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
