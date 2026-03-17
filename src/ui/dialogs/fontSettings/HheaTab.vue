<template>
  <div class="tab-panel">
    <n-form label-placement="left" label-width="120" class="hhea-form">
      <n-form-item label="majorVersion">
        <div class="form-item-with-tip">
          <n-input-number v-model:value="data.majorVersion" :precision="0" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="field-tip-icon">?</span>
            </template>
            {{ tips.majorVersion }}
          </n-tooltip>
        </div>
      </n-form-item>
      <n-form-item label="minorVersion">
        <div class="form-item-with-tip">
          <n-input-number v-model:value="data.minorVersion" :precision="0" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="field-tip-icon">?</span>
            </template>
            {{ tips.minorVersion }}
          </n-tooltip>
        </div>
      </n-form-item>
      <n-form-item label="lineGap">
        <div class="form-item-with-tip">
          <n-input-number v-model:value="data.lineGap" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="field-tip-icon">?</span>
            </template>
            {{ tips.lineGap }}
          </n-tooltip>
        </div>
      </n-form-item>
      <n-form-item label="caretSlopeRise">
        <div class="form-item-with-tip">
          <n-input-number v-model:value="data.caretSlopeRise" :precision="0" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="field-tip-icon">?</span>
            </template>
            {{ tips.caretSlopeRise }}
          </n-tooltip>
        </div>
      </n-form-item>
      <n-form-item label="caretSlopeRun">
        <div class="form-item-with-tip">
          <n-input-number v-model:value="data.caretSlopeRun" :precision="0" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="field-tip-icon">?</span>
            </template>
            {{ tips.caretSlopeRun }}
          </n-tooltip>
        </div>
      </n-form-item>
      <n-form-item label="caretOffset">
        <div class="form-item-with-tip">
          <n-input-number v-model:value="data.caretOffset" :precision="0" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="field-tip-icon">?</span>
            </template>
            {{ tips.caretOffset }}
          </n-tooltip>
        </div>
      </n-form-item>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NForm, NFormItem, NInputNumber, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { HheaTable } from './types'

const { locale } = useI18n()

defineProps<{
  data: HheaTable
}>()

const tipsZh: Record<string, string> = {
  majorVersion: '表版本的主版本号，格式为uint16',
  minorVersion: '表版本的次版本号，格式为uint16',
  lineGap: '行间距的额外空间，指两行文本之间的额外间隔，格式为FWORD',
  caretSlopeRise: '光标的斜率的分子部分，定义插入符的倾斜角度（通常为 1）。格式为int16',
  caretSlopeRun: '光标的斜率的分母部分，定义插入符的倾斜角度（通常为 0）。格式为int16',
  caretOffset: '光标相对于标准位置的水平偏移量，通常为 0。格式为int16',
}
const tipsEn: Record<string, string> = {
  majorVersion: 'Major version number of the table format (uint16)',
  minorVersion: 'Minor version number of the table format (uint16)',
  lineGap: 'Additional space between lines (extra spacing between text rows), format: FWORD',
  caretSlopeRise: 'Vertical slope component defining caret angle (typically 1). Format: int16',
  caretSlopeRun: 'Horizontal slope component defining caret angle (typically 0). Format: int16',
  caretOffset: 'Horizontal offset from standard caret position (usually 0). Format: int16',
}
const tips = computed(() => (locale.value === 'en' ? tipsEn : tipsZh))
</script>

<style scoped>
.tab-panel {
  padding: 16px;
  min-height: 360px;
  width: 100%;
}
.hhea-form {
  width: 100%;
}
.hhea-form :deep(.n-form-item-blank) {
  flex: 1;
  min-width: 0;
}
.form-item-with-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.form-item-with-tip .n-input-number {
  flex: 1;
  min-width: 0;
}
.field-tip-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--dark-2);
  color: var(--light-4);
  font-size: 12px;
  cursor: help;
}
</style>
