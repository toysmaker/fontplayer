<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    title="新建工程"
  >
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="80"
      require-mark-placement="right-hanging"
      @submit.prevent="handleConfirm"
    >
      <n-form-item label="工程名称" path="name">
        <n-input
          v-model:value="formData.name"
          placeholder="请输入工程名称"
          :maxlength="100"
          show-count
          @keyup.enter="handleConfirm"
          @change="handleNameChange"
          ref="nameInputRef"
        />
      </n-form-item>
      <n-form-item label="宽度" path="width">
        <n-input-number
          v-model:value="formData.width"
          :min="1"
          :max="10000"
          :step="100"
          placeholder="1000"
        />
      </n-form-item>
      <n-form-item label="高度" path="height">
        <n-input-number
          v-model:value="formData.height"
          :min="1"
          :max="10000"
          :step="100"
          placeholder="1000"
        />
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerdown="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerdown="handleConfirm">确认</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton, FormInst, useMessage, type FormRules } from 'naive-ui'
import { projectCreator } from '@/features/editor/services/ProjectCreator'
import type { ProjectConfig } from '@/features/editor/services/ProjectCreator'
import { isTauri } from '@/utils/env'
import { ensureInputBlur } from '@/utils/tauri-input-fix'
import { createDebouncedHandler } from '@/utils/debounce-click'

const handleNameChange = () => {
  console.log('nameInputRef change', nameInputRef.value)
  //nameInputRef.value.blur()
}

const nameInputRef = ref<any>(null)
const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'confirm': [config: ProjectConfig]
  'cancel': []
}>()

const message = useMessage()
const formRef = ref<FormInst | null>(null)

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const formData = reactive<ProjectConfig>({
  name: '',
  width: 1000,
  height: 1000,
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入工程名称', trigger: 'blur' },
    { min: 1, max: 100, message: '工程名称长度在1-100个字符之间', trigger: 'blur' },
  ],
  width: [
    { type: 'number' as const, min: 1, max: 10000, message: '宽度必须在1-10000之间', trigger: 'blur' },
  ],
  height: [
    { type: 'number' as const, min: 1, max: 10000, message: '高度必须在1-10000之间', trigger: 'blur' },
  ],
}

const _handleConfirm = async () => {
  // // 在 Tauri 环境中，确保输入框失焦并等待值同步
  // if (isTauri()) {
  //   await ensureInputBlur(formData, formRef)
  //   // 等待验证状态稳定（blur 触发的验证可能还在进行中）
  //   await nextTick()
  //   // 额外等待一小段时间，确保验证完成
  //   await new Promise(resolve => setTimeout(resolve, 50))
  // }

  nameInputRef.value.blur()

  await nextTick()
  console.log('nameInputRef blur')

  // 验证表单
  try {
    await formRef.value?.validate()
  } catch (error) {
    return
  }

  try {
    // 创建工程
    await projectCreator.createProject(formData)
    
    // 触发确认事件
    emit('confirm', { ...formData })
    
    // 关闭对话框
    visible.value = false
    
    // 重置表单
    formData.name = ''
    formData.width = 1000
    formData.height = 1000
  } catch (error: any) {
    message.error(error.message || '创建工程失败')
  }
}

// 使用防重复调用包装
const handleConfirm = createDebouncedHandler(_handleConfirm, 'NewProjectDialog.confirm')

const _handleCancel = () => {
  emit('cancel')
  // 关闭对话框
  visible.value = false
  // 重置表单
  formData.name = ''
  formData.width = 1000
  formData.height = 1000
}

// 使用防重复调用包装
const handleCancel = createDebouncedHandler(_handleCancel, 'NewProjectDialog.cancel')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
