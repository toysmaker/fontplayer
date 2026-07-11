<script setup lang="ts">
/**
 * Character Params Panel — 字符自身参数编辑
 * 当 editStatus=Edit 且 toolbar tool='params' 时显示
 */

import { computed } from 'vue'
import { NForm, NFormItem, NInputNumber, NSelect, NSlider, NDivider } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import { ParameterType, type IParameter } from '@/core/types'
import { executeCharacterScript, executeGlyphScript } from '@/core/script/ScriptExecutor'
import { getEditCanvasContext } from '@/features/editor/editCanvas'
import { getGlobalConstantsMap } from '@/core/script/ParametersMap'
import type { ICustomGlyph } from '@/core/types'

const { t } = useI18n()
const characterStore = useCharacterStore()
const projectStore = useProjectStore()

const editingCharacter = computed(() => characterStore.editingCharacter)
const params = computed<IParameter[]>(() => editingCharacter.value?.parameters || [])

/** 解析常量参数的值（用于 Select 的 options） */
function getConstantOptions(param: IParameter): Array<{ label: string; value: number }> {
  if (param.type !== ParameterType.Constant) return []
  const constantsMap = getGlobalConstantsMap() || projectStore.constantsMap
  if (!constantsMap) return []
  const value = constantsMap.getByUUID(param.value as string)
  return [{ label: String(value ?? param.value), value: Number(value ?? param.value) }]
}

function getParamStep(param: IParameter): number {
  const min = Number(param.min ?? 0)
  const max = Number(param.max === 0 ? 0 : (param.max ?? 1000))
  return (max - min) <= 3 ? 0.05 : 1
}

function handleParamChange(param: IParameter, newValue: number | null | undefined) {
  if (newValue === null || newValue === undefined) return
  param.value = newValue
  rerenderAndExecute()
}

/** 重新执行字符脚本并刷新画布 */
function rerenderAndExecute() {
  const ch = editingCharacter.value
  if (!ch) return
  if (ch.script) {
    executeCharacterScript(ch, ch.uuid)
    // executeCharacterScript 内部已对子 glyph 调用 executeGlyphScript({ ignoreTempDataGuard: true })
    // 此处无需重复调用
  }
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

const hasParams = computed(() => params.value.length > 0)
</script>

<template>
  <div class="character-params-panel">
    <div class="section-title">{{ t('panels.paramsPanel.characterParams.title') }}</div>
    <n-form v-if="hasParams" label-placement="left" size="small">
      <n-form-item
        v-for="param in params"
        :key="param.uuid || param.name"
        :label="param.name"
      >
        <!-- Number -->
        <div v-if="param.type === ParameterType.Number" style="width: 100%;">
          <n-input-number
            :value="Number(param.value)"
            :min="Number(param.min ?? 0)"
            :max="Number(param.max === 0 ? 0 : (param.max ?? 1000))"
            :step="getParamStep(param)"
            @update:value="(v: number | null) => handleParamChange(param, v)"
          />
          <n-slider
            style="margin-top: 6px;"
            :value="Number(param.value)"
            :min="Number(param.min ?? 0)"
            :max="Number(param.max === 0 ? 0 : (param.max ?? 1000))"
            :step="getParamStep(param)"
            @update:value="(v: number) => handleParamChange(param, v)"
          />
        </div>
        <!-- Enum -->
        <div v-else-if="param.type === ParameterType.Enum" style="width: 100%;">
          <n-select
            :value="Number(param.value)"
            :options="param.options || []"
            @update:value="(v: number) => handleParamChange(param, v)"
          />
        </div>
        <!-- Constant -->
        <div v-else-if="param.type === ParameterType.Constant" style="width: 100%;">
          <n-select
            :value="Number(param.value)"
            :options="getConstantOptions(param)"
            disabled
          />
        </div>
      </n-form-item>
    </n-form>
    <div v-else class="character-params-empty">
      {{ t('panels.paramsPanel.characterParams.noParams') }}
    </div>
  </div>
</template>

<style scoped>
.character-params-panel {
  padding: 8px 12px;
}
.section-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}
.character-params-empty {
  padding: 24px 12px;
  color: #999;
  text-align: center;
  font-size: 13px;
}
</style>
