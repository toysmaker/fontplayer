<script setup lang="ts">
/**
 * 钢笔组件参数编辑面板
 * 支持字符和字形两种编辑模式
 */

import { NInputNumber, NForm, NFormItem, NSwitch, NInput, NColorPicker } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useComponentEditor } from '../composables/useComponentEditor'
import { EditStatus, IPenComponent } from '@/core/types'

const { t } = useI18n()

const { selectedComponent, selectedComponentUUID, modifyComponent, editStatus } = useComponentEditor()

const handleChangeX = (x: number | null) => {
  if (x === null) return
  modifyComponent({ x })
}

const handleChangeY = (y: number | null) => {
  if (y === null) return
  modifyComponent({ y })
}

const handleChangeW = (w: number | null) => {
  if (w === null) return
  modifyComponent({ w })
}

const handleChangeH = (h: number | null) => {
  if (h === null) return
  modifyComponent({ h })
}

const handleChangeRot = (rotation: number | null) => {
  if (rotation === null) return
  modifyComponent({ rotation })
}

const handleChangeFlipX = (flipX: boolean) => {
  modifyComponent({ flipX })
}

const handleChangeFlipY = (flipY: boolean) => {
  modifyComponent({ flipY })
}

const handleChangeName = (name: string) => {
  modifyComponent({ name })
}

const handleChangeEditMode = (editMode: boolean) => {
  if (!selectedComponent.value?.value) return
  const currentValue = selectedComponent.value.value as IPenComponent
  modifyComponent({
    value: {
      ...currentValue,
      editMode,
    },
  })
}

const handleChangeFillColor = (color: string) => {
  if (!selectedComponent.value?.value) return
  const currentValue = selectedComponent.value.value as IPenComponent
  modifyComponent({
    value: {
      ...currentValue,
      fillColor: color,
    },
  })
}
</script>

<template>
  <div class="pen-edit-panel">
    <template v-if="selectedComponent">
      <!-- 组件名称 -->
      <div class="name-wrap">
        <div class="section-title">{{ t('panels.paramsPanel.componentName.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.componentName.label')">
            <n-input
              :value="selectedComponent.name"
              @update:value="handleChangeName"
            />
          </n-form-item>
        </n-form>
      </div>
      
      <!-- 变换 -->
      <div class="transform-wrap">
        <div class="section-title">{{ t('panels.paramsPanel.transform.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.transform.x')">
            <n-input-number
              :value="selectedComponent.x"
              :precision="1"
              @update:value="handleChangeX"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.transform.y')">
            <n-input-number
              :value="selectedComponent.y"
              :precision="1"
              @update:value="handleChangeY"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.width')">
            <n-input-number
              :value="selectedComponent.w"
              :precision="1"
              :min="0"
              @update:value="handleChangeW"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.height')">
            <n-input-number
              :value="selectedComponent.h"
              :precision="1"
              :min="0"
              @update:value="handleChangeH"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.transform.rotation')">
            <n-input-number
              :value="selectedComponent.rotation"
              :precision="1"
              @update:value="handleChangeRot"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.horizontalFlip')">
            <n-switch
              :value="selectedComponent.flipX"
              @update:value="handleChangeFlipX"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.verticalFlip')">
            <n-switch
              :value="selectedComponent.flipY"
              @update:value="handleChangeFlipY"
            />
          </n-form-item>
        </n-form>
      </div>
      
      <!-- 编辑模式（字符和字形都显示） -->
      <div class="edit-mode-wrap" v-if="selectedComponent.type === 'pen'">
        <div class="section-title">{{ t('panels.paramsPanel.editMode.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.editMode.label')">
            <n-switch
              :value="(selectedComponent.value as IPenComponent)?.editMode"
              @update:value="handleChangeEditMode"
            />
          </n-form-item>
        </n-form>
      </div>
      
      <!-- 填充颜色（仅字符模式显示） -->
      <div class="fill-color-wrap" v-if="editStatus === EditStatus.Edit">
        <div class="section-title">{{ t('panels.paramsPanel.fillColor.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.fillColor.label')">
            <n-color-picker
              :value="(selectedComponent.value as IPenComponent)?.fillColor || '#000000'"
              :show-alpha="true"
              @update:value="handleChangeFillColor"
            />
          </n-form-item>
        </n-form>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pen-edit-panel {
  padding: 10px;
  height: 100%;
  overflow-y: auto;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 20px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--dark-4);
    color: var(--text-color-1);
  }
}
</style>
