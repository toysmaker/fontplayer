<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { NForm, NFormItem, NInputNumber, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useCharacterMetricsDraftStore } from '@/stores/characterMetricsDraft'

const { t } = useI18n()
const message = useMessage()
const draft = useCharacterMetricsDraftStore()
const { advanceWidth, lsb, rsb, xMin, xMax, yMin, yMax } = storeToRefs(draft)

const onDataChange = () => {
  draft.recomputeRsb()
}

const confirmMetricsChange = () => {
  if (draft.applyToEditingCharacter()) {
    message.success(t('panels.paramsPanel.applyMetricsTransform'))
  }
}

const resetMetrics = () => {
  if (draft.resetToDefaultOnCharacter()) {
    message.success(t('panels.paramsPanel.resetMetricsTransform'))
  }
}
</script>

<template>
  <div class="character-edit-panel">
    <n-form class="transform-form" label-placement="left" label-width="120">
      <n-form-item label="advanceWidth">
        <n-input-number
          v-model:value="advanceWidth"
          :show-button="false"
          :precision="0"
          @update:value="onDataChange"
        />
      </n-form-item>
      <n-form-item label="lsb">
        <n-input-number
          v-model:value="lsb"
          :show-button="false"
          :precision="0"
          @update:value="onDataChange"
        />
      </n-form-item>
      <n-form-item label="rsb">
        <n-input-number v-model:value="rsb" :show-button="false" :precision="0" disabled />
      </n-form-item>
      <n-form-item label="xMin">
        <n-input-number v-model:value="xMin" :show-button="false" :precision="0" disabled />
      </n-form-item>
      <n-form-item label="xMax">
        <n-input-number v-model:value="xMax" :show-button="false" :precision="0" disabled />
      </n-form-item>
      <n-form-item label="yMin">
        <n-input-number v-model:value="yMin" :show-button="false" :precision="0" disabled />
      </n-form-item>
      <n-form-item label="yMax">
        <n-input-number v-model:value="yMax" :show-button="false" :precision="0" disabled />
      </n-form-item>
    </n-form>
    <div class="metrics-settings">
      <n-button class="metrics-btn" type="primary" block @click="confirmMetricsChange">
        {{ t('panels.paramsPanel.applyMetricsTransform') }}
      </n-button>
      <n-button class="metrics-btn" block @click="resetMetrics">
        {{ t('panels.paramsPanel.resetMetricsTransform') }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.character-edit-panel {
  padding: 10px;
}
.metrics-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.metrics-btn {
  width: 100%;
}
</style>
