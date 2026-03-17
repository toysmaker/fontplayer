<template>
  <div class="tab-panel">
    <n-scrollbar style="max-height: 460px">
      <div class="table-item">
        <div class="item-name">majorVersion</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.majorVersion" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.majorVersion }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">minorVersion</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.minorVersion" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.minorVersion }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">fontRevision</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.fontRevision" :precision="3" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.fontRevision }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">flags</div>
        <div class="item-content item-content-column">
          <div v-for="(bitIndex, i) in flagsBitIndices" :key="'f' + bitIndex" class="flags-item">
            <div class="flags-item-checkbox">
              <n-checkbox v-model:checked="data.flags[bitIndex]" />
            </div>
            <div class="flags-item-name">Bit-{{ bitIndex }}</div>
            <div class="flags-item-description">{{ flagsDescriptions[bitIndex] }}</div>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">created</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number :value="data.created.timestamp" :precision="0" disabled class="input-narrow" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.created }}
            </n-tooltip>
            <n-date-picker
              v-model:value="createdDateMs"
              type="datetime"
              clearable
            />
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">modified</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number :value="data.modified.timestamp" :precision="0" disabled class="input-narrow" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.modified }}
            </n-tooltip>
            <n-date-picker
              v-model:value="modifiedDateMs"
              type="datetime"
              clearable
            />
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">macStyle</div>
        <div class="item-content item-content-column">
          <div v-for="idx in 7" :key="'m' + idx" class="mac-style-item">
            <div class="mac-style-item-checkbox">
              <n-checkbox v-model:checked="data.macStyle[idx - 1]" />
            </div>
            <div class="mac-style-item-name">Bit-{{ idx - 1 }}</div>
            <div class="mac-style-item-description">{{ macStyleDescriptions[idx - 1] }}</div>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">lowestRecPPEM</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.lowestRecPPEM" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.lowestRecPPEM }}
            </n-tooltip>
          </div>
        </div>
      </div>
      <div class="table-item">
        <div class="item-name">fontDirectionHint</div>
        <div class="item-content">
          <div class="form-item-with-tip">
            <n-input-number v-model:value="data.fontDirectionHint" :precision="0" />
            <n-tooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span class="field-tip-icon">?</span>
              </template>
              {{ tips.fontDirectionHint }}
            </n-tooltip>
          </div>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { NScrollbar, NFormItem, NInputNumber, NTooltip, NCheckbox, NDatePicker } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { HeadTable } from './types'

const { locale } = useI18n()

const props = defineProps<{
  data: HeadTable
}>()

const MAC_EPOCH_OFFSET = 2082844800

const flagsBitIndices = [0, 1, 2, 3, 4, 11, 12, 13, 14]

const tipsZh: Record<string, string> = {
  majorVersion: '表版本的主版本号，格式为uint16',
  minorVersion: '表版本的次版本号，格式为uint16',
  fontRevision: '字体版本号，由字体开发者定义，格式为Fixed',
  created: '字体的创建时间，表示自 1904-01-01 零时以来的秒数。以 64 位整数表示',
  modified: '字体的最后修改时间，表示自 1904-01-01 零时以来的秒数。以 64 位整数表示',
  lowestRecPPEM: '字体建议的最小每字符像素尺寸 (Pixels Per Em)',
  fontDirectionHint: '字体的排版方向提示信息，通常为 0（左到右排版）',
}
const tipsEn: Record<string, string> = {
  majorVersion: 'Major version number of the table format, must be a uint16',
  minorVersion: 'Minor version number of the table format, must be a uint16',
  fontRevision: 'Font revision number defined by the font developer, format: Fixed',
  created: 'Font creation time represented as seconds since 1904-01-01 00:00:00. Stored as 64-bit integer',
  modified: 'Font modification time represented as seconds since 1904-01-01 00:00:00. Stored as 64-bit integer',
  lowestRecPPEM: 'Recommended minimum pixels per em (PPEM) size for this font',
  fontDirectionHint: 'Font layout direction hint (0 = left-to-right layout)',
}
const tips = computed(() => (locale.value === 'en' ? tipsEn : tipsZh))

const flagsDescriptionsZh = [
  '字体基线位于 `y=0`',
  '左侧起始点位于 `x=0`（仅与 TrueType 光栅化器相关）——参见有关可变字体的附加信息',
  '指令可能依赖于点大小（point size）',
  '强制内部缩放器的所有数学运算使用整数的 ppem（每 Em 单位的像素数值）；如果此位未设置，则可以使用小数 ppem 值。**强烈建议在启用了 hinting（轮廓微调）的字体中设置此位**',
  '指令可能会更改前进宽度（advance width），即前进宽度可能不会线性缩放',
  '此位在 OpenType 中未使用，为了确保在所有平台上的兼容行为，不应设置此位。如果设置，可能导致某些平台的垂直布局行为不同。（详见 Apple 规范中有关 Apple 平台的行为说明。）',
  '在 OpenType 中未使用，且应始终清零',
  '在 OpenType 中未使用，且应始终清零',
  '在 OpenType 中未使用，且应始终清零',
  '在 OpenType 中未使用，且应始终清零',
  '在 OpenType 中未使用，且应始终清零',
  '字体数据是“无损的”，即经过优化转换和/或压缩（例如符合 ISO/IEC 14496-18、MicroType® Express、WOFF 2.0 或类似的压缩机制），保留了原始字体的功能和特性，但输入和输出字体文件之间的二进制兼容性无法保证。由于所应用的转换，DSIG 表可能也会失效。',
  '字体已被转换（生成兼容的度量信息）',
  '字体针对 ClearType® 进行了优化。',
  '备用字体（Last Resort font）',
  '保留位，必须设置为 0。',
]
const flagsDescriptionsEn = [
  'Baseline at y=0',
  'Left sidebearing at x=0 (relevant for TrueType rasterizer) - see additional notes for variable fonts',
  'Instructions may depend on point size',
  'Force internal scaler to use integer ppem values. **Strongly recommended for hinted fonts**',
  'Instructions may alter advance width (non-linear scaling)',
  '[Reserved for Apple] If set, may cause vertical layout divergence on some platforms (see Apple specifications)',
  '[Unused in OpenType] Must be 0',
  '[Unused in OpenType] Must be 0',
  '[Unused in OpenType] Must be 0',
  '[Unused in OpenType] Must be 0',
  '[Unused in OpenType] Must be 0',
  'Font contains lossless compressed data (e.g., WOFF 2.0). Note: DSIG table may become invalid',
  'Font contains converted metrics (compatible metrics)',
  'Optimized for ClearType® rendering',
  'Last Resort fallback font',
  'Reserved bit (must be 0)',
]
const flagsDescriptions = computed(() => (locale.value === 'en' ? flagsDescriptionsEn : flagsDescriptionsZh))

const macStyleDescriptionsZh = ['粗体', '斜体', '下划线', '轮廓字体', '阴影', '窄体', '宽体']
const macStyleDescriptionsEn = ['Bold', 'Italic', 'Underline', 'Outline', 'Shadow', 'Condensed', 'Extended']
const macStyleDescriptions = computed(() => (locale.value === 'en' ? macStyleDescriptionsEn : macStyleDescriptionsZh))

const createdDateMs = computed({
  get: () => (props.data.created.timestamp ? (props.data.created.timestamp - MAC_EPOCH_OFFSET) * 1000 : null),
  set: (v: number | null) => {
    if (v != null) {
      props.data.created.timestamp = Math.floor(v / 1000) + MAC_EPOCH_OFFSET
      props.data.created.value = v
    }
  },
})
const modifiedDateMs = computed({
  get: () => (props.data.modified.timestamp ? (props.data.modified.timestamp - MAC_EPOCH_OFFSET) * 1000 : null),
  set: (v: number | null) => {
    if (v != null) {
      props.data.modified.timestamp = Math.floor(v / 1000) + MAC_EPOCH_OFFSET
      props.data.modified.value = v
    }
  },
})

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
.item-content-column {
  flex-direction: column;
  align-items: stretch;
}
.form-item-with-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.form-item-with-tip .n-input-number,
.form-item-with-tip .n-date-picker {
  flex: 1;
  min-width: 0;
}
.form-item-with-tip .input-narrow {
  flex: 0 0 auto;
  min-width: 100px;
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
.flags-item,
.mac-style-item {
  display: flex;
  flex-direction: row;
  line-height: 32px;
  color: var(--light-0);
  margin-bottom: 4px;
}
.flags-item-name,
.mac-style-item-name {
  flex: 0 0 60px;
}
.flags-item-description,
.mac-style-item-description {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--light-3);
}
.flags-item-checkbox,
.mac-style-item-checkbox {
  margin-right: 10px;
}
</style>
