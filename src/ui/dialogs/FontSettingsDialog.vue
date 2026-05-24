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

function _handleConfirm() {
  const file = selectedFile.value
  if (!file) return
  projectStore.updateFile(file.uuid, {
    name: formData.value.name,
    fontSettings: {
      ...file.fontSettings,
      unitsPerEm: formData.value.unitsPerEm,
      ascender: formData.value.ascender,
      descender: formData.value.descender,
    },
  })
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
