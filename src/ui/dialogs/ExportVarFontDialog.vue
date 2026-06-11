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
        <!-- 使用部分字符 -->
        <div class="batch-section">
          <div class="batch-row">
            <n-button class="batch-btn" :type="selectedFile ? 'success' : 'default'"
              @click="handleBatchBtnClick" @pointerup="handleBatchBtnClick">
              <template v-if="selectedFile">
                <span class="check-icon">&#10003;</span> {{ t('dialogs.exportVarFontDialog.viewSelectedChars') }}
              </template>
              <template v-else>{{ t('dialogs.exportVarFontDialog.partialCharExport') }}</template>
            </n-button>
            <n-popover trigger="hover" v-if="!selectedFile">
              <template #trigger><span class="help-icon">&#9432;</span></template>
              <span>{{ t('dialogs.exportVarFontDialog.partialCharExportTip') }}</span>
            </n-popover>
            <span v-else class="delete-icon" @click="handleClearFile" @pointerup="handleClearFile">&#10005;</span>
          </div>
        </div>
      </div>
    </n-scrollbar>
    <n-modal v-model:show="showCharListModal" preset="dialog" title="已选字符列表" :style="{ width: '440px' }">
      <n-scrollbar style="max-height: 280px;">
        <div class="char-grid"><span v-for="(ch, idx) in displayChars" :key="idx" class="char-item">{{ ch }}</span></div>
      </n-scrollbar>
      <div class="char-count">共 {{ selectedChars.length }} 个字符</div>
      <template #action><n-button @click="showCharListModal = false">关闭</n-button></template>
    </n-modal>
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
  NPopover,
  useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { isTauri } from '@/utils/env'
import * as R from 'ramda'
import type { IFile, ICharacterFileMetadata } from '@/core/types'
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
const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])
const showCharListModal = ref(false)
const displayChars = computed(() => selectedChars.value.slice(0, 500))
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
    axes.value = []; pickingConstant.value = false; pickConstantId.value = null
    removeOverlap.value = false; initialAxisNames.value = {}
    selectedFile.value = null; selectedChars.value = []
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
  () => { selectedFile.value ? (showCharListModal.value = true) : pickTxtFile() }, 'ExportVarFontDialog.batchBtn')
const handleClearFile = createDebouncedHandler(
  () => { selectedFile.value = null; selectedChars.value = [] }, 'ExportVarFontDialog.clearFile')

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

  let f = projectStore.selectedFile
  if (!f) return

  if (selectedChars.value.length > 0) {
    const charSet = new Set(selectedChars.value)
    f = R.clone(f)
    f.characterList = (f.characterList || []).filter((m: ICharacterFileMetadata) => charSet.has(m.character?.text || ''))
  }

  await exportVariableFontLibrary({
    file: f,
    axes: axes.value.map((a) => ({ ...a })),
    removeOverlap: removeOverlap.value,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    message, t, projectStore,
  })
  selectedChars.value = []; selectedFile.value = null
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

<style>
.export-var-font-dialog .n-base-selection .n-base-selection-placeholder {
  color: var(--primary-0) !important;
}
</style>
