<template>
  <div class="tab-panel">
    <n-scrollbar style="max-height: 460px">
      <div class="table-item">
        <div class="item-name">version</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input :value="postVersionDisplay" disabled />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.version }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">italicAngle</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.italicAngle" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.italicAngle }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">underlinePosition</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.underlinePosition" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.underlinePosition }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">underlineThickness</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.underlineThickness" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.underlineThickness }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">isFixedPitch</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.isFixedPitch" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.isFixedPitch }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">minMemType42</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.minMemType42" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.minMemType42 }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">maxMemType42</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.maxMemType42" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.maxMemType42 }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">minMemType1</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.minMemType1" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.minMemType1 }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">maxMemType1</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.maxMemType1" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.maxMemType1 }}
            </n-tooltip>
          </div>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NScrollbar, NInput, NInputNumber, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { PostTable } from './types'

const props = defineProps<{
  data: PostTable
}>()

const { locale } = useI18n()

/** 将 post 表 version 数字解析为显示字符串，如 0x00030000 -> "version 3.0" */
function formatPostVersion(version: number): string {
  const major = (version >>> 16) & 0xffff
  const minor = version & 0xffff
  return `version ${major}.${minor}`
}

const postVersionDisplay = computed(() => formatPostVersion(props.data.version))

const tipsZh: Record<string, string> = {
  version: 'version 3.0',
  italicAngle: '斜体角度是指从垂直方向开始，逆时针计算的角度。对于直立文本，斜体角度为零；对于向右倾斜（前倾）的文本，斜体角度为负值。',
  underlinePosition: '建议的下划线顶部的 y 坐标。',
  underlineThickness: '建议的下划线粗细值。通常，下划线的粗细应与下划线字符（U+005F LOW LINE）的粗细相匹配，并且应与在 OS/2 表中指定的删除线粗细相匹配。',
  isFixedPitch: '如果字体是等宽字体，则设置为非零值；如果字体是比例间距字体，则设置为 0。',
  minMemType42: '下载 OpenType 字体时的最小内存使用量。',
  maxMemType42: '下载 OpenType 字体时的最大内存使用量。',
  minMemType1: '当 OpenType 字体以 Type 1 字体格式下载时的最小内存使用量。',
  maxMemType1: '当 OpenType 字体以 Type 1 字体格式下载时的最大内存使用量。',
}
const tipsEn: Record<string, string> = {
  version: 'Version 3.0',
  italicAngle: 'Italic angle in degrees (counter-clockwise from vertical). Positive for left-leaning, negative for right-leaning italic. Upright=0',
  underlinePosition: 'Recommended y-coordinate for top of underline stroke',
  underlineThickness: 'Recommended underline stroke thickness. Should match U+005F LOW LINE glyph and OS/2 table\'s strikeout thickness',
  isFixedPitch: 'Non-zero value indicates monospace font; 0 indicates proportional font',
  minMemType42: 'Minimum memory usage when downloading as OpenType/CFF font (Type 42)',
  maxMemType42: 'Maximum memory usage when downloading as OpenType/CFF font (Type 42)',
  minMemType1: 'Minimum memory usage when downloaded as Type 1 font',
  maxMemType1: 'Maximum memory usage when downloaded as Type 1 font',
}
const tips = computed(() => (locale.value === 'en' ? tipsEn : tipsZh))
</script>

<style scoped>
.tab-panel {
  padding: 16px;
  min-height: 360px;
}
.table-item {
  display: flex;
  flex-direction: row;
  margin-bottom: 10px;
}
.item-name {
  flex: 0 0 160px;
  text-align: center;
  color: var(--light-0);
  line-height: 32px;
}
.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}
.form-item-with-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.form-item-with-tip .n-input,
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
