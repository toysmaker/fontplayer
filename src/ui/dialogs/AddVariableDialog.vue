<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NModal,
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NForm,
  NFormItem,
  NDivider,
  useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { genUUID } from '@/utils/uuid'
import type { IVariable, IKeyframe } from '@/core/types'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const message = useMessage()

const props = defineProps<{
  visible: boolean
  layerNames: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', variable: IVariable): void
}>()

const name = ref('')
const min = ref(0)
const max = ref(100)
const defaultValue = ref(50)
const keyframes = ref<Array<{ uuid: string; value: number; layer: string }>>([])

const layerOptions = computed(() => {
  return props.layerNames.map(n => ({ label: n, value: n }))
})

function addKeyframe() {
  keyframes.value.push({
    uuid: genUUID(),
    value: 0,
    layer: '',
  })
}

function removeKeyframe(index: number) {
  keyframes.value.splice(index, 1)
}

function _handleConfirm() {
  if (!name.value.trim()) {
    message.warning(t('panels.paramsPanel.variablesPanel.addVariable') + ': ' + t('dialogs.addVariableDialog.nameRequired'))
    return
  }
  if (min.value >= max.value) {
    message.warning(t('dialogs.addVariableDialog.minMaxInvalid'))
    return
  }
  if (defaultValue.value < min.value || defaultValue.value > max.value) {
    message.warning(t('dialogs.addVariableDialog.defaultOutOfRange'))
    return
  }
  if (keyframes.value.length < 2) {
    message.warning(t('dialogs.addVariableDialog.atLeastTwoKeyframes'))
    return
  }
  for (const kf of keyframes.value) {
    if (kf.value < min.value || kf.value > max.value) {
      message.warning(t('dialogs.addVariableDialog.keyframeValueOutOfRange'))
      return
    }
    if (!kf.layer) {
      message.warning(t('dialogs.addVariableDialog.keyframeLayerRequired'))
      return
    }
  }
  const values = keyframes.value.map(k => k.value)
  if (new Set(values).size !== values.length) {
    message.warning(t('dialogs.addVariableDialog.duplicateKeyframeValue'))
    return
  }

  const variable: IVariable = {
    uuid: genUUID(),
    name: name.value.trim(),
    min: min.value,
    max: max.value,
    default: defaultValue.value,
    value: defaultValue.value,
    keyframes: keyframes.value.map(k => ({
      uuid: k.uuid,
      value: k.value,
      layer: k.layer,
    })),
  }

  emit('confirm', variable)
  emit('update:visible', false)
  resetForm()
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'AddVariableDialog.confirm')

function _handleCancel() {
  emit('update:visible', false)
  resetForm()
}

const handleCancel = createDebouncedHandler(_handleCancel, 'AddVariableDialog.cancel')

function resetForm() {
  name.value = ''
  min.value = 0
  max.value = 100
  defaultValue.value = 50
  keyframes.value = []
}
</script>

<template>
  <n-modal
    :show="visible"
    :title="t('dialogs.addVariableDialog.title')"
    preset="card"
    style="width: 480px;"
    @update:show="(v: boolean) => !v && handleCancel()"
  >
    <n-form label-placement="left" label-width="80">
      <n-form-item :label="t('dialogs.addVariableDialog.name')">
        <n-input
          v-model:value="name"
          :placeholder="t('dialogs.addVariableDialog.namePlaceholder')"
        />
      </n-form-item>
      <n-form-item :label="t('dialogs.addVariableDialog.min')">
        <n-input-number v-model:value="min" :precision="1" />
      </n-form-item>
      <n-form-item :label="t('dialogs.addVariableDialog.max')">
        <n-input-number v-model:value="max" :precision="1" />
      </n-form-item>
      <n-form-item :label="t('dialogs.addVariableDialog.default')">
        <n-input-number v-model:value="defaultValue" :precision="1" />
      </n-form-item>
    </n-form>

    <n-divider>{{ t('dialogs.addVariableDialog.keyframes') }}</n-divider>

    <div class="keyframe-list">
      <div
        v-for="(kf, index) in keyframes"
        :key="kf.uuid"
        class="keyframe-item"
      >
        <n-form label-placement="top" label-width="80">
          <n-form-item :label="t('dialogs.addVariableDialog.keyframeValue')">
            <n-input-number v-model:value="kf.value" :precision="1" style="width: 100%;" />
          </n-form-item>
          <n-form-item :label="t('dialogs.addVariableDialog.keyframeLayer')">
            <n-select
              v-model:value="kf.layer"
              :options="layerOptions"
              :placeholder="t('dialogs.addVariableDialog.selectLayer')"
              style="width: 100%;"
            />
          </n-form-item>
        </n-form>
        <n-button size="tiny" type="error" quaternary @click="removeKeyframe(index)" style="align-self: flex-end;">
          {{ t('dialogs.addVariableDialog.cancel') }}
        </n-button>
      </div>
    </div>

    <n-button
      size="small"
      dashed
      style="width: 100%; margin-top: 8px;"
      @click="addKeyframe"
    >
      + {{ t('dialogs.addVariableDialog.addKeyframe') }}
    </n-button>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.addVariableDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">{{ t('dialogs.addVariableDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.keyframe-list {
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}
.keyframe-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  background: var(--n-color-embedded);
}
.keyframe-item :deep(.n-form-item) {
  margin-bottom: 0;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
