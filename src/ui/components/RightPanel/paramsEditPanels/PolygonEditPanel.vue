<script setup lang="ts">
/**
 * 多边形组件参数编辑面板
 * 支持字符和字形两种编辑模式
 */

import { NInputNumber, NForm, NFormItem, NInput, NColorPicker, NButton } from 'naive-ui'
import { useComponentEditor } from '../composables/useComponentEditor'
import { EditStatus, IPolygonComponent } from '@/core/types'

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

const handleChangeFillColor = (color: string) => {
  if (!selectedComponent.value?.value) return
  const currentValue = selectedComponent.value.value as IPolygonComponent
  modifyComponent({
    value: {
      ...currentValue,
      fillColor: color,
    },
  })
}

const transformToPath = () => {
  // TODO: 实现转换为路径功能
  console.warn('transformToPath not implemented yet')
}
</script>

<template>
  <div class="polygon-edit-panel">
    <template v-if="selectedComponent">
      <!-- 组件名称 -->
      <div class="name-wrap">
        <div class="title">组件名称</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item label="名称">
            <n-input
              :value="selectedComponent.name"
              @update:value="handleChangeName"
            />
          </n-form-item>
        </n-form>
      </div>
      
      <!-- 变换 -->
      <div class="transform-wrap">
        <div class="title">变换</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item label="X">
            <n-input-number
              :value="selectedComponent.x"
              :precision="1"
              @update:value="handleChangeX"
            />
          </n-form-item>
          <n-form-item label="Y">
            <n-input-number
              :value="selectedComponent.y"
              :precision="1"
              @update:value="handleChangeY"
            />
          </n-form-item>
          <n-form-item label="宽度">
            <n-input-number
              :value="selectedComponent.w"
              :precision="1"
              :min="0"
              @update:value="handleChangeW"
            />
          </n-form-item>
          <n-form-item label="高度">
            <n-input-number
              :value="selectedComponent.h"
              :precision="1"
              :min="0"
              @update:value="handleChangeH"
            />
          </n-form-item>
          <n-form-item label="旋转">
            <n-input-number
              :value="selectedComponent.rotation"
              :precision="1"
              @update:value="handleChangeRot"
            />
          </n-form-item>
        </n-form>
      </div>
      
      <!-- 转换为曲线（字符和字形都显示） -->
      <div class="transform-to-curve-wrap" v-if="selectedComponent.type === 'polygon'">
        <div class="title">转换为曲线</div>
        <n-button
          type="primary"
          @click="transformToPath"
          style="width: calc(100% - 20px); margin: 10px;"
        >
          转换为曲线
        </n-button>
      </div>
      
      <!-- 填充颜色（仅字符模式显示） -->
      <div class="fill-color-wrap" v-if="editStatus === EditStatus.Edit">
        <div class="title">填充颜色</div>
        <n-form label-placement="left" label-width="120px">
          <n-form-item label="颜色">
            <n-color-picker
              :value="(selectedComponent.value as IPolygonComponent)?.fillColor || '#000000'"
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
.polygon-edit-panel {
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

.name-wrap,
.transform-wrap,
.transform-to-curve-wrap,
.fill-color-wrap {
  margin-bottom: 20px;
}
</style>
