<script setup lang="ts">
/**
 * 效果滤镜参数编辑面板
 * 当效果激活时在右侧属性栏显示，提供参数调节和操作按钮
 */

import { computed } from 'vue'
import { NSlider, NInputNumber, NButton, NSpace, NDivider } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useEffectStore } from '@/features/effects/effectStore'
import { getEffectDefinition } from '@/features/effects/types'
import type { EffectType } from '@/features/effects/types'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const effectStore = useEffectStore()

/** kebab-case → camelCase: 'adjust-weight' → 'adjustWeight' */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/** 当前效果定义 */
const definition = computed(() => {
  if (!effectStore.effectType) return null
  return getEffectDefinition(effectStore.effectType as EffectType)
})

/** 参数值的本地副本（用于绑定） */
const paramValues = computed(() => effectStore.params)

/** 参数变化处理 */
function onParamChange(key: string, value: number | null) {
  if (value === null) return
  effectStore.updateParam(key, value)
}

/** 应用效果到全部字符（带防抖） */
const handleApplyToAll = createDebouncedHandler(
  () => {
    effectStore.applyToAllCharacters()
  },
  'effect-apply-all',
)

/** 取消效果（带防抖） */
const handleCancel = createDebouncedHandler(
  () => {
    effectStore.cancelEffect()
  },
  'effect-cancel',
)
</script>

<template>
  <div class="effect-params-panel">
    <!-- 标题 -->
    <div class="panel-header">
      <h3 class="effect-title">
        {{ t(`effects.${kebabToCamel(effectStore.effectType)}.title`) }}
      </h3>
      <p class="effect-description">
        {{ t(`effects.${kebabToCamel(effectStore.effectType)}.description`) }}
      </p>
    </div>

    <n-divider />

    <!-- 参数列表 -->
    <div class="params-list">
      <div
        v-for="param in definition?.params"
        :key="param.key"
        class="param-item"
      >
        <div class="param-label">
          {{ t(param.labelKey) }}
        </div>
        <div class="param-controls">
          <n-input-number
            :value="paramValues[param.key] ?? param.default"
            :min="param.min"
            :max="param.max"
            :step="param.step"
            size="small"
            style="width: 100%;"
            @update:value="(val: number | null) => onParamChange(param.key, val)"
          />
          <n-slider
            :value="paramValues[param.key] ?? param.default"
            :min="param.min"
            :max="param.max"
            :step="param.step"
            style="width: 100%;"
            @update:value="(val: number) => onParamChange(param.key, val)"
          />
        </div>
      </div>
    </div>

    <n-divider />

    <!-- 操作按钮 -->
    <n-space vertical style="width: 100%;">
      <n-button
        type="primary"
        block
        :loading="effectStore.isApplyingToAll"
        @click="handleApplyToAll"
        @pointerup="handleApplyToAll"
      >
        {{ t('effects.applyToAll') }}
      </n-button>
      <n-button
        block
        @click="handleCancel"
        @pointerup="handleCancel"
      >
        {{ t('effects.cancel') }}
      </n-button>
    </n-space>
  </div>
</template>

<style scoped>
.effect-params-panel {
  padding: 12px;
  height: 100%;
  overflow-y: auto;
}

.panel-header {
  margin-bottom: 4px;
}

.effect-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: var(--text-color-1);
}

.effect-description {
  font-size: 12px;
  color: var(--text-color-3);
  margin: 0;
  line-height: 1.5;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color-2);
}

.param-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
</style>
