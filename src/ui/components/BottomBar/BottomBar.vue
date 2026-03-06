<template>
  <div class="bottom-bar">
    <div class="bottom-bar-row" v-if="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
      <span class="tools-wrapper">
        <span class="translate-wrapper">
          <div v-if="tool === 'translateMover'" class="translate-input-wrapper">
            <n-input
              v-model:value="translateText"
              class="translate-text"
              :disabled="true"
            />
            <n-button size="small" @pointerdown="resetTranslate" class="reset-btn">{{ t('panels.bottomBar.reset') }}</n-button>
          </div>
          <font-awesome-icon
            v-else
            class="translate-btn"
            @pointerdown="onTranslate"
            icon="fa-regular fa-hand"
          />
          <font-awesome-icon
            v-if="tool === 'translateMover'"
            class="translate-edit-btn"
            @pointerdown="offTranslate"
            icon="fa-solid fa-hand"
          />
        </span>
        <span class="coords-wrapper">
          <n-input
            v-if="tool === 'coordsViewer'"
            v-model:value="coordsText"
            class="coords-text"
            :disabled="true"
          >
            <template #prefix>
              {{ t('panels.bottomBar.coords') }}
            </template>
          </n-input>
          <font-awesome-icon
            v-else
            class="coords-btn"
            @pointerdown="onCoordsViewer"
            icon="fa-solid fa-arrow-pointer"
          />
          <font-awesome-icon
            v-if="tool === 'coordsViewer'"
            class="coords-edit-btn"
            @pointerdown="offCoordsViewer"
            icon="fa-solid fa-arrow-pointer"
          />
        </span>
        <span class="zoom-settings-wrapper">
          <span class="zoom-out" @pointerdown="zoomEditOut">
            <font-awesome-icon :icon="['fas', 'minus']" />
          </span>
          <n-input-number
            class="zoom-value"
            :value="zoom"
            :min="0"
            :max="200"
            :step="1"
            @update:value="onZoomChange"
          >
            <template #suffix>%</template>
          </n-input-number>
          <span class="zoom-in" @pointerdown="zoomEditIn">
            <font-awesome-icon :icon="['fas', 'plus']" />
          </span>
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NButton, NInputNumber } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useBottomBar } from './composables/useBottomBar'
import { EditStatus } from '@/core/types'

const { t } = useI18n()

const {
  editStatus,
  tool,
  coordsText,
  translateText,
  zoom,
  resetTranslate,
  zoomEditOut,
  zoomEditIn,
  onZoomChange,
  onTranslate,
  offTranslate,
  onCoordsViewer,
  offCoordsViewer,
} = useBottomBar()
</script>

<style scoped>
.bottom-bar,
.bottom-bar-row {
  width: 100%;
  position: relative;
  z-index: 99;
  background-color: white;
}

.tools-wrapper {
  position: absolute;
  right: 5px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.translate-wrapper {
  line-height: 30px;
  display: flex;
  align-items: center;
}

.translate-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.reset-btn {
  flex-shrink: 0;
}

.translate-btn,
.translate-edit-btn {
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coords-wrapper {
  line-height: 30px;
  margin: 0 10px;
  display: flex;
  align-items: center;
}

.coords-btn,
.coords-edit-btn {
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coords-text {
  width: 160px;
}

.zoom-settings-wrapper {
  display: flex;
  flex-direction: row;
  width: 180px;
  margin-left: auto;
  align-items: center;
}

.zoom-out,
.zoom-in {
  flex: 0 0 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.zoom-value,
.translate-text,
.coords-text {
  flex: auto;
  border-radius: 0;
  height: 20px;
  margin: 6px 0;
}

.zoom-value {
  min-width: 60px;
  flex: 1 1 auto;
}

.translate-text,
.coords-text {
  width: 120px;
  margin: 0 10px;
}
</style>
