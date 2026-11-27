<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="tm('dialogs.fontSettingsDialog.title')"
    class="font-settings-dialog"
    :style="{ width: '480px' }"
    :mask-closable="false"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-form
      v-if="selectedFile"
      ref="formRef"
      :model="formData"
      label-placement="left"
      label-width="100"
      style="margin-top: 16px"
    >
      <n-form-item :label="tm('dialogs.fontSettingsDialog.fontName')">
        <n-input v-model:value="formData.name" :maxlength="100" show-count />
      </n-form-item>
      <n-form-item label="unitsPerEm">
        <n-input-number
          v-model:value="formData.unitsPerEm"
          :precision="0"
          :disabled="true"
          style="width: 180px"
        />
      </n-form-item>
      <n-form-item label="ascender">
        <n-input-number
          v-model:value="formData.ascender"
          :precision="0"
          :disabled="true"
          style="width: 180px"
          @update:value="onAscenderChange"
        />
      </n-form-item>
      <n-form-item label="descender">
        <n-input-number
          v-model:value="formData.descender"
          :precision="0"
          :disabled="true"
          style="width: 180px"
          @update:value="onDescenderChange"
        />
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="openMore">{{ t('dialogs.fontSettingsDialog.moreSettings') }}</n-button>
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.fontSettingsDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">{{ t('dialogs.fontSettingsDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { hasChineseChar } from '@/fontManager/utils'
import { convertToPinyin } from 'tiny-pinyin'

const { t, tm } = useI18n()
const projectStore = useProjectStore()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'open-more': []
}>()

const formRef = ref<any>(null)
const selectedFile = computed(() => projectStore.selectedFile)

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const formData = ref({
  name: 'untitled',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
})

watch(
  () => selectedFile.value,
  (file) => {
    if (file) {
      formData.value = {
        name: file.name,
        unitsPerEm: file.fontSettings?.unitsPerEm ?? 1000,
        ascender: file.fontSettings?.ascender ?? 800,
        descender: file.fontSettings?.descender ?? -200,
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.show,
  (show) => {
    if (show && selectedFile.value) {
      const file = selectedFile.value
      formData.value = {
        name: file.name,
        unitsPerEm: file.fontSettings?.unitsPerEm ?? 1000,
        ascender: file.fontSettings?.ascender ?? 800,
        descender: file.fontSettings?.descender ?? -200,
      }
    }
  }
)

function onAscenderChange() {
  formData.value.descender = formData.value.ascender - formData.value.unitsPerEm
}

function onDescenderChange() {
  formData.value.ascender = formData.value.unitsPerEm + formData.value.descender
}

function openMore() {
  emit('open-more')
  visible.value = false
}

function _handleCancel() {
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'FontSettingsDialog.cancel')

/** 工程名称 → PostScript 名（与 ProjectCreator/font.ts 导出侧净化规则一致） */
function buildPostScriptName(projectName: string): string {
  let en = hasChineseChar(projectName) ? convertToPinyin(projectName) : projectName
  en = en.replace(/[^\x21-\x7E]/g, '').replace(/\s/g, '')
  if (!en) en = 'Untitled'
  return (en + '-Regular').slice(0, 63)
}

/**
 * 单向联动：工程名称 → name 表 default 条目（nameID 1/4/6）。
 * 仅同步 default 条目（用户手工新增/编辑的非 default 条目不受影响）；
 * 反向（修改 name 表 → 工程名称）不联动。
 */
function syncNameTableWithProjectName(
  entries: unknown[] | undefined,
  projectName: string,
): unknown[] {
  if (!Array.isArray(entries)) return entries ?? []
  // 英文记录（0x409 等）同步拼音/ASCII 名（与 font.ts 导出侧同步规则一致）
  const enName = hasChineseChar(projectName) ? convertToPinyin(projectName) : projectName
  return entries.map((entry: any) => {
    if (!entry || entry.default !== true) return entry
    const familyValue = entry.langID === 0x804 ? projectName : enName
    if (entry.nameID === 1) return { ...entry, value: familyValue }
    if (entry.nameID === 4) {
      const suffix = entry.langID === 0x804 ? ' 常规体' : ' Regular'
      return { ...entry, value: familyValue + suffix }
    }
    if (entry.nameID === 6) return { ...entry, value: buildPostScriptName(projectName) }
    return entry
  })
}

function _handleConfirm() {
  const file = selectedFile.value
  if (!file) return
  const currentTables: any = file.fontSettings?.tables ?? {}
  const hasNameEntries = Array.isArray(currentTables.name)
  const fontSettings: any = {
    ...file.fontSettings,
    unitsPerEm: formData.value.unitsPerEm,
    ascender: formData.value.ascender,
    descender: formData.value.descender,
  }
  // 改名联动 name 表（仅当工程已有 name 表条目时；导入的字体工程无 name 表则不动）
  if (hasNameEntries) {
    fontSettings.tables = {
      ...currentTables,
      name: syncNameTableWithProjectName(currentTables.name, formData.value.name),
    }
  }
  projectStore.updateFile(file.uuid, {
    name: formData.value.name,
    fontSettings,
  })
  projectStore.markFileUnsaved(file.uuid)
  visible.value = false
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'FontSettingsDialog.confirm')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.n-input-number {
  width: 100% !important;
}
</style>
