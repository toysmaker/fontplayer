<template>
  <n-modal v-model:show="visible" preset="card" title="保存字符图片" style="width:400px">
    <p>共有 {{ total }} 个字符，导出前多少个？</p>
    <n-input-number v-model:value="count" :min="1" :max="total" style="margin-top:8px;width:100%" />
    <template #footer>
      <n-space justify="end">
        <n-button @click="visible = false">取消</n-button>
        <n-button type="primary" @click="handleConfirm">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NInputNumber, NButton, NSpace } from 'naive-ui'
import { saveCharPngsCount } from '@/stores/saveCharPngs'

const props = defineProps<{ show: boolean; total: number }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const visible = ref(props.show)
const count = saveCharPngsCount  // 直接绑定全局 ref

watch(() => props.show, (v) => { visible.value = v; if (v) count.value = Math.min(5000, props.total) })
watch(visible, (v) => { if (!v) emit('update:show', false) })

const handleConfirm = () => {
  visible.value = false
  window.dispatchEvent(new CustomEvent('save-char-pngs-count', { detail: saveCharPngsCount.value }))
}
</script>
