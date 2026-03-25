<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { NButton, NFormItem, NInput, NScrollbar } from 'naive-ui'
import { useAdvancedEditStore } from '@/stores/advancedEdit'

const advancedEdit = useAdvancedEditStore()

onMounted(() => {
  advancedEdit.initStyleSwitchTemplates()
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
  if (!advancedEdit.isStyleSwitchOptionEnabled(style)) return
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
          <n-form-item label="">
            <n-input
              v-model:value="advancedEdit.sampleCharacters"
              type="textarea"
              :rows="4"
              :disabled="!advancedEdit.isEditingSample"
              placeholder="请输入最多20个字符，每个字符不能重复"
              :maxlength="20"
              show-count
            />
          </n-form-item>
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
          <n-button type="error" size="large" block @click="void advancedEdit.applyStyleToEntireProject()">
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
            <n-button
              v-for="preset in advancedEdit.styles"
              :key="preset.uuid"
              block
              class="style-item"
              :type="advancedEdit.selectedStyleUUID === preset.uuid ? 'primary' : 'default'"
              :disabled="!advancedEdit.isStyleSwitchOptionEnabled(preset)"
              :title="
                !advancedEdit.isStyleSwitchOptionEnabled(preset) && preset.uuid !== 'default'
                  ? '字库中无该风格的笔画模板'
                  : ''
              "
              @click="handleSelectStyle(preset)"
            >
              {{ preset.name }}
            </n-button>
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
  font-size: 16px;
}
.update-section {
  margin-top: auto;
  text-align: center;
}
.main {
  flex: auto;
  overflow: auto;
  min-width: 0;
}
.characters {
  flex: 0 0 450px;
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
  display: flex;
  flex-direction: column;
}
.title {
  padding: 8px 10px;
  background: var(--primary-0);
  color: var(--light-0);
}
.style-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
}
.style-item {
  justify-content: center;
}
:deep(.n-form-item-label) {
  color: var(--primary-0);
}
</style>
