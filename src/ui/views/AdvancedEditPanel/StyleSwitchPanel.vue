<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { NButton, NScrollbar } from 'naive-ui'
import { genUUID } from '@/utils/uuid'
import { ParameterType } from '@/core/types'
import { useAdvancedEditStore } from '@/stores/advancedEdit'

const advancedEdit = useAdvancedEditStore()

onMounted(() => {
  advancedEdit.styles = [
    {
      uuid: 'default',
      name: '默认风格',
      strokeStyle: '默认风格',
      constants: [],
      parameters: [],
    },
    {
      uuid: genUUID(),
      name: '字玩标准黑体',
      strokeStyle: '字玩标准黑体',
      constants: [
        { name: '起笔风格', value: 2 },
        { name: '起笔数值', value: 1 },
        { name: '转角风格', value: 1 },
        { name: '转角数值', value: 1 },
        { name: '字重变化', value: 0 },
        { name: '弯曲程度', value: 1 },
      ],
      parameters: [
        { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
      ],
    },
    {
      uuid: genUUID(),
      name: '字玩标准宋体',
      strokeStyle: '字玩标准宋体',
      constants: [],
      parameters: [
        { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
      ],
    },
  ]
  advancedEdit.selectedStyleUUID = 'default'
  void advancedEdit.refreshStyleSwitchPreviews()
})

onUnmounted(() => {
  advancedEdit.styles = []
  advancedEdit.selectedStyleUUID = 'default'
})

function handleToggleEditSample() {
  advancedEdit.isEditingSample = !advancedEdit.isEditingSample
  if (!advancedEdit.isEditingSample) {
    void advancedEdit.refreshStyleSwitchPreviews()
  }
}

function handleSelectStyle(style: (typeof advancedEdit.styles)[0]) {
  advancedEdit.selectedStyleUUID = style.uuid
  void advancedEdit.refreshStyleSwitchPreviews()
}
</script>

<template>
  <div class="wrap">
    <div class="advanced-edit-params-panel">
      <div class="left">
        <div class="sample-characters-section">
          <h3>样例字符</h3>
          <n-button
            block
            :type="advancedEdit.isEditingSample ? 'success' : 'primary'"
            style="margin-bottom: 20px"
            @click="handleToggleEditSample"
          >
            {{ advancedEdit.isEditingSample ? '确认' : '编辑预览样例字符' }}
          </n-button>
        </div>
        <div class="update-section">
          <n-button type="error" size="large" block @click="advancedEdit.applyStyleToEntireProject">
            一键更新全部字库
          </n-button>
        </div>
      </div>
      <div class="main">
        <div class="characters" id="advanced-edit-characters-list">
          <div
            v-for="ch in advancedEdit.sampleCharactersList"
            :key="ch.uuid"
            class="character-preview char-preview"
          >
            <span class="char-label">{{ ch.character.text }}</span>
            <canvas
              :id="`advanced-edit-preview-canvas-${ch.uuid}`"
              width="100"
              height="100"
            />
          </div>
        </div>
      </div>
      <div class="right">
        <n-scrollbar style="max-height: 100%">
          <div class="title">风格列表</div>
          <div class="style-list">
            <div
              v-for="style in advancedEdit.styles"
              :key="style.uuid"
              class="style-item"
              :class="{ selected: advancedEdit.selectedStyleUUID === style.uuid }"
              @click="handleSelectStyle(style)"
            >
              {{ style.name }}
            </div>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--dark-3);
}
.advanced-edit-params-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}
.left {
  border-right: 1px solid var(--light-5);
  flex: 0 0 300px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  box-sizing: border-box;
}
.sample-characters-section h3 {
  margin: 0 0 15px 0;
  color: var(--light-0);
}
.update-section {
  margin-top: auto;
}
.main {
  flex: auto;
  overflow: auto;
}
.character-preview {
  display: inline-block;
  margin: 10px;
  width: 100px;
  text-align: center;
}
.char-label {
  font-size: 12px;
  color: var(--primary-0);
}
.right {
  flex: 0 0 260px;
  border-left: 1px solid var(--light-5);
  height: 100%;
}
.title {
  padding: 8px 10px;
  background: var(--primary-0);
  color: var(--light-0);
}
.style-item {
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--light-5);
}
.style-item.selected {
  background: var(--primary-5);
  color: var(--primary-0);
  font-weight: bold;
}
</style>
