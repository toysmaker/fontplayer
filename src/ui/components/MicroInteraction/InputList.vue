<template>
  <div class="input-list">
    <div class="input-list-title">
      {{ t('dialogs.microInteraction.inputs') }}
      <n-button size="tiny" class="input-add-btn" @click="handleAdd" @pointerup="handleAdd">
        + {{ t('dialogs.microInteraction.addInput') }}
      </n-button>
    </div>
    <div
      v-for="input in inputs"
      :key="input.id"
      class="input-item"
      :class="{ selected: selectedInputId === input.id }"
      @click="select(input.id)"
      @pointerup="select(input.id)"
    >
      <div class="input-item-row">
        <n-input
          size="tiny"
          class="input-name"
          :value="input.name"
          :placeholder="t('dialogs.microInteraction.inputName')"
          @update:value="(v: string) => update(input.id, { name: v })"
        />
        <n-button size="tiny" quaternary type="error" class="input-delete" @click.stop="remove(input.id)" @pointerup.stop="remove(input.id)">
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </n-button>
      </div>
      <div class="input-item-row">
        <span class="input-row-label">{{ t('dialogs.microInteraction.source') }}</span>
        <n-radio-group
          size="tiny"
          class="input-source"
          :value="input.source ?? 'custom'"
          @update:value="(v: string) => onSourceChange(input.id, v)"
        >
          <n-radio-button
            value="hover"
            :title="t('dialogs.microInteraction.sourceHoverHint')"
          >{{ t('dialogs.microInteraction.sourceHover') }}</n-radio-button>
          <n-radio-button
            value="click"
            :title="t('dialogs.microInteraction.sourceClickHint')"
          >{{ t('dialogs.microInteraction.sourceClick') }}</n-radio-button>
          <n-radio-button
            value="custom"
            :title="t('dialogs.microInteraction.sourceCustomHint')"
          >{{ t('dialogs.microInteraction.sourceCustom') }}</n-radio-button>
        </n-radio-group>
      </div>
      <div class="input-item-row">
        <span class="input-row-label">{{ t('dialogs.microInteraction.typeLabel') }}</span>
        <n-radio-group
          size="tiny"
          class="input-type"
          :value="input.type"
          @update:value="(v: string) => onTypeChange(input.id, v)"
        >
          <n-radio-button
            value="boolean"
            :title="t('dialogs.microInteraction.booleanHint')"
          >{{ t('dialogs.microInteraction.typeBoolean') }}</n-radio-button>
          <n-radio-button
            value="trigger"
            :title="t('dialogs.microInteraction.triggerHint')"
          >{{ t('dialogs.microInteraction.typeTrigger') }}</n-radio-button>
          <n-radio-button
            value="number"
            :title="t('dialogs.microInteraction.numberHint')"
          >{{ t('dialogs.microInteraction.typeNumber') }}</n-radio-button>
        </n-radio-group>
        <n-input-number
          v-if="input.type === 'number'"
          size="tiny"
          class="input-default"
          :value="input.defaultValue as number"
          @update:value="(v: number | null) => v !== null && update(input.id, { defaultValue: v })"
        />
        <n-switch
          v-else
          size="small"
          class="input-default"
          :value="Boolean(input.defaultValue)"
          @update:value="(v: boolean) => update(input.id, { defaultValue: v })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 输入变量列表：添加/重命名/改类型/改默认值/删除。
 * 数据直接读写 store 草稿（由 MicroInteractionEditor 统一持有）。
 */
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NInputNumber, NRadioButton, NRadioGroup, NSwitch, useMessage } from 'naive-ui'
import type { IMicroInteractionInput } from '@/core/types'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const message = useMessage()
const store = useMicroInteractionStore()

defineProps<{
  inputs: IMicroInteractionInput[]
  selectedInputId: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()

const _add = () => {
  store.addInput(
    t('dialogs.microInteraction.defaultInputName', { n: (store.draft?.inputs.length ?? 0) + 1 }),
    'boolean',
    'hover',
  )
}
const handleAdd = createDebouncedHandler(_add, 'InputList.add')

function select(id: string) {
  emit('select', id)
}

function update(id: string, patch: Partial<IMicroInteractionInput>) {
  store.updateInput(id, patch)
}

function onTypeChange(id: string, type: string) {
  const input = store.draft?.inputs.find((i) => i.id === id)
  if (!input) return
  // hover 来源只允许布尔类型（进入/离开两态）
  const nextType = (input.source === 'hover' ? 'boolean' : type) as IMicroInteractionInput['type']
  update(id, {
    type: nextType,
    defaultValue: nextType === 'number' ? 0 : false,
  })
}

/** 切换来源时联动类型：悬停 → 布尔，点击 → 触发器，自定义 → 保持 */
function onSourceChange(id: string, source: string) {
  const input = store.draft?.inputs.find((i) => i.id === id)
  if (!input) return
  let type = input.type
  if (source === 'hover') type = 'boolean'
  else if (source === 'click' && input.type === 'number') type = 'trigger'
  update(id, {
    source: source as IMicroInteractionInput['source'],
    type,
    defaultValue: type === 'number' ? 0 : false,
  })
}

function remove(id: string) {
  // 检查是否有转换条件引用
  const used = store.draft?.transitions.some((tr) => tr.conditions.some((c) => c.inputId === id))
  if (used) {
    message.warning(t('dialogs.microInteraction.inputInUse'))
    return
  }
  store.removeInput(id)
}
</script>

<style scoped>
.input-list-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
.input-add-btn {
  font-size: 11px;
}
.input-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 3px;
}
.input-item.selected {
  border-color: var(--primary-3);
  background-color: var(--primary-5);
}
.input-item-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.input-row-label {
  flex: 0 0 36px;
  font-size: 11px;
  color: #666;
}
.input-name {
  flex: 1;
  min-width: 60px;
}
.input-source {
  flex: 1;
}
.input-type {
  flex: 1;
}
.input-default {
  flex: 0 0 56px;
}
.input-delete {
  flex: 0 0 auto;
}
</style>
