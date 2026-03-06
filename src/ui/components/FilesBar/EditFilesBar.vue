<template>
  <div class="edit-files-bar">
    <div class="files-bar-row" v-if="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
      <span
        :class="{
          'file-tag': true,
          'selected': true,
        }"
      >
        <span class="file-info-wrapper">
          <span class="file-name">
            {{ currentName }}
          </span>
        </span>
      </span>
      <div class="style-selection-wrap">
        <span class="style-selection-title">渲染</span>
        <n-radio-group v-model:value="currentRenderStyle" size="small">
          <n-radio
            v-for="option in renderStyleOptions"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </n-radio-group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NRadioGroup, NRadio } from 'naive-ui'
import { useEditFilesBar } from './composables/useEditFilesBar'
import { EditStatus } from '@/core/types'

const {
  editStatus,
  currentName,
  renderStyleOptions,
  currentRenderStyle,
} = useEditFilesBar()
</script>

<style scoped>
.edit-files-bar {
  width: 100%;
  height: 36px;
  z-index: 99;
  background-color: white;
  border-bottom: 1px solid var(--dark-4);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.files-bar-row {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.file-tag {
  display: flex;
  min-width: 120px;
  width: max-content;
  height: 36px;
  white-space: nowrap;
  line-height: 36px;
  flex-direction: row;
  text-align: center;
  border-right: 1px solid var(--dark-4);
  cursor: pointer;
  padding-right: 10px;
  background-color: var(--light-2);
  color: var(--primary-0);
}

.file-tag.selected {
  background-color: var(--primary-5);
  border: none;
  color: var(--primary-0);
  font-weight: bold;
}

.file-info-wrapper {
  display: flex;
  flex: auto;
  margin-left: 5px;
  padding: 0 10px;
}

.file-name {
  flex: auto;
  text-overflow: ellipsis;
  overflow: hidden;
}

.style-selection-wrap {
  margin-left: auto;
  margin-right: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.style-selection-title {
  color: var(--primary-0);
}
</style>
