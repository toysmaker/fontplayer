<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.exportColorFontDialog.title')"
    class="export-color-font-dialog"
    :style="{ width: '440px' }"
    :mask-closable="false"
    @update:show="onUpdateShow"
  >
    <p class="export-color-font-hint">{{ t('dialogs.exportColorFontDialog.volumeHint') }}</p>
    <n-form label-placement="left" label-width="auto">
      <n-form-item :show-label="false">
        <n-checkbox v-model:checked="removeOverlap">
          {{ t('dialogs.exportColorFontDialog.removeOverlap') }}
        </n-checkbox>
      </n-form-item>
      <p class="export-color-font-subhint">{{ t('dialogs.exportColorFontDialog.removeOverlapHint') }}</p>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.exportColorFontDialog.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.exportColorFontDialog.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NCheckbox, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { exportColorFontLibrary } from '@/features/editor/services/ExportColorFontService'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const dialogsStore = useDialogsStore()

const removeOverlap = ref(false)

const visible = computed({
  get: () => dialogsStore.exportColorFontDialogVisible,
  set: (v: boolean) => {
    if (!v) dialogsStore.closeExportColorFontDialog()
  },
})

watch(visible, (v) => {
  if (v) {
    removeOverlap.value = false
  }
})

function onUpdateShow(v: boolean) {
  if (!v) dialogsStore.closeExportColorFontDialog()
}

const _handleCancel = () => {
  dialogsStore.closeExportColorFontDialog()
}

const _handleConfirm = async () => {
  const file = projectStore.selectedFile
  if (!file) {
    message.warning(t('dialogs.exportColorFontDialog.needProject'))
    dialogsStore.closeExportColorFontDialog()
    return
  }
  dialogsStore.closeExportColorFontDialog()
  await exportColorFontLibrary({
    file,
    removeOverlap: removeOverlap.value,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    message,
    t,
    projectStore,
  })
}

const handleCancel = createDebouncedHandler(_handleCancel, 'ExportColorFontDialog.cancel')
const handleConfirm = createDebouncedHandler(_handleConfirm, 'ExportColorFontDialog.confirm')
</script>

<style scoped>
.export-color-font-hint {
  margin: 0 0 12px 0;
  color: var(--n-text-color-2);
  font-size: 13px;
  line-height: 1.45;
}
.export-color-font-subhint {
  margin: 0 0 8px 0;
  color: var(--n-text-color-3);
  font-size: 12px;
  line-height: 1.4;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
