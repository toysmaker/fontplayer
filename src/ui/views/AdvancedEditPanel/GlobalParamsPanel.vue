<script setup lang="ts">
import { onMounted, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NButton,
  NFormItem,
  NInput,
  NInputNumber,
  NScrollbar,
  NSelect,
  NSlider,
} from 'naive-ui'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { ParameterType } from '@/core/types'

const advancedEdit = useAdvancedEditStore()
const { constants, sampleCharactersList } = storeToRefs(advancedEdit)

/** v-if 切回本 Tab 时会新建 canvas，必须等 DOM 就绪后再画，否则会一直黑屏 */
function redrawPreviewsWhenCanvasesReady() {
  nextTick(() => {
    requestAnimationFrame(() => {
      advancedEdit.updateCharactersAndPreview()
    })
  })
}

onMounted(() => {
  if (sampleCharactersList.value.length === 0) {
    void advancedEdit.updatePreviewList().then(() => redrawPreviewsWhenCanvasesReady())
  } else {
    redrawPreviewsWhenCanvasesReady()
  }
})

function handleToggleEditSample() {
  advancedEdit.isEditingSample = !advancedEdit.isEditingSample
  if (!advancedEdit.isEditingSample) {
    void advancedEdit.updatePreviewList().then(() => redrawPreviewsWhenCanvasesReady())
  }
}

watch(
  constants,
  () => {
    redrawPreviewsWhenCanvasesReady()
  },
  { deep: true, flush: 'post' },
)
</script>

<template>
  <div class="wrap">
    <div class="global-params-panel">
      <div class="left">
        <div class="sample-characters-section">
          <h3>样例字符</h3>
          <n-input
            v-model:value="advancedEdit.sampleCharacters"
            type="textarea"
            :rows="4"
            :disabled="!advancedEdit.isEditingSample"
            placeholder="请输入最多20个字符，每个字符不能重复"
            :maxlength="20"
            show-count
          />
          <n-button
            block
            :type="advancedEdit.isEditingSample ? 'success' : 'primary'"
            class="sample-edit-btn"
            @click="handleToggleEditSample"
          >
            {{ advancedEdit.isEditingSample ? '确认' : '编辑预览样例字符' }}
          </n-button>
        </div>
        <div class="update-section">
          <n-button type="error" size="large" block @click="void advancedEdit.applyConstantsToEntireProject()">
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
          <div class="parameters-wrap">
            <div class="title">全局变量</div>
            <div class="parameters-form">
              <n-form-item
                v-for="parameter in advancedEdit.constants"
                :key="parameter.uuid"
                :label="parameter.name"
                label-placement="left"
                label-width="80"
              >
                <div v-if="parameter.type === ParameterType.Number" class="param-wrapper">
                  <n-input-number
                    v-model:value="parameter.value"
                    :step="(parameter.max ?? 1000) <= 10 ? 0.01 : 1"
                    :min="parameter.min"
                    :max="parameter.max"
                    :precision="(parameter.max ?? 1000) <= 10 ? 2 : 0"
                    style="width: 100%"
                  />
                  <n-slider
                    v-model:value="parameter.value"
                    :step="(parameter.max ?? 1000) <= 10 ? 0.01 : 1"
                    :min="parameter.min"
                    :max="parameter.max"
                  />
                </div>
                <div v-else-if="parameter.type === ParameterType.Enum" class="param-wrapper">
                  <n-select
                    v-model:value="parameter.value"
                    :options="parameter.options || []"
                    class="enum-param-select"
                  />
                </div>
              </n-form-item>
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
.global-params-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}
.characters {
  flex: 0 0 450px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 10px;
  padding: 10px;
  box-sizing: border-box;
}
.character-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 100px;
  width: 100px;
  height: 100px;
  box-sizing: border-box;
  cursor: pointer;
}
.left {
  border-right: 1px solid var(--light-5);
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  box-sizing: border-box;
  height: 100%;
}
.sample-characters-section h3 {
  margin: 0 0 12px 0;
  color: var(--light-0);
  font-size: 16px;
}
.sample-edit-btn {
  margin: 12px 0;
}
.update-section {
  margin-top: auto;
  text-align: center;
}
.main {
  flex: auto;
  min-width: 0;
  overflow: auto;
}
.right {
  flex: 0 0 260px;
  border-left: 1px solid var(--light-5);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.parameters-wrap {
  width: 100%;
}
.title {
  width: 100%;
  height: 36px;
  line-height: 36px;
  padding: 0 10px;
  border-bottom: 1px solid var(--light-5);
  background-color: var(--primary-0);
  color: var(--light-0);
}
/* 与风格切换右侧 .style-list 一致：内容区四周留白，避免控件贴边 */
.parameters-form {
  margin: 0;
  padding: 10px;
  padding-bottom: 20px;
  box-sizing: border-box;
}
.param-wrapper {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.parameters-form :deep(.n-form-item-blank) {
  min-width: 0;
  width: 100%;
}
.parameters-form :deep(.n-form-item-blank > *) {
  flex: 1;
  min-width: 0;
  width: 100%;
}
.enum-param-select {
  width: 100%;
}
.parameters-form :deep(.enum-param-select.n-select) {
  width: 100%;
}
.parameters-form :deep(.enum-param-select .n-base-selection) {
  width: 100%;
}
:deep(.n-form-item-label) {
  color: var(--primary-0);
}
</style>
