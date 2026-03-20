<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NTabs,
  NTabPane,
  NScrollbar,
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NForm,
  NFormItem,
  NCollapse,
  NCollapseItem,
  NIcon,
  useDialog,
} from 'naive-ui'
import type { IConstant, IParameter, IRingParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { isTauri } from '@/utils/env'
import { emit, listen } from '@tauri-apps/api/event'
import { basicSetup, EditorView } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager'
import { defaultGlyphScriptTemplate } from '@/features/programming/glyphProgrammingUtils'

const { t } = useI18n()
const dialog = useDialog()

const constants = ref<IConstant[]>([])
const parameters = ref<IParameter[]>([])
const script = ref('')
const editMap = ref<Record<string, boolean>>({})
const activeTab = ref('global-constants')

let codeEditor: EditorView | null = null
let unlistenInit: (() => void) | null = null
let unlistenClose: (() => void) | null = null

const parameterOptions = [
  { value: ParameterType.Constant, key: 'constant' },
  { value: ParameterType.Number, key: 'number' },
  { value: ParameterType.RingController, key: 'ring' },
  { value: ParameterType.Enum, key: 'enum' },
]

const constantsOptions = [
  { value: ParameterType.Number, key: 'number' },
  { value: ParameterType.RingController, key: 'ring' },
  { value: ParameterType.Enum, key: 'enum' },
]

type ProgrammingTypeKey = 'constant' | 'number' | 'ring' | 'enum'
function optLabel(key: ProgrammingTypeKey) {
  return t(`programming.${key}`)
}

const constantsSelectOpts = computed(() =>
  constantsOptions.map((item) => ({ label: optLabel(item.key as ProgrammingTypeKey), value: item.value })),
)
const parameterSelectOpts = computed(() =>
  parameterOptions.map((item) => ({ label: optLabel(item.key as ProgrammingTypeKey), value: item.value })),
)

function teardownEditor() {
  if (codeEditor) {
    codeEditor.destroy()
    codeEditor = null
  }
  const el = document.getElementById('codes-container')
  if (el) el.innerHTML = ''
}

function mountEditor() {
  teardownEditor()
  const parent = document.getElementById('codes-container')
  if (!parent) return
  codeEditor = new EditorView({
    doc: script.value,
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      EditorView.updateListener.of((v) => {
        script.value = v.state.doc.toString()
      }),
    ],
    parent,
  })
  const isMac = navigator.userAgent.includes('Mac')
  codeEditor.dom.addEventListener('keydown', async (event) => {
    if (!codeEditor) return
    if ((isMac ? event.metaKey : event.ctrlKey) && event.key === 'c') {
      const { from, to } = codeEditor.state.selection.main
      const selectedText = codeEditor.state.doc.slice(from, to).toString()
      if (selectedText && isTauri()) {
        await writeText(selectedText)
      }
      if (isTauri()) event.preventDefault()
    }
    if ((isMac ? event.metaKey : event.ctrlKey) && event.key === 'v') {
      if (isTauri()) {
        const clipboardText = await readText()
        if (clipboardText && codeEditor) {
          const { from } = codeEditor.state.selection.main
          codeEditor.dispatch({
            changes: { from, insert: clipboardText },
          })
        }
        event.preventDefault()
      }
    }
  })
}

function applyInitPayload(payload: {
  __constants: IConstant[]
  __parameters: IParameter[]
  __script: string
  __uuid: string
}) {
  window.__uuid = payload.__uuid
  window.__constants = payload.__constants
  window.__parameters = payload.__parameters
  window.__script = payload.__script
  constants.value = payload.__constants
  parameters.value = payload.__parameters
  script.value = payload.__script ?? ''
  constants.value.forEach((c) => {
    editMap.value[c.uuid] = false
  })
  parameters.value.forEach((p) => {
    editMap.value[p.uuid] = false
  })
  mountEditor()
}

onMounted(async () => {
  if (isTauri()) {
    unlistenClose = await getCurrentWindow().onCloseRequested(() => {
      teardownEditor()
      void emit('on-webview-close')
      unlistenInit?.()
      unlistenInit = null
    })
    unlistenInit = await listen('init-data', (event) => {
      const p = event.payload as {
        __constants: IConstant[]
        __parameters: IParameter[]
        __script: string
        __uuid: string
      }
      applyInitPayload(p)
    })
    await emit('on-webview-mounted')
  } else {
    const onBeforeUnload = () => {
      window.opener?.postMessage('close-window', location.origin)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    const op = window.opener as Window & typeof window
    constants.value = op.__constants ? [...op.__constants] : []
    parameters.value = op.__parameters ? [...op.__parameters] : []
    script.value = op.__script ?? ''
    window.__uuid = op.__uuid
    window.__constants = constants.value
    window.__parameters = parameters.value
    window.__script = script.value
    constants.value.forEach((c) => {
      editMap.value[c.uuid] = false
    })
    parameters.value.forEach((p) => {
      editMap.value[p.uuid] = false
    })
    mountEditor()
  }
})

onUnmounted(() => {
  teardownEditor()
  unlistenInit?.()
  unlistenClose?.()
  unlistenClose = null
})

watch([constants, parameters, script], syncInfo, { deep: true })

async function syncInfo() {
  if (isTauri()) {
    await emit('sync-info', {
      __constants: constants.value,
      __parameters: parameters.value,
      __script: script.value,
    })
  } else {
    localStorage.setItem('constants', JSON.stringify(constants.value))
    localStorage.setItem('parameters', JSON.stringify(parameters.value))
    localStorage.setItem('script', script.value)
    window.opener?.postMessage('sync-info', location.origin)
  }
}

async function runExecute() {
  if (isTauri()) {
    await emit('execute-script')
  } else {
    window.opener?.postMessage('execute-script', location.origin)
  }
}

function toggleEdit(uuid: string, value: boolean) {
  editMap.value[uuid] = value
}

function addConstant() {
  const uuid = genUUID()
  constants.value.push({
    uuid,
    name: uuid.slice(0, 5),
    value: 0,
    type: ParameterType.Number,
    min: 0,
    max: 1000,
  })
}

function addParameter() {
  const uuid = genUUID()
  parameters.value.push({
    uuid,
    name: uuid.slice(0, 5).replaceAll('-', '_'),
    type: ParameterType.Number,
    value: 0,
    min: 0,
    max: 1000,
  })
}

function removeConstant(uuid: string) {
  const i = constants.value.findIndex((c) => c.uuid === uuid)
  if (i !== -1) constants.value.splice(i, 1)
}

function removeParameter(uuid: string) {
  const i = parameters.value.findIndex((p) => p.uuid === uuid)
  if (i !== -1) parameters.value.splice(i, 1)
}

function sortDownParameter(uuid: string) {
  const i = parameters.value.findIndex((p) => p.uuid === uuid)
  if (i !== -1 && i < parameters.value.length - 1) {
    const [item] = parameters.value.splice(i, 1)
    parameters.value.splice(i + 1, 0, item)
  }
}

function sortUpParameter(uuid: string) {
  const i = parameters.value.findIndex((p) => p.uuid === uuid)
  if (i > 0) {
    const [item] = parameters.value.splice(i, 1)
    parameters.value.splice(i - 1, 0, item)
  }
}

function sortDownConstant(uuid: string) {
  const i = constants.value.findIndex((c) => c.uuid === uuid)
  if (i !== -1 && i < constants.value.length - 1) {
    const [item] = constants.value.splice(i, 1)
    constants.value.splice(i + 1, 0, item)
  }
}

function sortUpConstant(uuid: string) {
  const i = constants.value.findIndex((c) => c.uuid === uuid)
  if (i > 0) {
    const [item] = constants.value.splice(i, 1)
    constants.value.splice(i - 1, 0, item)
  }
}

function addParam(ring: IRingParameter) {
  ring.params.push({ name: '', min: 0, max: 1000, value: 500 })
}

function onParamTypeChange(param: IConstant | IParameter) {
  if (param.type === ParameterType.Number) {
    param.value = 0
  } else if (param.type === ParameterType.Constant) {
    param.value = '' as unknown as number
  } else if (param.type === ParameterType.RingController) {
    param.value = {
      radius: { name: '', min: 0, max: 1000, value: 500 },
      degree: { name: '', min: 0, max: 360, value: 60 },
      params: [],
    } as unknown as IParameter['value']
  } else if (param.type === ParameterType.Enum) {
    if (!param.options) param.options = []
    param.value = 0
  }
}

function addOption(param: IConstant | IParameter) {
  if (!param.options) param.options = []
  param.options.push({ label: '', value: 0 })
}

function removeOption(param: IConstant | IParameter, option: { value: number }) {
  if (!param.options) return
  const idx = param.options.findIndex((item) => item.value === option.value)
  if (idx !== -1) param.options.splice(idx, 1)
}

function resetScript() {
  dialog.warning({
    title: t('programming.resetScriptTitle'),
    content: t('programming.resetScriptConfirm'),
    positiveText: t('dialogs.tipsDialog.confirm'),
    negativeText: t('dialogs.tipsDialog.cancel'),
    onPositiveClick: () => {
      const uuid = window.__uuid || ''
      script.value = defaultGlyphScriptTemplate(uuid)
      if (codeEditor) {
        codeEditor.dispatch({
          changes: { from: 0, to: codeEditor.state.doc.length, insert: script.value },
        })
      }
    },
  })
}

</script>

<template>
  <div class="glyph-programming-editor">
    <div class="left-panel">
      <n-tabs v-model:value="activeTab" class="prog-tabs" type="line">
        <n-tab-pane :name="'global-constants'" :tab="t('programming.global-constants')">
          <n-scrollbar class="prog-scrollbar">
            <n-form label-placement="left" :show-feedback="false" size="small" class="prog-left-form">
            <n-button class="add-constant-button" block @pointerdown="addConstant">
              {{ t('programming.new-constant') }}
            </n-button>
            <div v-for="parameter in constants" :key="parameter.uuid" class="constant-item">
              <div class="parameter-name">
                <span v-show="!editMap[parameter.uuid]" class="parameter-name-label">{{ parameter.name }}</span>
                <n-input
                  v-show="editMap[parameter.uuid]"
                  v-model:value="parameter.name"
                  class="parameter-name-input"
                  @keyup.enter="toggleEdit(parameter.uuid, false)"
                />
                <n-icon
                  v-show="!editMap[parameter.uuid]"
                  class="edit-icon"
                  @pointerdown="toggleEdit(parameter.uuid, true)"
                >
                  <font-awesome-icon icon="fa-solid fa-pen-to-square" />
                </n-icon>
              </div>
              <n-select
                v-model:value="parameter.type"
                class="parameter-type-select"
                :placeholder="t('programming.type')"
                :options="constantsSelectOpts"
                @update:value="() => onParamTypeChange(parameter)"
              />
              <div v-if="parameter.type === ParameterType.Number" class="parameter-number-block">
                <n-input-number v-model:value="parameter.value" class="parameter-value" :precision="2" />
                <n-form-item label="min" label-width="42" class="prog-form-item">
                  <n-input-number v-model:value="parameter.min" class="parameter-value" :precision="2" />
                </n-form-item>
                <n-form-item label="max" label-width="42" class="prog-form-item">
                  <n-input-number v-model:value="parameter.max" class="parameter-value" :precision="2" />
                </n-form-item>
              </div>
              <div v-else-if="parameter.type === ParameterType.Enum" class="enum-wrap">
                <n-select
                  v-model:value="parameter.value"
                  class="parameter-const-select"
                  :placeholder="t('programming.value')"
                  :options="(parameter.options || []).map((o) => ({ label: o.label, value: o.value }))"
                />
                <div class="options-wrap">
                  <n-button class="add-option-button" block @pointerdown="addOption(parameter)">
                    {{ t('programming.new_enum_option') }}
                  </n-button>
                  <div
                    v-for="option in parameter.options || []"
                    :key="`${parameter.uuid}-${option.value}`"
                    class="option-item"
                  >
                    <n-form-item label="label" label-width="80" class="prog-form-item prog-form-item--label80">
                      <n-input v-model:value="option.label" class="option-name" />
                    </n-form-item>
                    <n-form-item label="value" label-width="80" class="prog-form-item prog-form-item--label80">
                      <n-input-number v-model:value="option.value" class="option-value" :precision="2" />
                    </n-form-item>
                    <n-icon class="option-remove-btn" @pointerdown="removeOption(parameter, option)">
                      <font-awesome-icon icon="fa-solid fa-trash" />
                    </n-icon>
                  </div>
                </div>
              </div>
              <n-select
                v-else-if="parameter.type === ParameterType.Constant"
                v-model:value="parameter.value"
                class="parameter-const-select"
                :placeholder="t('programming.value')"
                :options="constants.map((item) => ({ label: item.name, value: item.uuid }))"
              />
              <div v-else-if="parameter.type === ParameterType.RingController" class="ring-wrap">
                <n-tabs type="card" size="small" class="ring-inner-tabs">
                  <n-tab-pane :name="parameter.uuid + '-ra'" tab="radius">
                    <n-form-item label="name" label-width="42" class="prog-form-item">
                      <n-input v-model:value="(parameter.value as unknown as IRingParameter).radius.name" class="parameter-value" />
                    </n-form-item>
                    <n-form-item label="value" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).radius.value"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="min" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).radius.min"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="max" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).radius.max"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                  </n-tab-pane>
                  <n-tab-pane :name="parameter.uuid + '-de'" tab="degree">
                    <n-form-item label="name" label-width="42" class="prog-form-item">
                      <n-input v-model:value="(parameter.value as unknown as IRingParameter).degree.name" class="parameter-value" />
                    </n-form-item>
                    <n-form-item label="value" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).degree.value"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="min" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).degree.min"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="max" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).degree.max"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                  </n-tab-pane>
                  <n-tab-pane :name="parameter.uuid + '-pa'" tab="params">
                    <n-button class="add-parameter-button" block @pointerdown="addParam(parameter.value as unknown as IRingParameter)">
                      {{ t('programming.new-parameter') }}
                    </n-button>
                    <n-collapse>
                      <n-collapse-item
                        v-for="(param, idx) in (parameter.value as unknown as IRingParameter).params"
                        :key="idx"
                        :title="param.name || 'param'"
                        :name="String(idx)"
                      >
                        <n-form-item label="name" label-width="42" class="prog-form-item">
                          <n-input v-model:value="param.name" class="parameter-value" />
                        </n-form-item>
                        <n-form-item label="value" label-width="42" class="prog-form-item">
                          <n-input-number v-model:value="param.value" class="parameter-value" :precision="2" />
                        </n-form-item>
                        <n-form-item label="min" label-width="42" class="prog-form-item">
                          <n-input-number v-model:value="param.min" class="parameter-value" :precision="2" />
                        </n-form-item>
                        <n-form-item label="max" label-width="42" class="prog-form-item">
                          <n-input-number v-model:value="param.max" class="parameter-value" :precision="2" />
                        </n-form-item>
                      </n-collapse-item>
                    </n-collapse>
                  </n-tab-pane>
                </n-tabs>
              </div>
              <n-icon class="sort-down-btn" @pointerdown="sortDownConstant(parameter.uuid)">
                <font-awesome-icon icon="fa-solid fa-arrow-down" />
              </n-icon>
              <n-icon class="sort-up-btn" @pointerdown="sortUpConstant(parameter.uuid)">
                <font-awesome-icon icon="fa-solid fa-arrow-up" />
              </n-icon>
              <n-icon class="remove-btn" @pointerdown="removeConstant(parameter.uuid)">
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </n-icon>
            </div>
            </n-form>
          </n-scrollbar>
        </n-tab-pane>
        <n-tab-pane :name="'glyph-parameters'" :tab="t('programming.glyph-parameters')">
          <n-scrollbar class="prog-scrollbar">
            <n-form label-placement="left" :show-feedback="false" size="small" class="prog-left-form">
            <n-button class="add-parameter-button" block @pointerdown="addParameter">
              {{ t('programming.new-parameter') }}
            </n-button>
            <div v-for="parameter in parameters" :key="parameter.uuid" class="parameter-item">
              <div class="parameter-name">
                <span v-show="!editMap[parameter.uuid]" class="parameter-name-label">{{ parameter.name }}</span>
                <n-input
                  v-show="editMap[parameter.uuid]"
                  v-model:value="parameter.name"
                  class="parameter-name-input"
                  @keyup.enter="toggleEdit(parameter.uuid, false)"
                />
                <n-icon
                  v-show="!editMap[parameter.uuid]"
                  class="edit-icon"
                  @pointerdown="toggleEdit(parameter.uuid, true)"
                >
                  <font-awesome-icon icon="fa-solid fa-pen-to-square" />
                </n-icon>
              </div>
              <n-select
                v-model:value="parameter.type"
                class="parameter-type-select"
                :placeholder="t('programming.type')"
                :options="parameterSelectOpts"
                @update:value="() => onParamTypeChange(parameter)"
              />
              <div v-if="parameter.type === ParameterType.Number" class="parameter-number-block">
                <n-input-number v-model:value="parameter.value as unknown as number" class="parameter-value" :precision="2" />
                <n-form-item label="min" label-width="42" class="prog-form-item">
                  <n-input-number v-model:value="parameter.min as unknown as number" class="parameter-value" :precision="2" />
                </n-form-item>
                <n-form-item label="max" label-width="42" class="prog-form-item">
                  <n-input-number v-model:value="parameter.max as unknown as number" class="parameter-value" :precision="2" />
                </n-form-item>
              </div>
              <div v-else-if="parameter.type === ParameterType.Enum" class="enum-wrap">
                <n-select
                  v-model:value="parameter.value"
                  class="parameter-const-select"
                  :placeholder="t('programming.value')"
                  :options="(parameter.options || []).map((o) => ({ label: o.label, value: o.value }))"
                />
                <div class="options-wrap">
                  <n-button class="add-option-button" block @pointerdown="addOption(parameter)">
                    {{ t('programming.new_enum_option') }}
                  </n-button>
                  <div
                    v-for="option in parameter.options || []"
                    :key="`${parameter.uuid}-${option.value}`"
                    class="option-item"
                  >
                    <n-form-item label="label" label-width="80" class="prog-form-item prog-form-item--label80">
                      <n-input v-model:value="option.label" class="option-name" />
                    </n-form-item>
                    <n-form-item label="value" label-width="80" class="prog-form-item prog-form-item--label80">
                      <n-input-number v-model:value="option.value" class="option-value" :precision="2" />
                    </n-form-item>
                    <n-icon class="option-remove-btn" @pointerdown="removeOption(parameter, option)">
                      <font-awesome-icon icon="fa-solid fa-trash" />
                    </n-icon>
                  </div>
                </div>
              </div>
              <n-select
                v-else-if="parameter.type === ParameterType.Constant"
                v-model:value="parameter.value"
                class="parameter-const-select"
                :placeholder="t('programming.value')"
                :options="constants.map((item) => ({ label: item.name, value: item.uuid }))"
              />
              <div v-else-if="parameter.type === ParameterType.RingController" class="ring-wrap">
                <n-tabs type="card" size="small" class="ring-inner-tabs">
                  <n-tab-pane :name="parameter.uuid + '-pra'" tab="radius">
                    <n-form-item label="name" label-width="42" class="prog-form-item">
                      <n-input v-model:value="(parameter.value as unknown as IRingParameter).radius.name" class="parameter-value" />
                    </n-form-item>
                    <n-form-item label="value" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).radius.value"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="min" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).radius.min"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="max" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).radius.max"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                  </n-tab-pane>
                  <n-tab-pane :name="parameter.uuid + '-pde'" tab="degree">
                    <n-form-item label="name" label-width="42" class="prog-form-item">
                      <n-input v-model:value="(parameter.value as unknown as IRingParameter).degree.name" class="parameter-value" />
                    </n-form-item>
                    <n-form-item label="value" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).degree.value"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="min" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).degree.min"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                    <n-form-item label="max" label-width="42" class="prog-form-item">
                      <n-input-number
                        v-model:value="(parameter.value as unknown as IRingParameter).degree.max"
                        class="parameter-value"
                        :precision="2"
                      />
                    </n-form-item>
                  </n-tab-pane>
                  <n-tab-pane :name="parameter.uuid + '-ppa'" tab="params">
                    <n-button class="add-parameter-button" block @pointerdown="addParam(parameter.value as unknown as IRingParameter)">
                      {{ t('programming.new-parameter') }}
                    </n-button>
                    <n-collapse>
                      <n-collapse-item
                        v-for="(param, idx) in (parameter.value as unknown as IRingParameter).params"
                        :key="idx"
                        :title="param.name || 'param'"
                        :name="'gp' + idx"
                      >
                        <n-form-item label="name" label-width="42" class="prog-form-item">
                          <n-input v-model:value="param.name" class="parameter-value" />
                        </n-form-item>
                        <n-form-item label="value" label-width="42" class="prog-form-item">
                          <n-input-number v-model:value="param.value" class="parameter-value" :precision="2" />
                        </n-form-item>
                        <n-form-item label="min" label-width="42" class="prog-form-item">
                          <n-input-number v-model:value="param.min" class="parameter-value" :precision="2" />
                        </n-form-item>
                        <n-form-item label="max" label-width="42" class="prog-form-item">
                          <n-input-number v-model:value="param.max" class="parameter-value" :precision="2" />
                        </n-form-item>
                      </n-collapse-item>
                    </n-collapse>
                  </n-tab-pane>
                </n-tabs>
              </div>
              <n-icon class="sort-down-btn" @pointerdown="sortDownParameter(parameter.uuid)">
                <font-awesome-icon icon="fa-solid fa-arrow-down" />
              </n-icon>
              <n-icon class="sort-up-btn" @pointerdown="sortUpParameter(parameter.uuid)">
                <font-awesome-icon icon="fa-solid fa-arrow-up" />
              </n-icon>
              <n-icon class="remove-btn" @pointerdown="removeParameter(parameter.uuid)">
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </n-icon>
            </div>
            </n-form>
          </n-scrollbar>
        </n-tab-pane>
      </n-tabs>
    </div>
    <div class="right-panel">
      <div class="codes-header">
        <div class="codes-title">{{ t('programming.script') }}</div>
        <n-button class="reset-btn" @pointerdown="resetScript">
          {{ t('programming.reset') }}
        </n-button>
        <n-button type="primary" class="execute-btn" @pointerdown="runExecute">
          {{ t('programming.execute') }}
        </n-button>
      </div>
      <div id="codes-container" />
    </div>
  </div>
</template>

<style scoped>
.glyph-programming-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}
.right-panel {
  flex: 0 0 980px;
  width: 980px;
  display: flex;
  flex-direction: column;
}
.right-panel .codes-header {
  background-color: white;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 5px;
  flex-shrink: 0;
}
.right-panel .codes-header .codes-title {
  margin-right: auto;
  font-weight: bold;
}
.right-panel #codes-container {
  flex: 1;
  min-height: 0;
  pointer-events: auto;
  z-index: 10;
  background-color: #282c34;
  overflow: auto;
  width: 100%;
}
</style>

<style src="./programmingEditorShared.css"></style>
