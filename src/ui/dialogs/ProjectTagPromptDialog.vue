<template>
  <n-modal
    :show="dialogs.projectTagPromptVisible"
    preset="dialog"
    :title="t('dialogs.projectTagPrompt.title')"
    class="project-tag-prompt-dialog"
    @update:show="onUpdateShow"
    @close="handleCancel"
  >
    <div class="project-tag-prompt">
      <div class="label">{{ t('dialogs.projectTagPrompt.label') }}</div>
      <n-input
        v-model:value="draft"
        type="text"
        :placeholder="t('dialogs.projectTagPrompt.placeholder')"
        @keydown.enter.prevent="handleConfirm"
      />
    </div>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.projectTagPrompt.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.projectTagPrompt.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NInput, NButton } from 'naive-ui'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const dialogs = useDialogsStore()

const draft = computed({
  get: () => dialogs.projectTagDraft,
  set: (v: string) => {
    dialogs.projectTagDraft = v
  },
})

function onUpdateShow(v: boolean) {
  if (!v) handleCancel()
}

const _handleConfirm = () => {
  dialogs.confirmProjectTagPrompt()
}

const _handleCancel = () => {
  dialogs.cancelProjectTagPrompt()
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'ProjectTagPromptDialog.confirm')
const handleCancel = createDebouncedHandler(_handleCancel, 'ProjectTagPromptDialog.cancel')
</script>

<style scoped>
.project-tag-prompt {
  padding-top: 8px;
}
.label {
  margin-bottom: 8px;
  font-size: 13px;
  opacity: 0.85;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
