<template>
  <div class="tab-panel">
    <n-scrollbar style="max-height: 460px" class="tab-scrollbar">
      <div class="tab-scrollbar-inner">
      <div class="table-item">
        <div class="item-name">version</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.version" :precision="0" disabled />
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
        <div class="item-name">usWeightClass</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.usWeightClass" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.usWeightClass }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">usWidthClass</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.usWidthClass" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.usWidthClass }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">fsType</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.fsType" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.fsType }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySubscriptXSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySubscriptXSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySubscriptXSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySubscriptYSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySubscriptYSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySubscriptYSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySubscriptXOffset</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySubscriptXOffset" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySubscriptXOffset }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySubscriptYOffset</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySubscriptYOffset" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySubscriptYOffset }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySuperscriptXSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySuperscriptXSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySuperscriptXSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySuperscriptYSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySuperscriptYSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySuperscriptYSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySuperscriptXOffset</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySuperscriptXOffset" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySuperscriptXOffset }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">ySuperscriptYOffset</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.ySuperscriptYOffset" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.ySuperscriptYOffset }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">yStrikeoutSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.yStrikeoutSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.yStrikeoutSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">yStrikeoutPosition</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.yStrikeoutPosition" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.yStrikeoutPosition }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">sFamilyClass</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.sFamilyClass" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.sFamilyClass }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">panose</div>
        <div class="item-content item-content-column">
          <div v-for="(_, index) in data.panose" :key="index" class="panose-item">
            <n-input-number v-model:value="data.panose[index]" :precision="0" :min="0" class="panose-input" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ panoseDescriptions[index].range }}
            </n-tooltip>
            <div class="panose-item-description">{{ panoseDescriptions[index].description }}</div>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">achVendID</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input v-model:value="data.achVendID" :maxlength="4" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.achVendID }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">fsSelection</div>
        <div class="item-content item-content-column">
          <div v-for="(_, index) in data.fsSelection" :key="'fs' + index" class="fs-selection-item">
            <div class="fs-selection-item-checkbox">
              <n-checkbox v-model:checked="data.fsSelection[index]" />
            </div>
            <div class="fs-selection-item-name">Bit-{{ index }}</div>
            <div class="fs-selection-item-description">{{ fsSelectionDescriptions[index].description }}</div>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">usMaxContext</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.usMaxContext" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.usMaxContext }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">usLowerOpticalPointSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.usLowerOpticalPointSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.usLowerOpticalPointSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">usUpperOpticalPointSize</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.usUpperOpticalPointSize" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.usUpperOpticalPointSize }}
            </n-tooltip>
          </div>
        </div>
      </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NScrollbar, NInput, NInputNumber, NTooltip, NCheckbox } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Os2Table } from './types'

const { locale } = useI18n()

defineProps<{
  data: Os2Table
}>()

const tipsZh: Record<string, string> = {
  version: '表的版本号',
  usWeightClass: '字体的字重（Weight），范围为 1–1000，常见值如 400（Regular）、700（Bold）。',
  usWidthClass: '字体的宽度类别，范围为 1（Ultra-condensed）到 9（Ultra-expanded）。',
  fsType: '字体的嵌入许可权限，如禁止嵌入、仅打印预览等。',
  ySubscriptXSize: '下标字符的推荐宽度',
  ySubscriptYSize: '下标字符的推荐高度',
  ySubscriptXOffset: '下标字符相对基线的 X 轴偏移量',
  ySubscriptYOffset: '下标字符相对基线的 Y 轴偏移量',
  ySuperscriptXSize: '上标字符的推荐宽度',
  ySuperscriptYSize: '上标字符的推荐高度',
  ySuperscriptXOffset: '上标字符相对基线的 X 轴偏移量',
  ySuperscriptYOffset: '上标字符相对基线的 Y 轴偏移量',
  yStrikeoutSize: '删除线的厚度',
  yStrikeoutPosition: '删除线相对基线的位置',
  sFamilyClass: '字体家族类别，用于定义字体的设计风格（如 Serif、Sans-serif）。',
  achVendID: '字体供应商的 4 字符标识符',
  usMaxContext: '字体上下文长度的最大值（如字形替换所需的上下文长度）',
  usLowerOpticalPointSize: '字体的最低推荐光学字号',
  usUpperOpticalPointSize: '字体的最高推荐光学字号',
}
const tipsEn: Record<string, string> = {
  version: 'Table version number',
  usWeightClass: 'Font weight (1–1000 range, e.g. 400=Regular, 700=Bold)',
  usWidthClass: 'Font width classification (1=Ultra-condensed to 9=Ultra-expanded)',
  fsType: 'Font embedding licensing permissions (e.g., print-only embedding restrictions)',
  ySubscriptXSize: 'Recommended horizontal size for subscript characters',
  ySubscriptYSize: 'Recommended vertical size for subscript characters',
  ySubscriptXOffset: 'X-axis offset from baseline for subscript positioning',
  ySubscriptYOffset: 'Y-axis offset from baseline for subscript positioning',
  ySuperscriptXSize: 'Recommended horizontal size for superscript characters',
  ySuperscriptYSize: 'Recommended vertical size for superscript characters',
  ySuperscriptXOffset: 'X-axis offset from baseline for superscript positioning',
  ySuperscriptYOffset: 'Y-axis offset from baseline for superscript positioning',
  yStrikeoutSize: 'Strikeout stroke thickness',
  yStrikeoutPosition: 'Vertical position of strikeout relative to baseline',
  sFamilyClass: 'Font family classification (e.g., Serif/Sans-serif design categories)',
  achVendID: '4-character font vendor identifier',
  usMaxContext: 'Maximum context length required for glyph substitution',
  usLowerOpticalPointSize: 'Minimum recommended optical size for this font',
  usUpperOpticalPointSize: 'Maximum recommended optical size for this font',
}
const tips = computed(() => (locale.value === 'en' ? tipsEn : tipsZh))

const panoseDescriptionsZh = [
  { description: '表示字体的家族类型，比如无衬线字体、衬线字体、等宽字体等。', range: '取值范围：0-11' },
  { description: '仅适用于衬线字体，用于描述衬线的样式。', range: '取值范围：0-5' },
  { description: '字体的粗细程度。', range: '取值范围：0-9' },
  { description: '字体的宽度，比如标准宽度、压缩宽度或扩展宽度等。', range: '取值范围：0-5' },
  { description: '字体笔画的对比度。', range: '取值范围：0-5' },
  { description: '字体的笔画变化。', range: '取值范围：0-3' },
  { description: '字母中横臂的样式。', range: '取值范围：0-3' },
  { description: '字母的形态，指字形的样式。', range: '取值范围：0-2' },
  { description: '字符中线位置。', range: '取值范围：0-2' },
  { description: '小写字母相对高度。', range: '取值范围：0-5' },
]
const panoseDescriptionsEn = [
  { description: 'Font classification category (e.g., Sans-serif, Serif, Monospace)', range: 'Range: 0-11' },
  { description: 'Serif design characteristics (applies to Serif fonts)', range: 'Range: 0-5' },
  { description: 'Stroke thickness progression from light to black', range: 'Range: 0-9' },
  { description: 'Character width characteristics', range: 'Range: 0-5' },
  { description: 'Stroke thickness variation', range: 'Range: 0-5' },
  { description: 'Transition between thick/thin stroke elements', range: 'Range: 0-3' },
  { description: 'Terminal treatment of non-curved strokes', range: 'Range: 0-3' },
  { description: 'Overall letter shape characteristics', range: 'Range: 0-2' },
  { description: 'Position of character midline', range: 'Range: 0-2' },
  { description: 'Relative height of lowercase letters', range: 'Range: 0-5' },
]
const panoseDescriptions = computed(() => (locale.value === 'en' ? panoseDescriptionsEn : panoseDescriptionsZh))

const fsSelectionDescriptionsZh = [
  { description: '如果勾选，则表明字体是斜体。' },
  { description: '如果勾选，则表明字体支持下划线功能（很少使用）。' },
  { description: '如果勾选，则表明字体是倒影（白色轮廓字体，背景填充黑色）。' },
  { description: '如果勾选，则表明字体是轮廓字体。' },
  { description: '如果勾选，则表明字体支持删除线功能。' },
  { description: '如果勾选，则表明字体是粗体。' },
  { description: '如果勾选，则表明字体是常规样式（非斜体、非粗体等）。' },
  { description: '如果勾选，应用程序应该使用 OS/2 表中的 sTypoAscender 和 sTypoDescender。' },
  { description: '如果勾选，则表明字体支持“宽度、权重和样式”的命名方案。' },
  { description: '如果勾选，则表明字体是倾斜体（与 Italic 区别在于更机械化的倾斜）。' },
]
const fsSelectionDescriptionsEn = [
  { description: 'Indicates italic style' },
  { description: 'Font contains underline metadata (rarely used)' },
  { description: 'Reverse-video outline effect (white foreground fill)' },
  { description: 'Font uses outline effect styling' },
  { description: 'Font contains strikeout metadata' },
  { description: 'Indicates bold weight style' },
  { description: 'Base style flag (non-italic/non-bold)' },
  { description: 'Use OS/2 table\'s sTypoAscender/sTypoDescender for layout' },
  { description: 'Font supports Weight, Width, Slope naming' },
  { description: 'Indicates oblique style (mechanically slanted)' },
]
const fsSelectionDescriptions = computed(() => (locale.value === 'en' ? fsSelectionDescriptionsEn : fsSelectionDescriptionsZh))
</script>

<style scoped>
.tab-panel {
  padding: 16px;
  min-height: 360px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.tab-scrollbar {
  display: block;
  width: 100%;
  min-width: 0;
}
.tab-scrollbar :deep(.n-scrollbar-container) {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}
.tab-scrollbar :deep(.n-scrollbar-content) {
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  box-sizing: border-box;
}
.tab-scrollbar-inner {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}
.table-item {
  display: flex;
  flex-direction: row;
  margin-bottom: 10px;
  min-width: 0;
}
.item-name {
  flex: 0 0 160px;
  flex-shrink: 0;
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
.item-content-column {
  flex-direction: column;
  align-items: stretch;
  overflow: hidden;
  min-width: 0;
}
.form-item-with-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.form-item-with-tip .n-input-number,
.form-item-with-tip .n-input {
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
.panose-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  line-height: 32px;
  margin-bottom: 4px;
  min-width: 0;
}
.panose-item .panose-input {
  flex: 0 0 160px;
  margin-right: 8px;
}
.panose-item-description {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--light-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 10px;
}
.fs-selection-item {
  display: flex;
  flex-direction: row;
  line-height: 32px;
  color: var(--light-0);
  margin-bottom: 4px;
}
.fs-selection-item-name {
  flex: 0 0 60px;
}
.fs-selection-item-description {
  flex: 1;
  font-size: 12px;
  color: var(--light-3);
}
.fs-selection-item-checkbox {
  margin-right: 10px;
}
</style>
