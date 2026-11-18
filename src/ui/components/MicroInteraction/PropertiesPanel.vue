<template>
  <div class="props-panel">
    <div class="props-title">{{ t('dialogs.microInteraction.properties') }}</div>

    <!-- 状态属性 -->
    <template v-if="selectedState">
      <n-form label-placement="top" size="small">
        <n-form-item :label="t('dialogs.microInteraction.name')">
          <n-input
            :value="selectedState.name"
            @update:value="(v: string) => store.updateState(selectedState.id, { name: v })"
          />
        </n-form-item>
        <n-form-item :label="t('dialogs.microInteraction.segment')">
          <n-select
            :value="selectedState.segmentId"
            :options="segmentOptions"
            @update:value="(v: string) => store.updateState(selectedState.id, { segmentId: v })"
          />
        </n-form-item>
        <n-form-item :label="t('dialogs.microInteraction.loop')">
          <n-switch
            :value="selectedState.loop"
            @update:value="(v: boolean) => store.updateState(selectedState.id, { loop: v })"
          />
        </n-form-item>
      </n-form>
      <n-button
        size="small"
        type="error"
        block
        @click="handleRemoveState(selectedState.id)"
        @pointerup="handleRemoveState(selectedState.id)"
      >{{ t('dialogs.microInteraction.deleteState') }}</n-button>
    </template>

    <!-- 转换属性 -->
    <template v-else-if="selectedTransition">
      <div class="props-transition-info">
        {{ t('dialogs.microInteraction.from') }}: {{ stateName(selectedTransition.from) }}
        → {{ t('dialogs.microInteraction.to') }}: {{ stateName(selectedTransition.to) }}
      </div>
      <div class="props-conditions-title">
        {{ t('dialogs.microInteraction.conditions') }}
        <n-button size="tiny" @click="handleAddCondition" @pointerup="handleAddCondition">
          + {{ t('dialogs.microInteraction.addCondition') }}
        </n-button>
      </div>
      <div v-if="selectedTransition.conditions.length === 0" class="props-no-conditions">
        {{ t('dialogs.microInteraction.noConditions') }}
      </div>
      <div
        v-for="(cond, index) in selectedTransition.conditions"
        :key="index"
        class="props-condition-row"
      >
        <n-select
          size="tiny"
          class="props-cond-input"
          :value="cond.inputId"
          :options="inputOptions"
          @update:value="(v: string) => store.updateCondition(selectedTransition.id, index, { inputId: v })"
        />
        <n-select
          size="tiny"
          class="props-cond-op"
          :value="cond.operator"
          :options="operatorOptions"
          @update:value="(v: string) => store.updateCondition(selectedTransition.id, index, { operator: v as any })"
        />
        <n-select
          v-if="condInputType(cond.inputId) !== 'number'"
          size="tiny"
          class="props-cond-value"
          :value="Boolean(cond.value)"
          :options="boolOptions"
          @update:value="(v: boolean) => store.updateCondition(selectedTransition.id, index, { value: v })"
        />
        <n-input-number
          v-else
          size="tiny"
          class="props-cond-value"
          :value="Number(cond.value)"
          @update:value="(v: number | null) => v !== null && store.updateCondition(selectedTransition.id, index, { value: v })"
        />
        <n-button size="tiny" quaternary type="error" @click.stop="handleRemoveCondition(selectedTransition.id, index)" @pointerup.stop="handleRemoveCondition(selectedTransition.id, index)">
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </n-button>
      </div>
      <n-button
        size="small"
        block
        class="props-reverse-transition"
        @click="handleAddReverse(selectedTransition.id)"
        @pointerup="handleAddReverse(selectedTransition.id)"
      >{{ t('dialogs.microInteraction.addReverseTransition') }}</n-button>
      <n-button
        size="small"
        type="error"
        block
        class="props-delete-transition"
        @click="handleRemoveTransition(selectedTransition.id)"
        @pointerup="handleRemoveTransition(selectedTransition.id)"
      >{{ t('dialogs.microInteraction.deleteTransition') }}</n-button>
    </template>

    <!-- 未选中 -->
    <div v-else class="props-hint">{{ t('dialogs.microInteraction.selectHint') }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 属性面板：根据选中对象（状态/转换/无）动态渲染表单。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { useAnimationStore } from '@/stores/animation'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const store = useMicroInteractionStore()
const animationStore = useAnimationStore()

const selectedState = computed(() => store.selectedState)
const selectedTransition = computed(() => store.selectedTransition)

const segmentOptions = computed(() => {
  // 应用级微交互（store.segments 非空）优先；否则回退字符动效列表
  if (store.segments.length > 0) {
    return store.segments.map((s) => ({ label: s.name, value: s.id }))
  }
  return animationStore.clips.map((c) => ({ label: c.name, value: c.id }))
})
const inputOptions = computed(() =>
  (store.draft?.inputs ?? []).map((i) => ({ label: i.name, value: i.id })),
)
const operatorOptions = [
  { label: '= ' + t('dialogs.microInteraction.opEq'), value: 'eq' },
  { label: '≠ ' + t('dialogs.microInteraction.opNeq'), value: 'neq' },
  { label: '> ' + t('dialogs.microInteraction.opGt'), value: 'gt' },
  { label: '< ' + t('dialogs.microInteraction.opLt'), value: 'lt' },
]
const boolOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
]

function stateName(id: string): string {
  return store.draft?.states.find((s) => s.id === id)?.name ?? '?'
}

function condInputType(inputId: string): string {
  return store.draft?.inputs.find((i) => i.id === inputId)?.type ?? 'boolean'
}

const _removeState = (id: string) => {
  store.removeState(id)
}
const handleRemoveState = createDebouncedHandler(_removeState, 'PropertiesPanel.removeState', (args) => args[0])

const _addReverse = (id: string) => {
  store.addReverseTransition(id)
}
const handleAddReverse = createDebouncedHandler(_addReverse, 'PropertiesPanel.addReverse', (args) => args[0])

const _removeTransition = (id: string) => {
  store.removeTransition(id)
}
const handleRemoveTransition = createDebouncedHandler(_removeTransition, 'PropertiesPanel.removeTransition', (args) => args[0])

const _removeCondition = (transitionId: string, index: number) => {
  store.removeCondition(transitionId, index)
}
const handleRemoveCondition = createDebouncedHandler(
  _removeCondition,
  'PropertiesPanel.removeCondition',
  (args) => `${args[0]}:${args[1]}`,
)

const _addCondition = () => {
  if (store.selectedTransition) {
    if ((store.draft?.inputs ?? []).length === 0) return
    store.addCondition(store.selectedTransition.id)
  }
}
const handleAddCondition = createDebouncedHandler(_addCondition, 'PropertiesPanel.addCondition')
</script>

<style scoped>
.props-panel {
  height: 100%;
  overflow-y: auto;
  padding: 8px;
}
.props-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.props-transition-info {
  font-size: 12px;
  margin-bottom: 8px;
  color: #444;
}
.props-conditions-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
.props-no-conditions {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}
.props-condition-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  min-width: 0;
}
.props-cond-input {
  flex: 1;
  min-width: 40px;
}
.props-cond-op {
  flex: 0 0 60px;
}
.props-cond-value {
  flex: 0 0 64px;
}
.props-reverse-transition {
  margin-top: 10px;
}
.props-delete-transition {
  margin-top: 10px;
}
.props-hint {
  color: #999;
  font-size: 12px;
  padding: 20px 0;
  text-align: center;
}
</style>
