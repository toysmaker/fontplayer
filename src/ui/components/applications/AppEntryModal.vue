<template>
  <n-modal
    :show="show"
    preset="dialog"
    :title="t('applications.entryModal.title')"
    :show-icon="false"
    :closable="false"
    :mask-closable="false"
    @update:show="(v: boolean) => !v && emit('update:show', false)"
  >
    <div class="entry-content">
      <n-checkbox v-model:checked="useLastFont">
        {{ t('applications.entryModal.useLastFont') }}
      </n-checkbox>
    </div>
    <template #action>
      <n-button type="primary" size="small" @click="handleConfirm" @pointerup="handleConfirm">
        {{ t('applications.entryModal.confirm') }}
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCheckbox, NModal } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'

const props = defineProps<{
  show: boolean
  useLastFont: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:useLastFont': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()

const useLastFont = computed({
  get: () => props.useLastFont,
  set: (v: boolean) => emit('update:useLastFont', v),
})

const _handleConfirm = () => {
  emit('confirm')
}
const handleConfirm = createDebouncedHandler(_handleConfirm, 'AppEntryModal.confirm')
</script>

<style scoped>
.entry-content {
  padding: 4px 0;
}
</style>
