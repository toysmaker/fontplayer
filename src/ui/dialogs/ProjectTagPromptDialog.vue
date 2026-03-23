<template>
  <n-modal
    :show="dialogs.projectTagPromptVisible"
    preset="dialog"
    :title="t('dialogs.projectTagPrompt.title')"
    :positive-text="t('dialogs.projectTagPrompt.confirm')"
    :negative-text="t('dialogs.projectTagPrompt.cancel')"
    @update:show="onUpdateShow"
    @positive-click="onConfirm"
    @negative-click="onCancel"
    @close="onCancel"
  >
    <div class="project-tag-prompt">
      <div class="label">{{ t('dialogs.projectTagPrompt.label') }}</div>
      <n-input
        v-model:value="draft"
        type="text"
        :placeholder="t('dialogs.projectTagPrompt.placeholder')"
        @keydown.enter.prevent="onConfirm"
      />
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NInput } from 'naive-ui'
import { useDialogsStore } from '@/stores/dialogs'

const { t } = useI18n()
const dialogs = useDialogsStore()

const draft = computed({
  get: () => dialogs.projectTagDraft,
  set: (v: string) => {
    dialogs.projectTagDraft = v
  },
})

function onUpdateShow(v: boolean) {
  if (!v) dialogs.cancelProjectTagPrompt()
}

function onConfirm() {
  dialogs.confirmProjectTagPrompt()
}

function onCancel() {
  dialogs.cancelProjectTagPrompt()
}
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
</style>
