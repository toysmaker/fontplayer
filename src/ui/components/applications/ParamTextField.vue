<template>
  <div class="param-field">
    <label class="param-field-label">{{ label }}</label>
    <n-input
      class="param-field-input"
      size="small"
      :value="modelValue"
      :type="type"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      @update:value="(v: string) => emit('update:modelValue', v)"
    />
  </div>
</template>

<script setup lang="ts">
import { NInput } from 'naive-ui'

defineProps<{
  label: string
  modelValue: string
  type?: 'text' | 'textarea'
  rows?: number
  placeholder?: string
  maxlength?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped>
.param-field {
  margin-bottom: 10px;
}

.param-field-label {
  display: block;
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 4px;
}

.param-field-input {
  width: 100%;
}
</style>
