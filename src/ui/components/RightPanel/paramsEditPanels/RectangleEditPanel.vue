<script setup lang="ts">
/**
 * 矩形组件参数编辑面板
 * 支持字符和字形两种编辑模式
 */

import { computed } from 'vue'
import { NInputNumber, NForm, NFormItem, NInput, NColorPicker, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useComponentEditor } from '../composables/useComponentEditor'
import { EditStatus, IRectangleComponent } from '@/core/types'

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

const handleChangeName = (name: string) => {
  modifyComponent({ name })
}

const rectFillColorDisplay = computed(() => {
  const v = (selectedComponent.value?.value as IRectangleComponent | undefined)?.fillColor
  return v && String(v).trim() ? v : null
})

const handleChangeFillColor = (color: string | null) => {
  if (!selectedComponent.value?.value) return
  const currentValue = selectedComponent.value.value as IRectangleComponent
  const trimmed = color?.trim()
  modifyComponent({
    value: {
      ...currentValue,
      fillColor: trimmed ? trimmed : undefined,
    },
  })
}

const clearRectFillColor = () => handleChangeFillColor(null)
</script>

<template>
  <div class="rectangle-edit-panel">
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
        </n-form>
      </div>
      
      <div class="fill-color-wrap" v-if="editStatus === EditStatus.Edit">
        <div class="section-title">{{ t('panels.paramsPanel.fillColor.title') }}</div>
        <p class="fill-color-hint">{{ t('panels.paramsPanel.fillColor.hint') }}</p>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.fillColor.label')" :show-feedback="false">
            <div class="fill-color-row">
              <div class="params-fill-color-wrap">
                <n-color-picker
                  size="small"
                  :value="rectFillColorDisplay"
                  :show-alpha="true"
                  @update:value="handleChangeFillColor"
                />
              </div>
              <n-button size="small" quaternary @click="clearRectFillColor">
                {{ t('panels.paramsPanel.fillColor.clear') }}
              </n-button>
            </div>
          </n-form-item>
        </n-form>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rectangle-edit-panel {
  padding: 10px;
  height: 100%;
  overflow: hidden;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 20px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--dark-4);
    color: var(--text-color-1);
  }
}

.fill-color-hint {
  margin: -12px 0 6px 0;
  font-size: 12px;
  color: var(--n-text-color-3);
  line-height: 1.4;
}

.fill-color-wrap {
  margin-bottom: 0;
}

.fill-color-wrap :deep(.n-form) {
  margin-bottom: 0;
}

.fill-color-wrap :deep(.n-form-item) {
  margin-bottom: 0 !important;
}

.fill-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.fill-color-row :deep(.params-fill-color-wrap) {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.fill-color-row :deep(.params-fill-color-wrap .n-color-picker) {
  width: 28px !important;
  height: 28px !important;
  max-height: 28px;
}

.fill-color-row :deep(.params-fill-color-wrap .n-color-picker-trigger) {
  height: 100% !important;
  min-height: 0;
  box-sizing: border-box;
}

.fill-color-row :deep(.params-fill-color-wrap .n-color-picker-trigger__value) {
  display: none !important;
}

.fill-color-row :deep(.n-button.n-button--small-type) {
  flex-shrink: 0;
}
</style>