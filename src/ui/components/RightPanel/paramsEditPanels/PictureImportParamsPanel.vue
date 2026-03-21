<script setup lang="ts">
/**
 * 识别图片右侧参数（对齐原 FontPicEditPanel：步骤标题 + r/g/b 滑块与数值 + 局部笔刷 + 步骤按钮位）
 */
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NForm, NFormItem, NSlider, NButton, NButtonGroup, NInputNumber } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePictureImportStore } from '@/stores/pictureImport'
import { PictureImportPipelineService } from '@/features/editor/services/PictureImportPipelineService'
import { toBlackWhiteBitMap } from '@/features/image-import/binarize'

const { t } = useI18n()
const pictureStore = usePictureImportStore()
const {
  rThreshold,
  gThreshold,
  bThreshold,
  localRThreshold,
  localGThreshold,
  localBThreshold,
  localBrushSize,
  enableLocalBrush,
  maxError,
  dropThreshold,
  step,
} = storeToRefs(pictureStore)

let snapR = rThreshold.value
let snapG = gThreshold.value
let snapB = bThreshold.value
let snapMaxError = maxError.value

watch(step, (s) => {
  if (s === 1) {
    snapR = rThreshold.value
    snapG = gThreshold.value
    snapB = bThreshold.value
  }
  if (s === 3) {
    snapMaxError = maxError.value
  }
})

function rebuildAll() {
  PictureImportPipelineService.rebuildContoursAndCurves(pictureStore)
}

function onThresholdsChange() {
  rebuildAll()
}

function onLocalThresholdsChange() {
  rebuildAll()
}

/** 与原 FontPicEditPanel onLocalBrushSizeChange 一致：仅依赖主区对 brush 的 watch 重绘 */
function onLocalBrushSizeChange() {}

function handleBitMap() {
  if (!enableLocalBrush.value) {
    snapR = rThreshold.value
    snapG = gThreshold.value
    snapB = bThreshold.value
    step.value = 0
    rebuildAll()
  } else {
    enableLocalBrush.value = false
    rebuildAll()
  }
}

function cancelBitMap() {
  if (!enableLocalBrush.value) {
    rThreshold.value = snapR
    gThreshold.value = snapG
    bThreshold.value = snapB
    step.value = 0
    rebuildAll()
  } else {
    enableLocalBrush.value = false
  }
}

function useLocalBrushMode() {
  const pic = pictureStore.editCharacterPic
  if (!pic?.thumbnailPixels) return
  const w = pic.width
  const h = pic.height
  const pixels = toBlackWhiteBitMap(
    pic.thumbnailPixels,
    { r: rThreshold.value, g: gThreshold.value, b: bThreshold.value },
    { x: 0, y: 0, size: -1, width: w, height: h },
  )
  pictureStore.setBitMap({ data: pixels, width: w, height: h })
  pictureStore.setEditCharacterPic({
    ...pic,
    processPixels: new Uint8ClampedArray(pixels),
  })
  localRThreshold.value = rThreshold.value
  localGThreshold.value = gThreshold.value
  localBThreshold.value = bThreshold.value
  enableLocalBrush.value = true
}

function toStep1() {
  step.value = 1
  pictureStore.previewStatus = 1
}

function handleFitCurve() {
  snapMaxError = maxError.value
  step.value = 0
  PictureImportPipelineService.rebuildCurvesOnly(pictureStore)
}

function cancelFitCurve() {
  maxError.value = snapMaxError
  step.value = 0
  PictureImportPipelineService.rebuildCurvesOnly(pictureStore)
}

function toStep3() {
  step.value = 3
  pictureStore.previewStatus = 3
}

function onMaxErrorChange() {
  PictureImportPipelineService.rebuildCurvesOnly(pictureStore)
}

function onDropThresholdChange() {
  PictureImportPipelineService.rebuildCurvesOnly(pictureStore)
}
</script>

<template>
  <div class="picture-import-params">
    <div class="effect-wrapper step-1-wrapper">
      <div class="section-title">{{ t('panels.picEditPanel.step1.title') }}</div>
      <n-form class="form bitmap-form" label-placement="left" :label-width="40">
        <div v-if="!enableLocalBrush" class="global-effect">
          <n-form-item label="r">
            <div class="slider-row">
              <n-slider
                v-model:value="rThreshold"
                class="slider-row__slider"
                :min="0"
                :max="255"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onThresholdsChange"
              />
              <n-input-number
                v-model:value="rThreshold"
                class="slider-row__num"
                size="small"
                :min="0"
                :max="255"
                :disabled="step !== 1"
                @update:value="onThresholdsChange"
              />
            </div>
          </n-form-item>
          <n-form-item label="g">
            <div class="slider-row">
              <n-slider
                v-model:value="gThreshold"
                class="slider-row__slider"
                :min="0"
                :max="255"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onThresholdsChange"
              />
              <n-input-number
                v-model:value="gThreshold"
                class="slider-row__num"
                size="small"
                :min="0"
                :max="255"
                :disabled="step !== 1"
                @update:value="onThresholdsChange"
              />
            </div>
          </n-form-item>
          <n-form-item label="b">
            <div class="slider-row">
              <n-slider
                v-model:value="bThreshold"
                class="slider-row__slider"
                :min="0"
                :max="255"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onThresholdsChange"
              />
              <n-input-number
                v-model:value="bThreshold"
                class="slider-row__num"
                size="small"
                :min="0"
                :max="255"
                :disabled="step !== 1"
                @update:value="onThresholdsChange"
              />
            </div>
          </n-form-item>
          <div v-if="step === 1" class="tip">
            {{ t('panels.picEditPanel.step1.tip') }}
            <n-button text type="primary" size="small" @pointerdown="useLocalBrushMode">
              {{ t('panels.picEditPanel.step1.localBrush') }}
            </n-button>
          </div>
        </div>
        <div v-else-if="step === 1" class="local-brush">
          <n-form-item label="r">
            <div class="slider-row">
              <n-slider
                v-model:value="localRThreshold"
                class="slider-row__slider"
                :min="0"
                :max="255"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onLocalThresholdsChange"
              />
              <n-input-number
                v-model:value="localRThreshold"
                class="slider-row__num"
                size="small"
                :min="0"
                :max="255"
                :disabled="step !== 1"
                @update:value="onLocalThresholdsChange"
              />
            </div>
          </n-form-item>
          <n-form-item label="g">
            <div class="slider-row">
              <n-slider
                v-model:value="localGThreshold"
                class="slider-row__slider"
                :min="0"
                :max="255"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onLocalThresholdsChange"
              />
              <n-input-number
                v-model:value="localGThreshold"
                class="slider-row__num"
                size="small"
                :min="0"
                :max="255"
                :disabled="step !== 1"
                @update:value="onLocalThresholdsChange"
              />
            </div>
          </n-form-item>
          <n-form-item label="b">
            <div class="slider-row">
              <n-slider
                v-model:value="localBThreshold"
                class="slider-row__slider"
                :min="0"
                :max="255"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onLocalThresholdsChange"
              />
              <n-input-number
                v-model:value="localBThreshold"
                class="slider-row__num"
                size="small"
                :min="0"
                :max="255"
                :disabled="step !== 1"
                @update:value="onLocalThresholdsChange"
              />
            </div>
          </n-form-item>
          <n-form-item :label="t('panels.picEditPanel.step1.brush')">
            <div class="slider-row">
              <n-slider
                v-model:value="localBrushSize"
                class="slider-row__slider"
                :min="1"
                :max="50"
                :step="1"
                size="small"
                :disabled="step !== 1"
                @update:value="onLocalBrushSizeChange"
              />
              <n-input-number
                v-model:value="localBrushSize"
                class="slider-row__num"
                size="small"
                :min="1"
                :max="50"
                :disabled="step !== 1"
                @update:value="onLocalBrushSizeChange"
              />
            </div>
          </n-form-item>
        </div>
        <n-button-group size="small" class="step-actions">
          <n-button :disabled="step !== 1" @pointerdown="handleBitMap">{{ t('panels.picEditPanel.confirm') }}</n-button>
          <n-button :disabled="step !== 1" @pointerdown="cancelBitMap">{{ t('panels.picEditPanel.cancel') }}</n-button>
          <n-button type="primary" :disabled="step === 1" @pointerdown="toStep1">{{ t('panels.picEditPanel.edit') }}</n-button>
        </n-button-group>
      </n-form>
    </div>

    <div class="effect-wrapper">
      <div class="section-title">{{ t('panels.picEditPanel.step2.title') }}</div>
      <div class="content">{{ t('panels.picEditPanel.step2.content') }}</div>
    </div>

    <div class="effect-wrapper step-3-wrapper">
      <div class="section-title">{{ t('panels.picEditPanel.step3.title') }}</div>
      <n-form class="form fit-curve-form" label-placement="left" :label-width="52">
        <n-form-item :label="t('panels.picEditPanel.step3.maxError')">
          <n-input-number
            v-model:value="maxError"
            :min="1"
            :max="10"
            :precision="2"
            size="small"
            :disabled="step !== 3"
            @update:value="onMaxErrorChange"
          />
        </n-form-item>
        <n-form-item :label="t('panels.picEditPanel.step3.dropThresholding')">
          <n-input-number
            v-model:value="dropThreshold"
            :min="0"
            :max="100"
            :precision="2"
            size="small"
            :disabled="step !== 3"
            @update:value="onDropThresholdChange"
          />
        </n-form-item>
        <n-button-group size="small" class="step-actions">
          <n-button :disabled="step !== 3" @pointerdown="handleFitCurve">{{ t('panels.picEditPanel.confirm') }}</n-button>
          <n-button :disabled="step !== 3" @pointerdown="cancelFitCurve">{{ t('panels.picEditPanel.cancel') }}</n-button>
          <n-button type="primary" :disabled="step === 3" @pointerdown="toStep3">{{ t('panels.picEditPanel.edit') }}</n-button>
        </n-button-group>
      </n-form>
    </div>

    <div class="effect-wrapper">
      <div class="section-title">{{ t('panels.picEditPanel.step4.title') }}</div>
      <div class="content">{{ t('panels.picEditPanel.step4.content') }}</div>
    </div>
  </div>
</template>

<style scoped>
.picture-import-params {
  width: 100%;
  min-height: 100%;
  padding: 10px 10px 24px;
  text-align: left;
  box-sizing: border-box;
}

/* 步骤标题样式由全局 main.css `.right-panel .section-title` 提供（primary-0 底、圆角 20px 5px 等），与其它参数面板一致 */

.form {
  padding: 5px;
}

.picture-import-params :deep(.n-form.form) {
  padding-top: 20px;
}

.effect-wrapper {
  margin-bottom: 20px;
}

.step-1-wrapper,
.step-3-wrapper {
  position: relative;
  margin-bottom: 50px;
  padding-bottom: 48px;
}

.slider-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.slider-row__slider {
  flex: 1;
  min-width: 0;
}

.slider-row__num {
  flex: 0 0 110px;
  width: 110px;
}

.step-actions {
  position: absolute;
  right: 10px;
  bottom: 4px;
  margin-top: 0;
}

.content {
  padding: 20px;
  color: var(--light-4);
}

.tip {
  margin-left: 50px;
  color: var(--light-4);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.tip :deep(.n-button) {
  color: var(--primary-4) !important;
  background-color: var(--dark-2) !important;
  height: 22px !important;
  border-radius: 5px !important;
  margin-left: 5px;
  padding: 0 8px !important;
  border: none !important;
}

.tip :deep(.n-button):hover {
  color: var(--primary-5) !important;
  background-color: var(--dark-3) !important;
}
</style>

<style>
/* 与原 .global-effect .el-form-item__label 宽度一致 */
.picture-import-params .global-effect .n-form-item .n-form-item-label {
  width: 40px !important;
  min-width: 40px !important;
}
</style>
