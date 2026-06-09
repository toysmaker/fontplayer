<script setup lang="ts">
import { onMounted, watch, nextTick, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NButton,
  NInput,
  NInputNumber,
  NScrollbar,
  NSelect,
  NSlider,
} from 'naive-ui'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { getValueParamName, VALUE_PARAM_DEFAULTS } from '@/features/advancedEdit/fangYuanStyleConfig'
import CharacterZoomPreview from './CharacterZoomPreview.vue'

const advancedEdit = useAdvancedEditStore()
const { fangYuanStyleItems, fangYuanStyleSelections, fangYuanStyleNumericValues, sampleCharactersList,
  strokeStyleTagSelected, strokeStyleTagOptions } =
  storeToRefs(advancedEdit)
const zoomedIndex = ref<number | null>(null)

function fullRefresh() {
  nextTick(() => {
    requestAnimationFrame(() => {
      advancedEdit.refreshFangYuanStylePreviews()
    })
  })
}

onMounted(() => {
  advancedEdit.initFangYuanStyleSelections()
  if (sampleCharactersList.value.length === 0) {
    void advancedEdit.updatePreviewList().then(() => fullRefresh())
  } else {
    fullRefresh()
  }
})

function handleStrokeStyleChange() {
  if (import.meta.env.DEV) console.log('[FangYuanStylePanel] handleStrokeStyleChange, tag:', strokeStyleTagSelected.value)
  nextTick(() => {
    requestAnimationFrame(() => {
      advancedEdit.refreshStrokeStylePreviews()
    })
  })
}

function handleToggleEditSample() {
  advancedEdit.isEditingSample = !advancedEdit.isEditingSample
  if (!advancedEdit.isEditingSample) {
    void advancedEdit.updatePreviewList().then(() => fullRefresh())
  }
}

function handleStyleSelectionChange() {
  fullRefresh()
}

let numericRafId: number | null = null
function handleNumericValueChange() {
  if (numericRafId !== null) return
  numericRafId = requestAnimationFrame(() => {
    numericRafId = null
    advancedEdit.quickRefreshFangYuanStylePreviews()
  })
}

watch(
  fangYuanStyleSelections,
  () => {
    fullRefresh()
  },
  { deep: true },
)

watch(
  fangYuanStyleNumericValues,
  () => {
    handleNumericValueChange()
  },
  { deep: true },
)

function getSelectOptions(itemLabel: string) {
  const item = fangYuanStyleItems.value.find((i) => i.label === itemLabel)
  if (!item) return []
  return item.options.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }))
}

function getNumericConfig(itemLabel: string) {
  const item = fangYuanStyleItems.value.find((i) => i.label === itemLabel)
  if (!item) return { min: 0, max: 2, step: 0.01 }
  const valueParamName = getValueParamName(item.paramName)
  const def = VALUE_PARAM_DEFAULTS[valueParamName]
  return {
    min: def?.min ?? 0,
    max: def?.max ?? 2,
    step: (def?.max ?? 2) <= 10 ? 0.01 : 1,
  }
}
</script>

<template>
  <div class="wrap">
    <div class="fangyuan-style-panel">
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
          <n-button
            type="error"
            size="large"
            block
            @click="void advancedEdit.applyFangYuanStylesToEntireProject()"
          >
            一键更新全部字库
          </n-button>
        </div>
      </div>
      <div class="main">
        <CharacterZoomPreview
          v-if="zoomedIndex !== null"
          :characters="advancedEdit.sampleCharactersList"
          :model-value="zoomedIndex"
          @update:model-value="zoomedIndex = $event"
          @close="zoomedIndex = null"
        />
        <div v-else class="characters" id="advanced-edit-characters-list">
          <div
            v-for="(ch, index) in advancedEdit.sampleCharactersList"
            :key="ch.uuid"
            class="character-preview char-preview"
            @click="zoomedIndex = index"
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
          <div class="style-config-wrap">
            <div class="title">风格样式参数</div>
            <div class="style-list">
              <div
                v-for="item in fangYuanStyleItems"
                :key="item.label"
                class="style-item"
              >
                <div class="style-item-label">{{ item.label }}</div>
                <n-select
                  :value="fangYuanStyleSelections[item.label] ?? 0"
                  :options="getSelectOptions(item.label)"
                  class="style-item-select"
                  @update:value="
                    (val: number) => {
                      fangYuanStyleSelections[item.label] = val
                      handleStyleSelectionChange()
                    }
                  "
                />
                <div class="numeric-row">
                  <n-input-number
                    :value="fangYuanStyleNumericValues[item.label] ?? 1"
                    :min="getNumericConfig(item.label).min"
                    :max="getNumericConfig(item.label).max"
                    :step="getNumericConfig(item.label).step"
                    size="small"
                    class="numeric-input"
                    @update:value="
                      (val: number | null) => {
                        if (val != null) {
                          fangYuanStyleNumericValues[item.label] = val
                          handleNumericValueChange()
                        }
                      }
                    "
                  />
                  <n-slider
                    :value="fangYuanStyleNumericValues[item.label] ?? 1"
                    :min="getNumericConfig(item.label).min"
                    :max="getNumericConfig(item.label).max"
                    :step="getNumericConfig(item.label).step"
                    class="numeric-slider"
                    @update:value="
                      (val: number) => {
                        fangYuanStyleNumericValues[item.label] = val
                        handleNumericValueChange()
                      }
                    "
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-if="strokeStyleTagOptions.length > 0" class="style-config-wrap" style="margin-top: 16px; border-top: 1px solid var(--light-5);">
            <div class="title">笔画风格切换</div>
            <div style="padding: 10px; padding-bottom: 20px;">
              <n-select
                :value="strokeStyleTagSelected"
                :options="[{ label: '默认风格', value: '' }, ...strokeStyleTagOptions.map((t: string) => ({ label: t, value: t }))]"
                placeholder="选择笔画风格"
                @update:value="(val: string) => { strokeStyleTagSelected = val; handleStrokeStyleChange() }"
              />
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
.fangyuan-style-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
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
.right {
  flex: 0 0 280px;
  border-left: 1px solid var(--light-5);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.style-config-wrap {
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
.style-list {
  padding: 10px;
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.style-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.style-item-label {
  font-size: 13px;
  color: var(--light-0);
  line-height: 1.4;
}
.style-item-select {
  width: 100%;
}
.numeric-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.numeric-input {
  width: 100%;
}
.numeric-slider {
  width: 100%;
}
</style>
