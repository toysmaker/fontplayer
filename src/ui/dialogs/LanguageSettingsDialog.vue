<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="tm('dialogs.languageSettingsDialog.title')"
    class="language-settings-dialog"
    :style="{ width: '320px' }"
    :mask-closable="false"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-form :label="tm('dialogs.languageSettingsDialog.label')" label-placement="left" label-width="80" style="margin-top: 16px">
      <n-form-item :label="tm('dialogs.languageSettingsDialog.label')">
        <n-radio-group v-model:value="language">
          <n-radio value="zh">中文</n-radio>
          <n-radio value="en">English</n-radio>
        </n-radio-group>
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel">{{ t('dialogs.languageSettingsDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm">{{ t('dialogs.languageSettingsDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NForm, NFormItem, NRadioGroup, NRadio, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { isTauri } from '@/utils/env'

const { t, tm, locale } = useI18n()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const language = ref<'zh' | 'en'>('zh')

watch(
  () => props.show,
  (show) => {
    if (show) {
      language.value = locale.value === 'en' ? 'en' : 'zh'
    }
  }
)

function handleCancel() {
  visible.value = false
}

async function handleConfirm() {
  locale.value = language.value
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_menu_language', { language: language.value })
    } catch (error) {
      console.error('Failed to update menu language:', error)
    }
  }
  visible.value = false
}
</script>

<style scoped>
.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>

<style>
.language-settings-dialog .n-radio__label {
  color: var(--light-2) !important;
}
.language-settings-dialog .n-radio.n-radio--checked .n-radio__dot {
  background-color: var(--light-2) !important;
}
.language-settings-dialog .n-radio.n-radio--checked .n-radio__dot::before {
  background-color: var(--dark-2) !important;
}
</style>
