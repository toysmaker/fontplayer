<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="title"
    class="text-input-dialog"
    :style="{ width: '380px' }"
  >
    <n-form label-placement="left" label-width="80" @submit.prevent="handleConfirm">
      <n-form-item :label="label">
        <n-input
          v-model:value="inputValue"
          :placeholder="placeholder"
          :maxlength="maxlength"
          :show-count="!!maxlength"
          @keyup.enter="handleConfirm"
        />
      </n-form-item>
      <n-form-item v-if="errorMsg" label=" ">
        <span class="error-msg">{{ errorMsg }}</span>
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ cancelText }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ confirmText }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'

const props = withDefaults(defineProps<{
  show: boolean
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  maxlength?: number
  confirmText?: string
  cancelText?: string
  validator?: (value: string) => string | null
}>(), {
  initialValue: '',
  placeholder: '',
  confirmText: '确定',
  cancelText: '取消',
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [value: string]
  cancel: []
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const inputValue = ref('')
const errorMsg = ref<string | null>(null)

watch(() => props.show, (val) => {
  if (val) {
    inputValue.value = props.initialValue
    errorMsg.value = null
  }
})

const _handleConfirm = () => {
  const val = inputValue.value.trim()
  if (!val) return

  if (props.validator) {
    const err = props.validator(val)
    if (err) {
      errorMsg.value = err
      return
    }
  }

  errorMsg.value = null
  emit('confirm', val)
  visible.value = false
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'TextInputDialog.confirm')

const _handleCancel = () => {
  errorMsg.value = null
  emit('cancel')
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'TextInputDialog.cancel')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.error-msg {
  color: #d03050;
  font-size: 12px;
}
</style>
