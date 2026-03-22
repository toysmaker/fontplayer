<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  NButton,
  NFormItem,
  NInput,
  NInputNumber,
  NScrollbar,
  NSelect,
  NSlider,
  useMessage,
} from 'naive-ui'
import * as R from 'ramda'
import { ParameterType } from '@/core/types'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { updateWidthStrokesContrast } from '@/features/advancedEdit/scripts/width_strokes_contrast'
import { updateHeightStrokesContrast } from '@/features/advancedEdit/scripts/height_strokes_contrast'
import { updateWidthComponentsContrast } from '@/features/advancedEdit/scripts/width_components_contrast'
import { updateHeightComponentsContrast } from '@/features/advancedEdit/scripts/height_components_contrast'
import { updateHorizontalComponentsRatio } from '@/features/advancedEdit/scripts/horizontal_components_ratio'
import { updateVerticalComponentsRatio } from '@/features/advancedEdit/scripts/vertical_components_ratio'
import { componentsScriptsArr } from '@/features/advancedEdit/scripts/components_scripts'
import type { ICharacterFileLite } from '@/core/types'

const advancedEdit = useAdvancedEditStore()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const message = useMessage()

const activeType = ref<'global' | 'components'>('global')
const activeTypeOptions = [
  { value: 'global', label: '全局脚本' },
  { value: 'components', label: '部件脚本' },
]

const activeScript = ref('')
const parameters = ref<
  Array<{ name: string; value: number; min: number; max: number; type: ParameterType; options?: any[] }>
>([])

const globalScripts = [
  {
    id: 'width_strokes_contrast',
    name: '笔画宽度对比度',
    parameters: [{ name: '对比度', value: 1.5, min: 0.1, max: 2, type: ParameterType.Number }],
  },
  {
    id: 'height_strokes_contrast',
    name: '笔画高度对比度',
    parameters: [{ name: '对比度', value: 1.5, min: 0.1, max: 2, type: ParameterType.Number }],
  },
  {
    id: 'width_components_contrast',
    name: '部件宽度对比度',
    parameters: [{ name: '对比度', value: 1.5, min: 0.1, max: 2, type: ParameterType.Number }],
  },
  {
    id: 'height_components_contrast',
    name: '部件高度对比度',
    parameters: [{ name: '对比度', value: 1.5, min: 0.1, max: 2, type: ParameterType.Number }],
  },
  {
    id: 'horizontal_components_ratio',
    name: '横向部件占地步比',
    parameters: [{ name: '对比度', value: 1.5, min: 0.1, max: 2, type: ParameterType.Number }],
  },
  {
    id: 'vertical_components_ratio',
    name: '纵向部件占地步比',
    parameters: [{ name: '对比度', value: 1.5, min: 0.1, max: 2, type: ParameterType.Number }],
  },
]

onMounted(() => {
  void advancedEdit.updatePreviewList()
})

function handleToggleEditSample() {
  advancedEdit.isEditingSample = !advancedEdit.isEditingSample
  if (!advancedEdit.isEditingSample) {
    void advancedEdit.updatePreviewList()
    advancedEdit.originSampleCharactersList = R.clone(advancedEdit.sampleCharactersList)
  }
}

function needsDecomposition(scriptId: string) {
  return (
    scriptId === 'width_strokes_contrast' ||
    scriptId === 'height_strokes_contrast' ||
    scriptId === 'width_components_contrast' ||
    scriptId === 'height_components_contrast' ||
    scriptId === 'horizontal_components_ratio' ||
    scriptId === 'vertical_components_ratio'
  )
}

function guardDecomposition(): boolean {
  const ch = advancedEdit.sampleCharactersList[0]
  if (!ch?.decomposition || !ch?.matches) {
    message.warning('当前样例字符缺少 decomposition / matches，无法运行该脚本（部分旧工程才有此数据）')
    return false
  }
  return true
}

function updateScript() {
  if (needsDecomposition(activeScript.value) && !guardDecomposition()) return

  const origin = advancedEdit.originSampleCharactersList
  const current = advancedEdit.sampleCharactersList
  const params = parameters.value

  if (activeScript.value === 'width_strokes_contrast') {
    updateWidthStrokesContrast(origin, current, params)
  } else if (activeScript.value === 'height_strokes_contrast') {
    updateHeightStrokesContrast(origin, current, params)
  } else if (activeScript.value === 'width_components_contrast') {
    updateWidthComponentsContrast(origin, current, params)
  } else if (activeScript.value === 'height_components_contrast') {
    updateHeightComponentsContrast(origin, current, params)
  } else if (activeScript.value === 'horizontal_components_ratio') {
    updateHorizontalComponentsRatio(origin, current, params)
  } else if (activeScript.value === 'vertical_components_ratio') {
    updateVerticalComponentsRatio(origin, current, params)
  }

  if (activeType.value === 'components' && activeScript.value) {
    componentsScriptsArr
      .find((s) => s.id === activeScript.value)
      ?.update(origin, current, params)
  }

  advancedEdit.updateCharactersAndPreview()
}

function handleChangeParameter(parameter: (typeof parameters.value)[0], value: number, setValue = false) {
  if (setValue) parameter.value = value
  updateScript()
}

function handleSelectScript(script: { id: string; parameters: typeof parameters.value }) {
  activeScript.value = script.id
  parameters.value = R.clone(script.parameters)
  updateScript()
}

function backToScriptSelection() {
  activeScript.value = ''
  parameters.value = []
}

async function applyScriptToEntireProject() {
  const file = projectStore.selectedFile
  if (!file || !activeScript.value) {
    message.warning('请先选择脚本')
    return
  }
  if (needsDecomposition(activeScript.value)) {
    const first = await characterDataManager.loadCharacter(file.uuid, file.characterList[0]?.uuid)
    if (!first?.decomposition || !first?.matches) {
      message.warning('工程字符缺少 decomposition / matches，无法批量运行该脚本')
      return
    }
  }

  const origins: ICharacterFileLite[] = []
  const currents: ICharacterFileLite[] = []
  for (const meta of file.characterList) {
    const o = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
    if (!o) continue
    origins.push(R.clone(o))
    currents.push(R.clone(o))
  }

  const params = parameters.value
  if (activeScript.value === 'width_strokes_contrast') {
    updateWidthStrokesContrast(origins, currents, params)
  } else if (activeScript.value === 'height_strokes_contrast') {
    updateHeightStrokesContrast(origins, currents, params)
  } else if (activeScript.value === 'width_components_contrast') {
    updateWidthComponentsContrast(origins, currents, params)
  } else if (activeScript.value === 'height_components_contrast') {
    updateHeightComponentsContrast(origins, currents, params)
  } else if (activeScript.value === 'horizontal_components_ratio') {
    updateHorizontalComponentsRatio(origins, currents, params)
  } else if (activeScript.value === 'vertical_components_ratio') {
    updateVerticalComponentsRatio(origins, currents, params)
  } else if (activeType.value === 'components') {
    componentsScriptsArr.find((s) => s.id === activeScript.value)?.update(origins, currents, params)
  }

  for (const ch of currents) {
    await characterDataManager.updateCharacter(file.uuid, ch)
  }
  projectStore.markFileUnsaved(file.uuid)
  await characterStore.invalidateAllCachedCharacterPreviews()
  message.success('已写回全部字符')
}
</script>

<template>
  <div class="wrap">
    <div class="scripts-panel">
      <div class="left">
        <div class="sample-characters-section">
          <h3>样例字符</h3>
          <n-input
            v-model:value="advancedEdit.sampleCharacters"
            type="textarea"
            :rows="4"
            :disabled="!advancedEdit.isEditingSample"
            placeholder="请输入最多20个字符，每个字符不能重复"
            :maxlength="20"
            show-count
          />
          <n-button
            block
            :type="advancedEdit.isEditingSample ? 'success' : 'primary'"
            style="margin: 12px 0"
            @click="handleToggleEditSample"
          >
            {{ advancedEdit.isEditingSample ? '确认' : '编辑预览样例字符' }}
          </n-button>
        </div>
        <div class="update-section">
          <n-button type="error" size="large" block @click="applyScriptToEntireProject">
            一键更新全部字库
          </n-button>
        </div>
      </div>
      <div class="main">
        <div class="characters" id="advanced-edit-characters-list">
          <div
            v-for="ch in advancedEdit.sampleCharactersList"
            :key="ch.uuid"
            class="character-preview char-preview"
          >
            <span class="char-label">{{ ch.character.text }}</span>
            <canvas
              :id="`advanced-edit-preview-canvas-${ch.uuid}`"
              width="100"
              height="100"
            />
          </div>
        </div>
      </div>
      <div class="right">
        <div class="type-select">
          <n-select v-model:value="activeType" :options="activeTypeOptions" />
        </div>
        <n-scrollbar style="flex: 1; max-height: calc(100% - 52px)">
          <div v-if="activeType === 'global' && !activeScript" class="global-scripts-list">
            <div v-for="script in globalScripts" :key="script.id" class="script-item">
              <n-button block type="primary" @click="handleSelectScript(script)">{{ script.name }}</n-button>
            </div>
          </div>
          <div v-if="activeType === 'components' && !activeScript" class="components-scripts-list">
            <div v-for="script in componentsScriptsArr" :key="script.id" class="script-item">
              <n-button block type="primary" @click="handleSelectScript(script)">{{ script.name }}</n-button>
            </div>
          </div>
          <div v-if="activeScript" class="parameters-wrap">
            <n-form-item
              v-for="parameter in parameters"
              :key="parameter.name"
              :label="parameter.name"
              label-placement="left"
              label-width="80"
            >
              <div v-if="parameter.type === ParameterType.Number" class="param-wrapper">
                <n-input-number
                  v-model:value="parameter.value"
                  :step="parameter.max <= 10 ? 0.01 : 1"
                  :min="parameter.min"
                  :max="parameter.max"
                  :precision="parameter.max <= 10 ? 2 : 0"
                  style="width: 100%"
                  @update:value="(v) => handleChangeParameter(parameter, v as number, true)"
                />
                <n-slider
                  v-model:value="parameter.value"
                  :step="parameter.max <= 10 ? 0.01 : 1"
                  :min="parameter.min"
                  :max="parameter.max"
                  @update:value="(v) => handleChangeParameter(parameter, v as number, false)"
                />
              </div>
              <div v-else-if="parameter.type === ParameterType.Enum" class="param-wrapper">
                <n-select
                  v-model:value="parameter.value"
                  :options="parameter.options || []"
                  @update:value="() => updateScript()"
                />
              </div>
            </n-form-item>
            <n-button type="primary" block style="margin-top: 12px" @click="backToScriptSelection">
              返回脚本选择
            </n-button>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--dark-3);
}
.scripts-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}
.left {
  border-right: 1px solid var(--light-5);
  flex: 0 0 300px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  box-sizing: border-box;
}
.sample-characters-section h3 {
  margin: 0 0 12px 0;
  color: var(--light-0);
}
.update-section {
  margin-top: auto;
}
.main {
  flex: auto;
  overflow: auto;
}
.character-preview {
  display: inline-block;
  margin: 10px;
  width: 100px;
  text-align: center;
}
.char-label {
  font-size: 12px;
  color: var(--primary-0);
}
.right {
  flex: 0 0 260px;
  border-left: 1px solid var(--light-5);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.type-select {
  padding: 10px;
}
.script-item {
  padding: 0 10px 10px;
}
.parameters-wrap {
  padding: 10px;
}
.param-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
</style>
