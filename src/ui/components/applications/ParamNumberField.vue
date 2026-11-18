<template>
  <div class="param-field">
    <label class="param-field-label">{{ label }}</label>
    <n-input-number
      class="param-field-input"
      size="small"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @update:value="(v: number | null) => emit('update:modelValue', v ?? min)"
    />
    <n-slider
      class="param-field-slider"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @update:value="(v: number) => emit('update:modelValue', v)"
    />
  </div>
</template>

<script setup lang="ts">
import { NInputNumber, NSlider } from 'naive-ui'

defineProps<{
  label: string
  modelValue: number
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
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

/* label 一行 / input 一行 / slider 一行，全部占满 */
.param-field-input {
  width: 100%;
}

.param-field-slider {
  width: 100%;
  margin-top: 4px;
}
</style>
