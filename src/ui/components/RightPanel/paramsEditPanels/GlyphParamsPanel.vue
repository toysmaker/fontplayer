<script setup lang="ts">
/**
 * Glyph Params Panel (editingGlyph 本身的参数面板)
 * 顺序必须与原工程一致（去掉布局 section）：风格标签 -> 骨架绑定 -> 参数列表
 *
 * 重要：此面板编辑的是 `glyphStore.editingGlyph` 自身的参数（style/parameters/skeleton/...），
 * 不是任何组件（selectedComponent）的参数。
 */

import { computed, ref } from 'vue'
import {
  NButton,
  NSelect,
  NForm,
  NFormItem,
  NInputNumber,
  NSwitch,
  NCheckbox,
  NInput,
  NInputGroup,
  NSlider,
  NDivider,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useGlyphStore } from '@/stores/glyph'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { ParameterType, type IParameter } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { kai_strokes as strokes } from '@/templates/strokes_1'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { calculateGlyphWeight } from '@/features/glyphWeight'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import {
  onSkeletonSelect,
  onSkeletonBind,
  onSkeletonDragging,
  onWeightSetting,
  onSelectBone,
  selectedBone,
  weightValue,
  brushSize,
} from '@/stores/skeletonDragger'
import { getGlyphEditCanvasContext } from '@/features/editor/glyphEditCanvas'
import { initWeightSelector, renderBoneAndWeight } from '@/features/tools/skeletonBind'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'

const { t } = useI18n()
const glyphStore = useGlyphStore()
const editorStore = useEditorStore()
const projectStore = useProjectStore()

const editGlyph = computed<any>(() => (glyphStore as any).editingGlyph)

const editGlyphInstance = computed<CustomGlyph | null>(() => {
  const g = editGlyph.value
  if (!g?.uuid) return null
  return instanceManager.getInstance(g.uuid, () => new CustomGlyph(g), 'glyph') as unknown as CustomGlyph
})

// -------------------------
// 风格标签（原工程：可切换启用编辑）
// -------------------------
const enableStyleTagEdit = ref(false)
const toggleStyleEdit = () => {
  enableStyleTagEdit.value = !enableStyleTagEdit.value
}

const onStyleChange = () => {
  // style 变化不一定需要执行脚本，但保持与参数区行为一致：触发一次重渲染
  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

// -------------------------
// 骨架绑定（已实现，保持原逻辑）
// -------------------------
const skeletonOptions = computed(() => {
  return strokes.map((s: any) => ({ label: s.name, value: s.name }))
})

const skeletonVisible = computed(() => {
  const g = editGlyph.value
  const inst = editGlyphInstance.value as any
  // must keep exact original condition
  return (
    (!g?.skeleton && (!inst?.getSkeleton || !inst?.getSkeleton())) ||
    !!g?.skeleton ||
    onSkeletonSelect.value ||
    onSkeletonBind.value
  )
})

const onChangeSkeleton = (value: string) => {
  const g = editGlyph.value
  if (!g) return

  const type = value
  const skeleton: any = { type, ox: 0, oy: 0 }
  g.skeleton = skeleton

  // 根据骨架注入字形参数（注意：是 editGlyph 自身参数，不是组件参数）
  const stroke = strokes.find((s: any) => s.name === type)
  if (stroke) {
    if (!Array.isArray(g.parameters)) g.parameters = []
    const parameters = g.parameters as Array<any>
    for (let j = 0; j < stroke.params.length; j++) {
      const param = stroke.params[j]
      parameters.push({
        uuid: genUUID(),
        name: param.name,
        type: ParameterType.Number,
        value: param.default,
        min: param.min || 0,
        max: param.max || 1000,
      })
    }
    parameters.push({
      uuid: genUUID(),
      name: '参考位置',
      type: ParameterType.Enum,
      value: 0,
      options: [
        { value: 0, label: '默认' },
        { value: 1, label: '右侧（上侧）' },
        { value: 2, label: '左侧（下侧）' },
      ],
    })
    parameters.push({
      uuid: genUUID(),
      name: '弯曲程度',
      type: ParameterType.Number,
      value: 1,
      min: 0,
      max: 2,
    })
  }

  const strokeFn: any = (strokeFnMap as any)[type]
  strokeFn && strokeFn.instanceBasicGlyph(g)
  strokeFn && strokeFn.updateSkeletonListenerBeforeBind(editGlyphInstance.value)

  onSkeletonSelect.value = false
  g.skeleton.onSkeletonBind = true
  onSkeletonDragging.value = true

  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

const bindSkeleton = () => {
  const g = editGlyph.value
  if (!g) return

  if (!g.components?.length) {
    onSkeletonDragging.value = false
    return
  }

  const { type } = g.skeleton
  const strokeFn: any = (strokeFnMap as any)[type]
  if (strokeFn) {
    strokeFn.bindSkeletonGlyph(g)
    strokeFn.updateSkeletonListenerAfterBind(editGlyphInstance.value)
  }

  onSkeletonDragging.value = false

  g.skeleton.originWeight = calculateGlyphWeight(g)
  // ensure there is a 字重 param to store value (refactor uses array)
  if (!Array.isArray(g.parameters)) g.parameters = []
  const p = (g.parameters as Array<any>).find((x) => x?.name === '字重')
  if (p) p.value = g.skeleton.originWeight

  g.skeleton.onSkeletonBind = false

  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

const removeSkeleton = () => {
  const g = editGlyph.value
  if (!g?.skeleton) return

  const { type } = g.skeleton
  g.skeleton = null

  const stroke = strokes.find((s: any) => s.name === type)
  if (stroke) {
    const inst = editGlyphInstance.value as any
    if (inst) {
      inst.getSkeleton = null
      inst.onSkeletonDragStart = null
      inst.onSkeletonDrag = null
      inst.onSkeletonDragEnd = null
      inst._joints = []
      inst._reflines = []
    }

    if (Array.isArray(g.parameters)) {
      const parameters = g.parameters as Array<any>
      for (let j = 0; j < stroke.params.length; j++) {
        const param = stroke.params[j]
        const idx = parameters.findIndex((p) => p?.name === param.name)
        if (idx !== -1) parameters.splice(idx, 1)
      }
      const otherParams = ['参考位置', '弯曲程度']
      for (let j = 0; j < otherParams.length; j++) {
        const idx = parameters.findIndex((p) => p?.name === otherParams[j])
        if (idx !== -1) parameters.splice(idx, 1)
      }
    }
  }

  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

const modifySkeleton = () => {
  const g = editGlyph.value
  if (!g?.skeleton) return

  const { type } = g.skeleton
  const strokeFn: any = (strokeFnMap as any)[type]
  strokeFn && strokeFn.instanceBasicGlyph(g)
  strokeFn && strokeFn.updateSkeletonListenerBeforeBind(editGlyphInstance.value)

  onSkeletonSelect.value = false
  g.skeleton.onSkeletonBind = true
  onSkeletonDragging.value = true

  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

const handleChangeSkeletonOX = (value: number | null) => {
  const g = editGlyph.value
  if (!g?.skeleton || value === null) return
  g.skeleton.ox = value
}
const handleChangeSkeletonOY = (value: number | null) => {
  const g = editGlyph.value
  if (!g?.skeleton || value === null) return
  g.skeleton.oy = value
}

let closeWeightSelector: null | (() => void) = null
const initWeightSetting = () => {
  onWeightSetting.value = true
  onSelectBone.value = true

  const ctx = getGlyphEditCanvasContext()
  if (!ctx) return

  closeWeightSelector = initWeightSelector(ctx.canvas, {
    getCoord: ctx.getCoord,
    onRender: ctx.onRender,
  })

  ctx.onRender()
  renderBoneAndWeight(ctx.canvas)
}

const closeWeightSetting = () => {
  onWeightSetting.value = false
  onSelectBone.value = false
  closeWeightSelector && closeWeightSelector()
  closeWeightSelector = null

  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

const selectedBoneIndex = computed<number | null>({
  get: () => (selectedBone.value ? selectedBone.value.index : null),
  set: (value) => {
    if (selectedBone.value) selectedBone.value.index = value
  },
})

const bonesOptions = computed(() => {
  const bones = editGlyph.value?.skeleton?.skeletonBindData?.bones || []
  return bones.map((b: any, idx: number) => ({ label: b.id, value: idx }))
})

const handleChangeSelectedBone = (value: number) => {
  const g = editGlyph.value
  if (!g?.skeleton?.skeletonBindData?.bones) return
  selectedBone.value = g.skeleton.skeletonBindData.bones[value]
  selectedBone.value.index = value

  const ctx = getGlyphEditCanvasContext()
  if (!ctx) return
  ctx.onRender()
  renderBoneAndWeight(ctx.canvas)
}

// -------------------------
// 参数列表（editGlyph 自身 parameters 数组）
// -------------------------
const glyphParameters = computed<IParameter[]>(() => {
  const g = editGlyph.value
  if (!g) return []
  if (!Array.isArray(g.parameters)) return []
  return g.parameters as IParameter[]
})

const getConstantMeta = (uuid: string) => {
  return projectStore.selectedFile?.constants?.find((c: any) => c.uuid === uuid) || null
}

const getConstantValue = (param: IParameter): number | string => {
  if (param.type !== ParameterType.Constant) return param.value
  const constantsMap = projectStore.constantsMap
  if (constantsMap && typeof (constantsMap as any).getByUUID === 'function') {
    const uuidValue = String(param.value)
    const resolved = (constantsMap as any).getByUUID(uuidValue)
    if (resolved !== undefined) return resolved
  }
  return param.value
}

const rerenderAndExecute = () => {
  const g = editGlyph.value
  if (g?.uuid) {
    // 执行脚本以刷新参数到渲染（与原工程一致的“改参数即生效”体验）
    executeGlyphScript(g, g.uuid)
  }
  const ctx = getGlyphEditCanvasContext()
  ctx?.onRender()
}

const handleChangeParameter = (parameter: IParameter, value: number | string | null) => {
  const g = editGlyph.value
  if (!g || value === null) return
  if (!Array.isArray(g.parameters)) g.parameters = []

  // Constant：修改的是常量值（通过 constantsMap）
  if (parameter.type === ParameterType.Constant) {
    const constantUUID = String(parameter.value)
    const numericValue = typeof value === 'number' ? value : Number(value)
    if (projectStore.constantsMap?.updateConstantValue) {
      projectStore.constantsMap.updateConstantValue(constantUUID, numericValue)
    }
    // 同步到 selectedFile.constants（用于持久化）
    if (projectStore.selectedFile?.constants) {
      const c = projectStore.selectedFile.constants.find((x: any) => x.uuid === constantUUID)
      if (c) c.value = numericValue
    }
    rerenderAndExecute()
    return
  }

  // 普通参数：修改 editGlyph.parameters 数组项本身
  const p = (g.parameters as IParameter[]).find((x) => x.uuid === parameter.uuid)
  if (!p) return
  p.value = value as any
  rerenderAndExecute()
}
</script>

<template>
  <div class="glyph-params-panel">
    <!-- 1) 风格标签（必须在骨架之前） -->
    <div class="section">
      <div class="section-title">{{ t('panels.paramsPanel.glyphParamsPanel.styleTag') }}</div>
      <div class="section-body">
        <n-input-group>
          <n-input
            v-model:value="editGlyph.style"
            :disabled="!enableStyleTagEdit"
            :placeholder="t('panels.paramsPanel.glyphParamsPanel.styleTagPlaceholder')"
            @update:value="onStyleChange"
          />
          <n-button type="primary" ghost @click="toggleStyleEdit">
            {{ enableStyleTagEdit ? t('panels.paramsPanel.glyphParamsPanel.styleTagDone') : t('panels.paramsPanel.glyphParamsPanel.styleTagEdit') }}
          </n-button>
        </n-input-group>
      </div>
    </div>

    <!-- 2) 骨架绑定 -->
    <div v-if="skeletonVisible" class="section">
      <div class="section-title">{{ t('panels.paramsPanel.glyphParamsPanel.skeletonBinding') }}</div>

      <div class="section-body skeleton-wrap">
        <n-button
          v-if="!editGlyph?.skeleton && (!editGlyphInstance?.getSkeleton || !editGlyphInstance?.getSkeleton())"
          size="small"
          @click="onSkeletonSelect = true"
        >
          {{ t('panels.paramsPanel.glyphParamsPanel.addSkeleton') }}
        </n-button>

        <n-select
          v-if="onSkeletonSelect"
          :value="editGlyph?.skeleton?.type"
          :options="skeletonOptions"
          :placeholder="t('panels.paramsPanel.glyphParamsPanel.skeletonTypePlaceholder')"
          :disabled="!onSkeletonSelect"
          @update:value="(v) => onChangeSkeleton(String(v))"
        />

        <n-form v-if="onSkeletonBind && !onSkeletonSelect && editGlyph?.skeleton" label-placement="left" label-width="80">
          <n-form-item :label="t('panels.paramsPanel.glyphParamsPanel.skeletonOX')">
            <n-input-number :value="editGlyph.skeleton.ox" :precision="1" @update:value="handleChangeSkeletonOX" />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.glyphParamsPanel.skeletonOY')">
            <n-input-number :value="editGlyph.skeleton.oy" :precision="1" @update:value="handleChangeSkeletonOY" />
          </n-form-item>
          <n-form-item :show-label="false">
            <n-checkbox v-model:checked="editGlyph.skeleton.dynamicWeight">{{ t('panels.paramsPanel.glyphParamsPanel.dynamicWeight') }}</n-checkbox>
          </n-form-item>
          <n-button size="small" @click="bindSkeleton">{{ t('panels.paramsPanel.glyphParamsPanel.bindSkeleton') }}</n-button>
        </n-form>

        <div v-if="editGlyph?.skeleton && !onSkeletonBind" class="weight-setting-wrap">
          <n-button size="small" @click="initWeightSetting">{{ t('panels.paramsPanel.glyphParamsPanel.manualWeight') }}</n-button>
          <n-button v-if="!onWeightSetting" size="small" @click="modifySkeleton">{{ t('panels.paramsPanel.glyphParamsPanel.modifySkeleton') }}</n-button>
          <n-button v-if="!onWeightSetting" size="small" type="error" @click="removeSkeleton">{{ t('panels.paramsPanel.glyphParamsPanel.removeSkeleton') }}</n-button>
        </div>

        <div v-if="onWeightSetting" class="weight-setting">
          <n-form label-placement="left" label-width="80">
            <n-form-item :label="t('panels.paramsPanel.glyphParamsPanel.selectBone')">
              <n-select
                v-model:value="selectedBoneIndex"
                :options="bonesOptions"
                :placeholder="t('panels.paramsPanel.glyphParamsPanel.selectBonePlaceholder')"
                @update:value="(v) => handleChangeSelectedBone(Number(v))"
              />
            </n-form-item>
            <n-form-item :label="t('panels.paramsPanel.glyphParamsPanel.weight')">
              <n-input-number v-model:value="weightValue" :precision="2" :min="0" :max="1" />
            </n-form-item>
            <n-form-item :label="t('panels.paramsPanel.glyphParamsPanel.brushSize')">
              <n-input-number v-model:value="brushSize" :precision="2" :min="10" :max="100" />
            </n-form-item>
            <n-button size="small" @click="closeWeightSetting">{{ t('panels.paramsPanel.glyphParamsPanel.finishWeightSetting') }}</n-button>
          </n-form>
        </div>
      </div>
    </div>

    <!-- 3) 参数（必须在骨架之后） -->
    <div class="section">
      <div class="section-title">{{ t('panels.paramsPanel.params.title') }}</div>
      <div class="section-body">
        <n-form label-placement="left" label-width="90">
          <n-form-item :label="t('panels.paramsPanel.joints.title')">
            <n-switch v-model:value="editorStore.checkJoints" />
          </n-form-item>
          <n-form-item :label="t('panels.paramsPanel.refLines.title')">
            <n-switch v-model:value="editorStore.checkRefLines" />
          </n-form-item>
        </n-form>

        <n-form label-placement="left" label-width="90">
          <n-form-item v-for="parameter in glyphParameters" :key="parameter.uuid" :label="parameter.name">
            <!-- Number -->
            <div v-if="parameter.type === ParameterType.Number" style="width: 100%;">
              <n-input-number
                :value="parameter.value as number"
                :min="parameter.min ?? 0"
                :max="parameter.max ?? 1000"
                :step="(parameter.max ?? 1000) <= 10 ? 0.01 : 1"
                :precision="(parameter.max ?? 1000) <= 10 ? 2 : 0"
                @update:value="(v) => handleChangeParameter(parameter, v)"
              />
              <n-slider
                style="margin-top: 8px;"
                :min="parameter.min ?? 0"
                :max="parameter.max ?? 1000"
                :step="(parameter.max ?? 1000) <= 10 ? 0.01 : 1"
                @update:value="(v) => handleChangeParameter(parameter, v)"
                :value="parameter.value as number"
              />
            </div>

            <!-- Enum -->
            <div v-else-if="parameter.type === ParameterType.Enum" style="width: 100%;">
              <n-select
                :value="parameter.value"
                :options="parameter.options || []"
                @update:value="(v) => handleChangeParameter(parameter, v as any)"
              />
            </div>

            <!-- Constant -->
            <div v-else-if="parameter.type === ParameterType.Constant" style="width: 100%;">
              <template v-if="getConstantMeta(String(parameter.value))?.type === ParameterType.Enum">
                <n-select
                  :value="getConstantValue(parameter) as any"
                  :options="getConstantMeta(String(parameter.value))?.options || []"
                  @update:value="(v) => handleChangeParameter(parameter, Number(v))"
                />
              </template>
              <template v-else>
                <n-input-number
                  :value="Number(getConstantValue(parameter))"
                  :min="getConstantMeta(String(parameter.value))?.min ?? (parameter.min ?? 0)"
                  :max="getConstantMeta(String(parameter.value))?.max ?? (parameter.max ?? 1000)"
                  :step="(getConstantMeta(String(parameter.value))?.max ?? (parameter.max ?? 1000)) <= 10 ? 0.01 : 1"
                  :precision="(getConstantMeta(String(parameter.value))?.max ?? (parameter.max ?? 1000)) <= 10 ? 2 : 0"
                  @update:value="(v) => handleChangeParameter(parameter, v)"
                />
              </template>
            </div>
          </n-form-item>
        </n-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glyph-params-panel {
  padding: 10px;
  color: var(--light-0);
}
.section {
  margin-bottom: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.weight-setting-wrap {
  width: 100%;
}
.weight-setting {
  margin-top: 12px;
}
.skeleton-wrap .n-button {
  width: 100% !important;
  height: 32px !important;
  margin-bottom: 10px !important;
}

.section-body {
  margin-bottom: 20px;
}
</style>

<style>
.skeleton-wrap .n-base-selection .n-base-selection-placeholder{
  color: var(--primary-0) !important;
}
</style>