<script setup lang="ts">
/**
 * 图片组件参数编辑面板
 * 支持字符和字形两种编辑模式
 */

import { ref } from 'vue'
import { NInputNumber, NForm, NFormItem, NInput, NSlider } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useComponentEditor } from '../composables/useComponentEditor'

const { t } = useI18n()

const { selectedComponent, selectedComponentUUID, modifyComponent } = useComponentEditor()

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

let timer: ReturnType<typeof setTimeout> | null = null
let opstatus = false
const handleChangeOpacity = (opacity: number | null) => {
  if (opacity === null) return
  
  if (timer) {
    clearTimeout(timer)
  }
  timer = setTimeout(() => {
    opstatus = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }, 500)
  
  if (!opstatus) {
    opstatus = true
  }

  modifyComponent({ opacity })
}
</script>

<template>
  <div class="picture-edit-panel">
    <template v-if="selectedComponent">
      <!-- 组件名称 -->
      <div class="name-wrap">
        <div class="title">{{ t('panels.paramsPanel.componentName.title') }}</div>
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
        <div class="title">{{ t('panels.paramsPanel.transform.title') }}</div>
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
      
      <!-- 透明度（字符和字形都显示） -->
      <div class="opacity-wrap">
        <div class="title">{{ t('panels.paramsPanel.opacity.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.opacity.opacity')">
            <n-input-number
              :value="selectedComponent.opacity"
              :min="0.0"
              :max="1.0"
              :step="0.05"
              :precision="2"
              @update:value="handleChangeOpacity"
              style="width: 150px; margin-right: 10px;"
            />
            <n-slider
              :value="selectedComponent.opacity || 1"
              :min="0.0"
              :max="1.0"
              :step="0.05"
              :precision="2"
              @update:value="handleChangeOpacity"
              style="width: 150px;"
            />
          </n-form-item>
        </n-form>
      </div>
    </template>
  </div>
</template>

<style scoped>
.picture-edit-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.title {
  height: 36px;
  line-height: 36px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dark-4);
}

.n-form {
  margin: 10px 0;
}
</style>
