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
          <n-button type="error" size="large" block @click="advancedEdit.applyConstantsToEntireProject">
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
                    style="width: 150px"
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
}
.character-preview {
  display: inline-block;
  margin: 10px;
  width: 100px;
  height: 100px;
  box-sizing: border-box;
  cursor: pointer;
  text-align: center;
}
.char-label {
  display: block;
  font-size: 12px;
  color: var(--primary-0);
}
.left {
  border-right: 1px solid var(--light-5);
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  box-sizing: border-box;
  height: 100%;
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
.parameters-form {
  margin: 10px 0;
}
.param-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:deep(.n-form-item-label) {
  color: var(--primary-0);
}
</style>
