<script setup lang="ts">
/**
 * 字形组件参数编辑面板
 * 支持字符和字形两种编辑模式
 */

import { ref, computed, watch } from 'vue'
import { NInputNumber, NForm, NFormItem, NInput, NEmpty, NSlider, NSelect, NSwitch, NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useComponentEditor } from '../composables/useComponentEditor'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { EditStatus, ParameterType, IParameter, ICustomGlyph } from '@/core/types'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'

const { t } = useI18n()

const { selectedComponent, selectedComponentUUID, modifyComponent, editStatus } = useComponentEditor()
const editorStore = useEditorStore()
const characterStore = useCharacterStore()
const glyphStore = useGlyphStore()
const projectStore = useProjectStore()

// 获取字形组件的参数数组
const glyphParameters = computed(() => {
  if (!selectedComponent.value || selectedComponent.value.type !== 'glyph') {
    return []
  }
  
  const glyphValue = selectedComponent.value.value as ICustomGlyph
  if (!glyphValue || !Array.isArray(glyphValue.parameters)) {
    return []
  }
  
  return glyphValue.parameters as IParameter[]
})

// 获取常量值（用于 Constant 类型参数）
const getConstantValue = (param: IParameter): number | string => {
  if (param.type !== ParameterType.Constant) {
    return param.value
  }
  
  const constantsMap = projectStore.constantsMap
  if (constantsMap && typeof constantsMap.getByUUID === 'function') {
    const uuidValue = String(param.value)
    const resolvedValue = constantsMap.getByUUID(uuidValue)
    if (resolvedValue !== undefined) {
      return resolvedValue
    }
  }
  
  return param.value
}

// 处理参数值修改
const handleChangeParameter = async (parameter: IParameter, value: number | string) => {
  if (!selectedComponent.value || selectedComponent.value.type !== 'glyph') {
    return
  }
  
  const glyphValue = selectedComponent.value.value as ICustomGlyph
  if (!glyphValue || !Array.isArray(glyphValue.parameters)) {
    return
  }
  
  // 如果是 Constant 类型，更新全局常量的值
  if (parameter.type === ParameterType.Constant) {
    const constantUUID = String(parameter.value)
    const constantsMap = projectStore.constantsMap
    
    if (constantsMap) {
      // 对于 Constant 类型，value 应该是 number（因为 IConstant.value 是 number）
      const numericValue = typeof value === 'number' ? value : Number(value)
      
      // 更新 ConstantsMap 中的常量值
      constantsMap.updateConstantValue(constantUUID, numericValue)
      
      // 更新 selectedFile.constants 中的常量值（用于持久化，但不触发列表更新）
      if (projectStore.selectedFile?.constants) {
        const constant = projectStore.selectedFile.constants.find(c => c.uuid === constantUUID)
        if (constant) {
          constant.value = numericValue
        }
      }
    }
  } else {
    // 对于非 Constant 类型，更新参数值
    const param = glyphValue.parameters.find(p => p.uuid === parameter.uuid)
    if (!param) {
      return
    }
    
    param.value = value
  }
  
  // 更新组件数据（触发响应式更新）
  // 注意：这里需要深拷贝 glyphValue，确保 Vue 能检测到变化
  const updatedGlyphValue = {
    ...glyphValue,
    parameters: [...glyphValue.parameters], // 创建新数组以触发响应式更新
  }
  
  modifyComponent({
    value: updatedGlyphValue,
  })
  
  // 执行字形脚本（使用更新后的字形数据）
  try {
    await executeGlyphScript(updatedGlyphValue, selectedComponent.value.uuid)
    
    // 脚本执行完成后，再次更新组件以确保画布重新渲染
    // 由于 modifyComponent 已经更新了组件，CharacterEditor/GlyphEditor 中的 watch
    // 会监听到 orderedListWithItemsForCurrentCharacterFile/orderedListWithItemsForCurrentGlyph 的变化
    // 从而自动触发 renderCanvas()
    // 注意：这里不调用 updateCharacterListFromEditFile 或 updateGlyphListFromEditFile
    // 因为用户要求只更新当前字符的显示，不更新列表
  } catch (error) {
    console.error('Error executing glyph script after parameter change:', error)
  }
}

const handleChangeOX = (ox: number | null) => {
  if (ox === null || !selectedComponentUUID.value) return
  modifyComponent({ ox })
}

const handleChangeOY = (oy: number | null) => {
  if (oy === null || !selectedComponentUUID.value) return
  modifyComponent({ oy })
}

const handleChangeName = (name: string) => {
  if (!selectedComponentUUID.value) return
  modifyComponent({ name })
}
</script>

<template>
  <div class="glyph-edit-panel">    
    <template v-if="selectedComponent">
      <!-- 组件名称 -->
      <div class="section">
        <div class="section-title">{{ t('panels.paramsPanel.componentName.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.componentName.label')">
            <n-input
              :value="selectedComponent.name"
              @update:value="handleChangeName"
            />
          </n-form-item>
        </n-form>
      </div>

      <!-- 变换参数 -->
      <div class="section">
        <div class="section-title">{{ t('panels.paramsPanel.transform.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.transform.x')">
            <n-input-number
              :value="selectedComponent.ox"
              :precision="1"
              @update:value="handleChangeOX"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.transform.y')">
            <n-input-number
              :value="selectedComponent.oy"
              :precision="1"
              @update:value="handleChangeOY"
            />
          </n-form-item>
        </n-form>
      </div>

      <!-- 关键点和辅助线 -->
      <div class="section">
        <div class="section-title">{{ t('panels.paramsPanel.joints.title') }} / {{ t('panels.paramsPanel.refLines.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.joints.title')">
            <n-switch
              :value="editorStore.checkJoints"
              @update:value="(v) => editorStore.checkJoints = v"
            />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.refLines.title')">
            <n-switch
              :value="editorStore.checkRefLines"
              @update:value="(v) => editorStore.checkRefLines = v"
            />
          </n-form-item>
        </n-form>
      </div>

      <!-- 参数列表 -->
      <div class="section" v-if="glyphParameters.length > 0">
        <div class="section-title">{{ t('panels.paramsPanel.params.title') }}</div>
        <n-form label-placement="left" label-width="80px">
          <n-form-item
            v-for="parameter in glyphParameters"
            :key="parameter.uuid"
            :label="parameter.name"
          >
            <!-- Number 类型参数 -->
            <template v-if="parameter.type === ParameterType.Number">
              <div class="parameter-control">
                <n-input-number
                  :value="parameter.value as number"
                  :step="parameter.max && parameter.max <= 10 ? 0.01 : 1"
                  :min="parameter.min"
                  :max="parameter.max"
                  :precision="parameter.max && parameter.max <= 10 ? 2 : 0"
                  @update:value="(v) => handleChangeParameter(parameter, v ?? 0)"
                />
                <n-slider
                  :value="parameter.value as number"
                  :step="parameter.max && parameter.max <= 10 ? 0.01 : 1"
                  :min="parameter.min ?? 0"
                  :max="parameter.max ?? 100"
                  :precision="parameter.max && parameter.max <= 10 ? 2 : 0"
                  @update:value="(v) => handleChangeParameter(parameter, v)"
                  style="width: 100%; margin-top: 8px;"
                />
              </div>
            </template>
            
            <!-- Enum 类型参数 -->
            <template v-else-if="parameter.type === ParameterType.Enum">
              <n-select
                :value="parameter.value"
                :options="parameter.options?.map(opt => ({ label: opt.label, value: opt.value })) || []"
                @update:value="(v) => handleChangeParameter(parameter, v)"
              />
            </template>
            
            <!-- Constant 类型参数（显示常量值，可编辑但不更新列表） -->
            <template v-else-if="parameter.type === ParameterType.Constant">
              <div class="constant-param">
                <n-input-number
                  :value="getConstantValue(parameter) as number"
                  :step="parameter.max && parameter.max <= 10 ? 0.01 : 1"
                  :min="parameter.min"
                  :max="parameter.max"
                  :precision="parameter.max && parameter.max <= 10 ? 2 : 0"
                  @update:value="(v) => handleChangeParameter(parameter, v ?? 0)"
                />
                <n-slider
                  :value="getConstantValue(parameter) as number"
                  :step="parameter.max && parameter.max <= 10 ? 0.01 : 1"
                  :min="parameter.min ?? 0"
                  :max="parameter.max ?? 100"
                  :precision="parameter.max && parameter.max <= 10 ? 2 : 0"
                  @update:value="(v) => handleChangeParameter(parameter, v)"
                  style="width: 100%; margin-top: 8px;"
                />
                <span class="constant-note">
                  <span class="constant-note-text">全局常量</span>
                  <span class="constant-note-icon">
                    <n-icon name="edit">
                      <font-awesome-icon :icon="['fas', 'pen-to-square']" />
                    </n-icon>
                  </span>
                </span>
              </div>
            </template>
          </n-form-item>
        </n-form>
      </div>
    </template>
    
    <div v-else class="empty-state">
      <n-empty description="未选中组件" />
    </div>
  </div>
</template>

<style scoped>
.glyph-edit-panel {
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--dark-4);
  color: var(--text-color-1);
}

.parameter-control {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.parameter-control .n-input-number {
  width: 100%
}

.parameter-control .n-slider {
  width: 100%;
}

.constant-param {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}

.constant-param .n-input-number {
  width: 100%;
}

.constant-param .n-slider {
  width: 100%;
}

.constant-note {
  font-size: 12px;
  color: #7a2703;
  font-weight: bold;
  white-space: nowrap;
  margin-top: 8px;
  .n-icon {
    font-size: 14px !important;
  }
}

.constant-note-text {
  margin-right: 5px;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}
</style>