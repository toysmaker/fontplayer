<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="t('dialogs.newProjectDialog.title')"
    class="new-project-dialog"
    :style="{ width: '480px' }"
  >
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="100"
      require-mark-placement="right-hanging"
      @submit.prevent="handleConfirm"
    >
      <n-form-item :label="t('dialogs.newProjectDialog.projectName')" path="name">
        <n-input
          v-model:value="formData.name"
          :placeholder="t('dialogs.newProjectDialog.projectNamePlaceholder')"
          :maxlength="100"
          show-count
          @keyup.enter="handleConfirm"
          ref="nameInputRef"
          class="form-input"
        />
      </n-form-item>
      <n-form-item label="unitsPerEm">
        <n-input-number
          v-model:value="formData.unitsPerEm"
          :precision="0"
          :disabled="true"
          class="form-input-number"
        />
      </n-form-item>
      <n-form-item label="ascender">
        <n-input-number
          v-model:value="formData.ascender"
          :precision="0"
          :disabled="true"
          @update:value="onAscenderChange"
          class="form-input-number"
        />
      </n-form-item>
      <n-form-item label="descender">
        <n-input-number
          v-model:value="formData.descender"
          :precision="0"
          :disabled="true"
          @update:value="onDescenderChange"
          class="form-input-number"
        />
      </n-form-item>
      <n-form-item :label-width="0" class="use-default-template-form-item">
        <n-checkbox v-model:checked="formData.useDefaultTemplate">
          {{ t('dialogs.newProjectDialog.useDefaultTemplate') }}
        </n-checkbox>
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerdown="handleCancel">{{ t('dialogs.newProjectDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerdown="handleConfirm">{{ t('dialogs.newProjectDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton, NCheckbox, FormInst, useMessage, type FormRules } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { projectCreator } from '@/features/editor/services/ProjectCreator'
import type { ProjectConfig } from '@/features/editor/services/ProjectCreator'
import { isTauri } from '@/utils/env'
import { ensureInputBlur } from '@/utils/tauri-input-fix'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()

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
  name: 'untitled',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  useDefaultTemplate: true,
})

const rules: FormRules = {
  name: [
    { required: true, message: t('dialogs.newProjectDialog.projectNameRequired'), trigger: 'blur' },
    { min: 1, max: 100, message: t('dialogs.newProjectDialog.projectNameLength'), trigger: 'blur' },
  ],
}

const onAscenderChange = () => {
  formData.descender = formData.ascender - formData.unitsPerEm
}

const onDescenderChange = () => {
  formData.ascender = formData.unitsPerEm + formData.descender
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
    formData.name = 'untitled'
    formData.unitsPerEm = 1000
    formData.ascender = 800
    formData.descender = -200
    formData.useDefaultTemplate = true
  } catch (error: any) {
    message.error(error.message || t('dialogs.newProjectDialog.createProjectFailed'))
  }
}

// 使用防重复调用包装
const handleConfirm = createDebouncedHandler(_handleConfirm, 'NewProjectDialog.confirm')

const _handleCancel = () => {
  emit('cancel')
  // 关闭对话框
  visible.value = false
  // 重置表单
  formData.name = 'untitled'
  formData.unitsPerEm = 1000
  formData.ascender = 800
  formData.descender = -200
  formData.useDefaultTemplate = true
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

:deep(.form-input) {
  width: 100%;
}

:deep(.form-input-number) {
  width: 100%;
}

.use-default-template-form-item {
  margin-bottom: 0;
  margin-left: 100px;
}
</style>
