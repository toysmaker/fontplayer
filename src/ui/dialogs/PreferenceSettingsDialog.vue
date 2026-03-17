<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="tm('dialogs.preferenceDialog.title')"
    class="preference-settings-dialog"
    :style="{ width: '360px' }"
    :mask-closable="false"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="settings-panel">
      <div class="section">
        <div class="section-title">{{ t('panels.settingsPanel.background.background') }}</div>
        <n-form label-placement="left" label-width="80">
          <n-form-item :label="t('panels.settingsPanel.background.style')">
            <n-radio-group v-model:value="backgroundStyle">
              <n-radio value="color">{{ t('panels.settingsPanel.background.color') }}</n-radio>
              <n-color-picker
                v-if="backgroundStyle === 'color'"
                v-model:value="backgroundColor"
                :show-alpha="false"
                style="margin-left: 8px; vertical-align: middle"
              />
              <n-radio value="transparent" style="margin-left: 12px">{{ t('panels.settingsPanel.background.transparent') }}</n-radio>
            </n-radio-group>
          </n-form-item>
        </n-form>
      </div>
      <div class="section">
        <div class="section-title">{{ t('panels.settingsPanel.mesh.mesh') }}</div>
        <n-form label-placement="left" label-width="80">
          <n-form-item :label="t('panels.settingsPanel.mesh.style')">
            <n-radio-group v-model:value="gridStyle">
              <n-radio value="none">{{ t('panels.settingsPanel.mesh.none') }}</n-radio>
              <n-radio value="mesh">{{ t('panels.settingsPanel.mesh.mesh') }}</n-radio>
              <n-radio value="mi">{{ t('panels.settingsPanel.mesh.mi') }}</n-radio>
              <n-radio value="layout">{{ t('panels.settingsPanel.mesh.layout') }}</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="gridStyle === 'mesh'" :label="t('panels.settingsPanel.mesh.precision')">
            <n-input-number v-model:value="gridPrecision" :min="10" :max="50" :precision="0" style="width: 120px" />
          </n-form-item>
        </n-form>
      </div>
      <div class="section">
        <div class="section-title">{{ t('panels.settingsPanel.render.render') }}</div>
        <n-form label-placement="left" label-width="80">
          <n-form-item :label="t('panels.settingsPanel.render.title')">
            <n-radio-group v-model:value="renderStyle">
              <n-radio value="contour">{{ t('panels.settingsPanel.render.contour') }}</n-radio>
              <n-radio value="black">{{ t('panels.settingsPanel.render.black') }}</n-radio>
              <n-radio value="color">{{ t('panels.settingsPanel.render.color') }}</n-radio>
            </n-radio-group>
          </n-form-item>
        </n-form>
      </div>
    </div>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel">{{ t('dialogs.preferenceDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm">{{ t('dialogs.preferenceDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NForm, NFormItem, NRadioGroup, NRadio, NColorPicker, NInputNumber, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useEditorPreferenceStore } from '@/stores/editorPreference'
import { fontRenderStyle } from '@/core/script/globals'
import { BackgroundType, GridType } from '@/core/canvas/types'

const { t, tm } = useI18n()
const preferenceStore = useEditorPreferenceStore()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const backgroundStyle = ref<'color' | 'transparent'>('transparent')
const backgroundColor = ref('#FFFFFF')
const gridStyle = ref<'none' | 'mesh' | 'mi' | 'layout'>('none')
const gridPrecision = ref(20)
const renderStyle = ref<'contour' | 'black' | 'color'>('contour')

watch(
  () => props.show,
  (show) => {
    if (show) {
      backgroundStyle.value = preferenceStore.backgroundType === BackgroundType.Color ? 'color' : 'transparent'
      backgroundColor.value = preferenceStore.backgroundColor
      const gt = preferenceStore.gridType
      gridStyle.value = gt === GridType.None ? 'none' : gt === GridType.Mesh ? 'mesh' : gt === GridType.Mi ? 'mi' : 'layout'
      gridPrecision.value = preferenceStore.gridPrecision
      renderStyle.value = fontRenderStyle.value
    }
  }
)

function handleCancel() {
  visible.value = false
}

function handleConfirm() {
  preferenceStore.setBackgroundType(backgroundStyle.value === 'color' ? BackgroundType.Color : BackgroundType.Transparent)
  preferenceStore.setBackgroundColor(backgroundColor.value)
  preferenceStore.setGridType(
    gridStyle.value === 'none' ? GridType.None : gridStyle.value === 'mesh' ? GridType.Mesh : gridStyle.value === 'mi' ? GridType.Mi : GridType.LayoutGrid
  )
  if (gridStyle.value === 'mesh') {
    preferenceStore.setGridPrecision(gridPrecision.value)
  }
  fontRenderStyle.value = renderStyle.value
  visible.value = false
}
</script>

<style scoped>
.settings-panel {
  padding: 8px 0;
}
.section {
  margin-bottom: 16px;
}
.section-title {
  background: var(--primary-0);
  padding: 6px 10px;
  color: var(--light-2);
  font-size: 13px;
  margin-bottom: 8px;
}
.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
