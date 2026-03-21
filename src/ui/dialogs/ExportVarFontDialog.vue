<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.exportVarFontDialog.title')"
    class="export-var-font-dialog"
    :style="{ width: '420px' }"
    :mask-closable="false"
    @update:show="onUpdateShow"
  >
    <p class="export-var-font-hint">{{ t('dialogs.exportVarFontDialog.hint') }}</p>
    <n-scrollbar style="max-height: 320px">
      <div class="export-var-font-body">
        <n-button
          v-if="!pickingConstant"
          block
          class="mb-2"
          @click="handleStartPickConstant"
          @pointerup="handleStartPickConstant"
        >
          {{ t('dialogs.exportVarFontDialog.addAxis') }}
        </n-button>
        <n-select
          v-else
          v-model:value="pickConstantId"
          :placeholder="t('dialogs.exportVarFontDialog.selectConstant')"
          :options="constantOptions"
          class="mb-2"
          @update:value="onConstantPicked"
        />
        <div v-for="axis in axes" :key="axis.uuid" class="axis-block">
          <n-form label-placement="left" label-width="96" size="small">
            <n-form-item :label="t('dialogs.exportVarFontDialog.axisTag')">
              <n-input
                v-model:value="axis.axisTag"
                @blur="() => onAxisTagBlur(axis)"
              />
            </n-form-item>
            <n-form-item :label="t('dialogs.exportVarFontDialog.axisName')">
              <n-input v-model:value="axis.name" />
            </n-form-item>
            <n-form-item :label="t('dialogs.exportVarFontDialog.defaultValue')">
              <n-input-number v-model:value="axis.defaultValue" class="w-full" />
            </n-form-item>
            <n-form-item :label="t('dialogs.exportVarFontDialog.minValue')">
              <n-input-number v-model:value="axis.minValue" class="w-full" />
            </n-form-item>
            <n-form-item :label="t('dialogs.exportVarFontDialog.maxValue')">
              <n-input-number v-model:value="axis.maxValue" class="w-full" />
            </n-form-item>
          </n-form>
          <n-button
            block
            secondary
            type="error"
            class="mb-3"
            @click="() => handleRemoveAxis(axis)"
            @pointerup="() => handleRemoveAxis(axis)"
          >
            {{ t('dialogs.exportVarFontDialog.removeAxis') }}
          </n-button>
        </div>
        <n-checkbox v-model:checked="removeOverlap">
          {{ t('dialogs.exportVarFontDialog.removeOverlap') }}
        </n-checkbox>
      </div>
    </n-scrollbar>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.exportVarFontDialog.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.exportVarFontDialog.confirm') }}
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
  NInput,
  NInputNumber,
  NButton,
  NCheckbox,
  NSelect,
  NScrollbar,
  useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import {
  exportVariableFontLibrary,
  type VarFontAxis,
} from '@/features/editor/services/ExportVarFontService'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const dialogsStore = useDialogsStore()

const axes = ref<VarFontAxis[]>([])
const pickingConstant = ref(false)
const pickConstantId = ref<string | null>(null)
const removeOverlap = ref(false)
/** 添加轴时的初始展示名，用于「规范化 tag」时判断是否仍等于常量名 */
const initialAxisNames = ref<Record<string, string>>({})

const visible = computed({
  get: () => dialogsStore.exportVarFontDialogVisible,
  set: (v: boolean) => {
    if (!v) dialogsStore.closeExportVarFontDialog()
  },
})

watch(visible, (v) => {
  if (v) {
    axes.value = []
    pickingConstant.value = false
    pickConstantId.value = null
    removeOverlap.value = false
    initialAxisNames.value = {}
  }
})

const constantOptions = computed(() => {
  const file = projectStore.selectedFile
  const list = file?.constants || []
  const used = new Set(axes.value.map((a) => a.uuid))
  return list
    .filter((c) => !used.has(c.uuid))
    .map((c) => ({ label: c.name, value: c.uuid }))
})

function onUpdateShow(v: boolean) {
  if (!v) dialogsStore.closeExportVarFontDialog()
}

function _startPickConstant() {
  const file = projectStore.selectedFile
  if (!(file?.constants?.length)) {
    message.warning(t('dialogs.exportVarFontDialog.needConstants'))
    return
  }
  if (!constantOptions.value.length) {
    message.warning(t('dialogs.exportVarFontDialog.allConstantsUsed'))
    return
  }
  pickingConstant.value = true
  pickConstantId.value = null
}

function onConstantPicked(uuid: string | null) {
  if (!uuid) return
  const file = projectStore.selectedFile
  const constant = file?.constants?.find((c) => c.uuid === uuid)
  if (!constant) return
  if (axes.value.some((a) => a.uuid === uuid)) {
    message.warning(t('dialogs.exportVarFontDialog.duplicateAxis'))
    pickConstantId.value = null
    return
  }
  axes.value.push({
    uuid: constant.uuid,
    name: constant.name,
    defaultValue: constant.value,
    minValue: constant.min,
    maxValue: constant.max,
    axisTag: '',
  })
  initialAxisNames.value[constant.uuid] = constant.name
  pickingConstant.value = false
  pickConstantId.value = null
}

function suggestLabelForTag(tag: string): string {
  const k = tag.trim().toLowerCase()
  const keyMap: Record<string, string> = {
    wght: 'tagWght',
    wdth: 'tagWdth',
    slnt: 'tagSlnt',
    ital: 'tagItal',
    opsz: 'tagOpsz',
  }
  const i18nKey = keyMap[k]
  return i18nKey ? t(`dialogs.exportVarFontDialog.${i18nKey}`) : ''
}

function onAxisTagBlur(axis: VarFontAxis) {
  const suggested = suggestLabelForTag(axis.axisTag)
  if (!suggested) return
  const initial = initialAxisNames.value[axis.uuid]
  if (axis.name === '' || axis.name === initial) {
    axis.name = suggested
  }
}

const _removeAxis = (axis: VarFontAxis) => {
  axes.value = axes.value.filter((a) => a.uuid !== axis.uuid)
  const rest = { ...initialAxisNames.value }
  delete rest[axis.uuid]
  initialAxisNames.value = rest
}

const _handleCancel = () => {
  dialogsStore.closeExportVarFontDialog()
}

const _handleConfirm = async () => {
  const file = projectStore.selectedFile
  if (!file) {
    message.warning(t('dialogs.exportVarFontDialog.needProject'))
    return
  }
  if (!(file.constants?.length)) {
    message.warning(t('dialogs.exportVarFontDialog.needConstants'))
    return
  }
  if (!axes.value.length) {
    message.warning(t('dialogs.exportVarFontDialog.needAxes'))
    return
  }
  for (const a of axes.value) {
    if (!a.axisTag?.trim()) {
      message.warning(t('dialogs.exportVarFontDialog.needAxisTag'))
      return
    }
  }

  dialogsStore.closeExportVarFontDialog()

  projectStore.updateFile(file.uuid, {
    variants: {
      axes: axes.value.map((a) => ({ ...a })),
      instances: (file.variants as { instances?: unknown[] } | undefined)?.instances ?? [],
    },
  })

  const f = projectStore.selectedFile
  if (!f) return

  await exportVariableFontLibrary({
    file: f,
    axes: axes.value.map((a) => ({ ...a })),
    removeOverlap: removeOverlap.value,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    message,
    t,
    projectStore,
  })
}

const handleCancel = createDebouncedHandler(_handleCancel, 'ExportVarFontDialog.cancel')
const handleConfirm = createDebouncedHandler(_handleConfirm, 'ExportVarFontDialog.confirm')
const handleStartPickConstant = createDebouncedHandler(_startPickConstant, 'ExportVarFontDialog.addAxis')
const handleRemoveAxis = createDebouncedHandler(_removeAxis, 'ExportVarFontDialog.removeAxis', (args) => args[0]?.uuid)
</script>

<style scoped>
.export-var-font-hint {
  margin: 0 0 12px 0;
  color: var(--n-text-color-2);
  font-size: 12px;
  line-height: 1.4;
}
.export-var-font-body {
  padding-right: 8px;
}
.axis-block {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--n-divider-color);
}
.mb-2 {
  margin-bottom: 8px;
}
.mb-3 {
  margin-bottom: 12px;
}
.w-full {
  width: 100%;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style>
.export-var-font-dialog .n-base-selection .n-base-selection-placeholder {
  color: var(--primary-0) !important;
}
</style>
