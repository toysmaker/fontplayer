<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    title="笔画训练数据 - 设置字重"
    :style="{ width: '380px' }"
  >
    <n-form label-placement="left" label-width="80">
      <n-form-item label="字重">
        <n-input-number
          v-model:value="weight"
          :min="1"
          :max="200"
          style="width: 100%"
        />
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          取消
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          确定
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInputNumber, NButton } from 'naive-ui'
import { strokeTrainingDataWeight } from '@/stores/strokeTrainingData'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const visible = ref(props.show)
const weight = strokeTrainingDataWeight

watch(() => props.show, (v) => { visible.value = v; if (v) weight.value = 50 })
watch(visible, (v) => { if (!v) emit('update:show', false) })

const handleConfirm = () => {
  visible.value = false
  window.dispatchEvent(new CustomEvent('stroke-training-data-weight', { detail: strokeTrainingDataWeight.value }))
}

const handleCancel = () => {
  visible.value = false
}
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
