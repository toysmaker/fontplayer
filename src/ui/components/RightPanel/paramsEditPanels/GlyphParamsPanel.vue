<script setup lang="ts">
/**
 * Glyph Params Panel (editingGlyph 本身的参数面板)
 * 顺序必须与原工程一致（去掉布局 section）：风格标签 -> 骨架绑定 -> 参数列表
 *
 * 重要：此面板编辑的是 `glyphStore.editingGlyph` 自身的参数（style/parameters/skeleton/...），
 * 不是任何组件（selectedComponent）的参数。
 */

import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
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
  NTag,
  useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import * as R from 'ramda'
import { useGlyphStore } from '@/stores/glyph'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { useDialogsStore } from '@/stores/dialogs'
import { ParameterType, type IParameter, type IVariable } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import AddVariableDialog from '@/ui/dialogs/AddVariableDialog.vue'
import { kai_strokes as strokes } from '@/templates/strokes_1'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { calculateGlyphWeight } from '@/features/glyphWeight'
import { bindSkeletonForVariables } from '@/features/skeletonVariableBind'
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
import { getEditCanvasContext } from '@/features/editor/editCanvas'
import { initWeightSelector, renderBoneAndWeight } from '@/features/tools/skeletonBind'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { isDefaultScriptTemplate } from '@/features/programming/glyphProgrammingUtils'
import { glyphSkeletonBindFromRefGlyph, glyphSkeletonRebind } from '@/features/glyphSkeletonBind'
import { GlyphSkeletonDragger } from '@/features/glyphSkeletonDragger'

const { t } = useI18n()
const glyphStore = useGlyphStore()
const editorStore = useEditorStore()
const projectStore = useProjectStore()
const dialogsStore = useDialogsStore()

// 字形骨架拖拽器
const skeletonDragger = new GlyphSkeletonDragger()

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
const handleToggleStyleEdit = createDebouncedHandler(toggleStyleEdit, 'GlyphParamsPanel.toggleStyleEdit')

const onStyleChange = () => {
  // style 变化不一定需要执行脚本，但保持与参数区行为一致：触发一次重渲染
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

// -------------------------
// 骨架绑定（已实现，保持原逻辑）
// -------------------------
const skeletonOptions = computed(() => {
  const options = strokes.map((s: any) => ({ label: s.name, value: s.name }))
  options.push({
    label: t('panels.paramsPanel.glyphParamsPanel.skeletonTypeGlyph'),
    value: 'glyphSkeleton',
  })
  return options
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

  // glyphSkeleton：打开字形选择对话框
  if (value === 'glyphSkeleton') {
    onSkeletonSelect.value = false
    dialogsStore.openGlyphComponentsDialogForStrokeReplace((templateUuid: string) => {
      handleGlyphSkeletonPick(templateUuid)
    })
    return
  }

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

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}
const handleAddSkeleton = createDebouncedHandler(() => { onSkeletonSelect.value = true }, 'GlyphParamsPanel.addSkeleton')

// ============= 字形骨架：选择参考字形 =============
const handleGlyphSkeletonPick = (templateUuid: string) => {
  try {
  const g = editGlyph.value
  if (!g) return

  const file = projectStore.selectedFile
  if (!file) return

  // 1. 查找参考字形
  const allGlyphs: any[] = [
    ...(file.stroke_glyphs || []),
    ...(file.radical_glyphs || []),
    ...(file.glyphs || []),
    ...(file.comp_glyphs || []),
  ]
  const refGlyph = allGlyphs.find((gl: any) => gl.uuid === templateUuid)
  if (!refGlyph) {
    message.warning('未找到参考字形')
    return
  }

  // 2. Deep clone 参考字形的参数和脚本，存入 skeleton.referenceGlyphData
  const refData: any = R.clone({
    name: refGlyph.name,
    parameters: refGlyph.parameters || [],
    script: refGlyph.script,
    script_reference: refGlyph.script_reference,
    glyph_script: refGlyph.glyph_script,
    param_script: refGlyph.param_script,
    system_script: refGlyph.system_script,
  })

  g.skeleton = {
    type: 'glyphSkeleton',
    ox: 0,
    oy: 0,
    referenceGlyphUUID: templateUuid,
    referenceGlyphData: refData,
    boneSegmentsPerRefLine: 5,
  }

  // 4. 将参考字形参数复制到当前字形（脚本执行时 getParam 需要）
  const savedScript = g.script
  const savedScriptRef = g.script_reference
  const savedParams = g.parameters

  if (!Array.isArray(g.parameters)) g.parameters = []
  const existingParamNames = new Set((g.parameters as any[]).map((p: any) => p.name))
  for (const rp of (refData.parameters || [])) {
    if (!existingParamNames.has(rp.name)) {
      (g.parameters as any[]).push(R.clone(rp))
    }
  }

  // 5. 适配脚本函数名：参考字形的脚本函数名基于参考 UUID，需要替换为当前字形 UUID
  let adaptedScript = refData.script
  if (adaptedScript) {
    const refFnName = `script_${templateUuid.replaceAll('-', '_')}`
    const editFnName = `script_${g.uuid.replaceAll('-', '_')}`
    adaptedScript = adaptedScript.replace(refFnName, editFnName)
    // 存储适配后的脚本（函数名匹配当前字形 UUID），供组件引用时执行
    refData.adaptedScript = adaptedScript
  }

  g.script = adaptedScript || undefined
  g.script_reference = undefined

  // 6. 直接在编辑实例上执行脚本（生成 joints/reflines + 设置 onSkeletonDrag 回调）
  const editInst = editGlyphInstance.value as any
  if (!editInst) {
    g.skeleton = null
    message.warning('无法获取编辑实例')
    return
  }
  editInst.tempData = null

  try {
    executeGlyphScript(g, g.uuid, { ignoreTempDataGuard: true })
  } catch (e) {
    console.error('[glyphSkeleton] executeGlyphScript failed:', e)
    g.script = savedScript
    g.script_reference = savedScriptRef
    g.parameters = savedParams
    g.skeleton = null
    message.warning('脚本执行失败')
    return
  }

  // 7. 恢复原始脚本（参数保留克隆版本），检查辅助线
  g.script = savedScript
  g.script_reference = savedScriptRef
  // 刷新 refData.parameters（脚本可能通过 setParam 修改了参数值）
  refData.parameters = R.clone(g.parameters)

  const reflines = editInst?.getRefLines?.() || []
  const joints = editInst?.getJoints?.() || []

  console.log('[glyphSkeleton] After script execution:', {
    jointsCount: joints.length,
    reflinesCount: reflines.length,
    hasDragStart: !!editInst.onSkeletonDragStart,
    hasDrag: !!editInst.onSkeletonDrag,
    hasDragEnd: !!editInst.onSkeletonDragEnd,
  })

  if (reflines.length === 0) {
    message.warning('参考字形脚本未生成辅助线，无法创建骨架')
    g.skeleton = null
    return
  }

  // 8. 清除脚本生成的视觉组件（glyphSkeleton 只用骨架）
  editInst._components = []
  // 清除可能被脚本设置的 getComponentsBySkeleton（我们不想要脚本组件）
  editInst.getComponentsBySkeleton = null

  // 9. 保存 refData 和缓存的 reflines/joints
  g.skeleton.referenceGlyphData = refData
  ;(g.skeleton as any).cachedJoints = R.clone(joints)
  ;(g.skeleton as any).cachedRefLines = R.clone(reflines)

  // 10. 进入绑定前状态：显示骨架，可拖拽（由脚本的 onSkeletonDrag 回调处理约束）
  g.skeleton.onSkeletonBind = true
  onSkeletonDragging.value = true
  editorStore.checkJoints = true
  editorStore.checkRefLines = true

  message.success(`已加载骨架：${joints.length} 个关键点，${reflines.length} 条辅助线，请拖拽调整后点击"绑定骨架"`)

  const ctx = getEditCanvasContext()
  ctx?.onRender()
  } catch (e) {
    console.error('[glyphSkeleton] handleGlyphSkeletonPick error:', e)
    message.warning('字形骨架加载失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// 修改参考字形参数后重新执行脚本并重新绑定
const handleChangeGlyphSkeletonRefParam = (param: IParameter, value: number | string | null) => {
  const g = editGlyph.value
  if (!g?.skeleton?.referenceGlyphData || value === null) return

  const refData = g.skeleton.referenceGlyphData
  const targetParam = (refData.parameters as IParameter[])?.find((p: IParameter) => p.uuid === param.uuid)
  if (!targetParam) return

  let processed: number | string = value
  if (typeof value === 'number') {
    if (targetParam.min !== undefined && value < targetParam.min) processed = targetParam.min
    if (targetParam.max !== undefined && value > targetParam.max) processed = targetParam.max
  }
  targetParam.value = processed

  // 同步到 g.parameters
  const gParam = (g.parameters as any[])?.find((p: any) => p.uuid === param.uuid)
  if (gParam) gParam.value = processed

  // 使用存储的适配脚本（首次 pick 时已生成，函数名匹配当前字形 UUID）
  const scriptToRun = refData.adaptedScript || refData.script
  if (scriptToRun) {
    const savedScript = g.script
    g.script = scriptToRun
    g.script_reference = undefined

    try {
      executeGlyphScript(g, g.uuid, { ignoreTempDataGuard: true })

      // 在恢复 g.script 之前立即执行 rebind
      // 重要：直接用 executeGlyphScript 内部使用的 key 获取同一实例，避免实例池不一致
      const instRebind = instanceManager.getInstance(g.uuid, () => new CustomGlyph(g), 'glyph') as any
      if (import.meta.env.DEV && instRebind) {
        console.log('[glyphSkeleton] Before rebind:', {
          instReflines: instRebind.getRefLines?.()?.length ?? -1,
          instJoints: instRebind.getJoints?.()?.length ?? -1,
          hasBindData: !!(g.skeleton as any).glyphSkeletonBindData,
          onSkeletonBind: g.skeleton.onSkeletonBind,
        })
      }
      if (instRebind) {
        instRebind._components = []
        if (!g.skeleton.onSkeletonBind && (g.skeleton as any).glyphSkeletonBindData) {
          glyphSkeletonRebind(instRebind)
        }
      }
    } finally {
      g.script = savedScript
    }
  }

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

// 将 skeleton.ox/oy 偏移应用到实例上所有关节（custom_1 脚本不认 ox/oy，需手动加回）
function applySkeletonOffsetToJoints(inst: any) {
  const skel = inst?._glyph?.skeleton
  if (!skel || (!skel.ox && !skel.oy)) return
  const ox = skel.ox || 0
  const oy = skel.oy || 0
  if (ox === 0 && oy === 0) return
  const allJoints = inst.getJoints?.() || []
  for (const j of allJoints) {
    if (j._x !== undefined) { j._x += ox; j._y += oy }
    else if (typeof j.x !== 'function' && j.x !== undefined) { j.x += ox; j.y += oy }
  }
}

// 参考字形参数列表（用于 UI 显示）
const glyphSkeletonRefParams = computed<IParameter[]>(() => {
  const g = editGlyph.value
  if (!g?.skeleton?.referenceGlyphData?.parameters) return []
  return g.skeleton.referenceGlyphData.parameters as IParameter[]
})

const isGlyphSkeletonType = computed(() => {
  return editGlyph.value?.skeleton?.type === 'glyphSkeleton'
})

// ============= 绑定骨架 =============
const bindSkeleton = () => {
  const g = editGlyph.value
  if (!g) return

  if (!g.components?.length) {
    onSkeletonDragging.value = false
    return
  }

  // glyphSkeleton：执行多组件绑定
  if (g.skeleton?.type === 'glyphSkeleton') {
    const inst = editGlyphInstance.value as any
    if (!inst) return

    const refData = g.skeleton.referenceGlyphData
    if (!refData) return

    const ok = glyphSkeletonBindFromRefGlyph(inst, refData, g.skeleton.boneSegmentsPerRefLine || 5)
    if (!ok) {
      message.warning(t('panels.paramsPanel.glyphParamsPanel.skeletonNoRefLines'))
      return
    }

    onSkeletonDragging.value = false
    g.skeleton.onSkeletonBind = false
    // glyphSkeleton 使用 glyphSkeletonBindData，calculateGlyphWeight 依赖 skeletonBindData，跳过
    // g.skeleton.originWeight 留空，glyphSkeleton 暂不支持动态字重

    if (!Array.isArray(g.parameters)) g.parameters = []
    // 确保字重参数存在（即使不计算 originWeight）
    const weightParam = (g.parameters as Array<any>).find((x: any) => x?.name === '字重')
    if (!weightParam) {
      (g.parameters as Array<any>).push({
        uuid: genUUID(),
        name: '字重',
        type: ParameterType.Number,
        value: 40,
        min: 0,
        max: 200,
      })
    }

    const ctx = getEditCanvasContext()
    ctx?.onRender()
    return
  }

  const { type } = g.skeleton
  const strokeFn: any = (strokeFnMap as any)[type]
  if (strokeFn) {
    strokeFn.bindSkeletonGlyph(g)
    strokeFn.updateSkeletonListenerAfterBind(editGlyphInstance.value)
  }

  onSkeletonDragging.value = false

  // 如果字形包含可变参数，为每个关键帧图层绑定骨架
  bindSkeletonForVariables(g)

  g.skeleton.originWeight = calculateGlyphWeight(g)
  // ensure there is a 字重 param to store value (refactor uses array)
  if (!Array.isArray(g.parameters)) g.parameters = []
  const p = (g.parameters as Array<any>).find((x) => x?.name === '字重')
  if (p) p.value = g.skeleton.originWeight

  g.skeleton.onSkeletonBind = false

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}
const handleBindSkeleton = createDebouncedHandler(bindSkeleton, 'GlyphParamsPanel.bindSkeleton')

const removeSkeleton = () => {
  const g = editGlyph.value
  if (!g?.skeleton) return

  const { type } = g.skeleton

  if (type === 'glyphSkeleton') {
    // glyphSkeleton 专用清理
    const inst = editGlyphInstance.value as any
    if (inst) {
      inst.getSkeleton = null
      inst.onSkeletonDragStart = null
      inst.onSkeletonDrag = null
      inst.onSkeletonDragEnd = null
      inst._joints = []
      inst._reflines = []
    }
    // 清理字重参数
    if (Array.isArray(g.parameters)) {
      const idx = (g.parameters as Array<any>).findIndex((p: any) => p?.name === '字重')
      if (idx !== -1) (g.parameters as Array<any>).splice(idx, 1)
    }
    g.skeleton = null
    skeletonDragger.clearContext()

    const ctx = getEditCanvasContext()
    ctx?.onRender()
    return
  }

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

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}
const handleRemoveSkeleton = createDebouncedHandler(removeSkeleton, 'GlyphParamsPanel.removeSkeleton')

const modifySkeleton = () => {
  const g = editGlyph.value
  if (!g?.skeleton) return

  const { type } = g.skeleton

  // glyphSkeleton：重新执行脚本并进入拖拽模式
  if (type === 'glyphSkeleton') {
    const refData = g.skeleton.referenceGlyphData
    if (!refData?.script) return

    // 适配脚本函数名
    let adaptedScript = refData.script
    const refFnName = `script_${g.skeleton.referenceGlyphUUID.replaceAll('-', '_')}`
    const editFnName = `script_${g.uuid.replaceAll('-', '_')}`
    adaptedScript = adaptedScript.replace(refFnName, editFnName)

    const savedScript = g.script
    g.script = adaptedScript
    g.script_reference = undefined

    const inst = editGlyphInstance.value as any
    if (inst) {
      inst.tempData = null
      inst._components = []
    }

    try {
      executeGlyphScript(g, g.uuid, { ignoreTempDataGuard: true })
    } finally {
      g.script = savedScript
    }

    if (inst) {
      inst._components = []
    }

    onSkeletonSelect.value = false
    g.skeleton.onSkeletonBind = true
    onSkeletonDragging.value = true

    const ctx = getEditCanvasContext()
    ctx?.onRender()
    return
  }

  const strokeFn: any = (strokeFnMap as any)[type]
  strokeFn && strokeFn.instanceBasicGlyph(g)
  strokeFn && strokeFn.updateSkeletonListenerBeforeBind(editGlyphInstance.value)

  onSkeletonSelect.value = false
  g.skeleton.onSkeletonBind = true
  onSkeletonDragging.value = true

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}
const handleModifySkeleton = createDebouncedHandler(modifySkeleton, 'GlyphParamsPanel.modifySkeleton')

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

  const ctx = getEditCanvasContext()
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

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}
const handleInitWeightSetting = createDebouncedHandler(initWeightSetting, 'GlyphParamsPanel.initWeightSetting')
const handleCloseWeightSetting = createDebouncedHandler(closeWeightSetting, 'GlyphParamsPanel.closeWeightSetting')

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

  const ctx = getEditCanvasContext()
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
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

const handleChangeParameter = (parameter: IParameter, value: number | string | null) => {
  const g = editGlyph.value
  if (!g || value === null) return

  // glyphSkeleton：路由到专用处理函数（需要重新执行脚本 + rebind）
  if (g.skeleton?.type === 'glyphSkeleton') {
    handleChangeGlyphSkeletonRefParam(parameter, value)
    return
  }

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

// -------------------------
// 可变参数（Variable Interpolation）
// -------------------------
const message = useMessage()
const addVariableDialogVisible = ref(false)

const glyphVariables = computed<IVariable[]>(() => {
  const g = editGlyph.value
  if (!g || !Array.isArray(g.variables)) return []
  return g.variables as IVariable[]
})

const glyphLayerNames = computed<string[]>(() => {
  const g = editGlyph.value
  if (!g?.layers) return []
  return Object.keys(g.layers)
})

const hasScript = computed(() => {
  const g = editGlyph.value
  if (g?.script_reference) return true
  if (g?.glyph_script && Object.keys(g.glyph_script).length > 0) return true
  if (g?.param_script && Object.keys(g.param_script).length > 0) return true
  if (g?.system_script && Object.keys(g.system_script).length > 0) return true
  // 有 script 但它是默认空模板（只有注释没有可执行代码），不算真正的脚本
  if (g?.script && !isDefaultScriptTemplate(g.script)) return true
  return false
})

const hasParameters = computed(() => {
  const g = editGlyph.value
  return Array.isArray(g?.parameters) && g.parameters.length > 0
})

const hasSkeleton = computed(() => {
  return !!editGlyph.value?.skeleton
})

const addVariableDisabled = computed(() => {
  return hasScript.value || hasParameters.value || hasSkeleton.value
})

const addVariableDisabledReason = computed(() => {
  if (hasSkeleton.value) {
    return t('panels.paramsPanel.variablesPanel.addVariableDisabledSkeleton')
  }
  if (hasScript.value || hasParameters.value) {
    return t('panels.paramsPanel.variablesPanel.addVariableDisabledScript')
  }
  return ''
})

function handleAddVariable(variable: IVariable) {
  const g = editGlyph.value
  if (!g) return
  if (!Array.isArray(g.variables)) {
    g.variables = []
  }
  g.variables.push(variable)
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

function handleDeleteVariable(uuid: string) {
  const g = editGlyph.value
  if (!g?.variables) return
  const idx = g.variables.findIndex(v => v.uuid === uuid)
  if (idx !== -1) {
    g.variables.splice(idx, 1)
  }
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

function handleVariableValueChange(variable: IVariable, value: number | null) {
  if (value === null) return
  variable.value = value
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

function toggleVariablePreview() {
  editorStore.setVariablePreviewEnabled(!editorStore.variablePreviewEnabled)
  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

// ============= GlyphSkeletonDragger 生命周期 =============
onMounted(() => {
  const ctx = getEditCanvasContext()
  if (ctx?.canvas) {
    skeletonDragger.setup(ctx.canvas, ctx.getCoord, () => {
      ctx.onRender()
    })
  }
})

// 监听 onSkeletonDragging 变化，控制拖拽器上下文
watch([onSkeletonDragging, () => editGlyph.value?.skeleton?.type], ([dragging, skeletonType]) => {
  if (dragging && skeletonType === 'glyphSkeleton') {
    // 确保 dragger 已获取 canvas（onMounted 时 ctx 可能为 null）
    const ctx = getEditCanvasContext()
    if (ctx?.canvas) {
      skeletonDragger.setup(ctx.canvas, ctx.getCoord, () => ctx.onRender())
    }
    const inst = editGlyphInstance.value as any
    if (inst) {
      skeletonDragger.setContext(inst)
    }
  } else {
    skeletonDragger.clearContext()
  }
})

onUnmounted(() => {
  // 如果退出时还未绑定骨架（onSkeletonBind=true），重置骨架数据
  const g = editGlyph.value
  if (g?.skeleton?.type === 'glyphSkeleton' && g.skeleton.onSkeletonBind) {
    const inst = editGlyphInstance.value as any
    if (inst) {
      inst.onSkeletonDragStart = null
      inst.onSkeletonDrag = null
      inst.onSkeletonDragEnd = null
      inst.getSkeleton = null
      inst.getComponentsBySkeleton = null
      inst._joints = []
      inst._reflines = []
      inst._components = []
      inst.tempData = null
    }
    // 清理参数（只保留原始的，移除参考字形参数）
    if (Array.isArray(g.parameters)) {
      const refParamNames = new Set((g.skeleton.referenceGlyphData?.parameters as any[] || []).map((p: any) => p.name))
      g.parameters = (g.parameters as any[]).filter((p: any) => !refParamNames.has(p.name) && p.name !== '字重')
    }
    g.skeleton = null
    onSkeletonDragging.value = false
  }
  skeletonDragger.destroy()
})
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
          <n-button type="primary" ghost @click="handleToggleStyleEdit" @pointerup="handleToggleStyleEdit">
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
          @click="handleAddSkeleton" @pointerup="handleAddSkeleton"
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
          <n-button size="small" @click="handleBindSkeleton" @pointerup="handleBindSkeleton">{{ t('panels.paramsPanel.glyphParamsPanel.bindSkeleton') }}</n-button>
        </n-form>

        <div v-if="editGlyph?.skeleton && !onSkeletonBind" class="weight-setting-wrap">
          <n-button size="small" @click="handleInitWeightSetting" @pointerup="handleInitWeightSetting">{{ t('panels.paramsPanel.glyphParamsPanel.manualWeight') }}</n-button>
          <n-button v-if="!onWeightSetting" size="small" @click="handleModifySkeleton" @pointerup="handleModifySkeleton">{{ t('panels.paramsPanel.glyphParamsPanel.modifySkeleton') }}</n-button>
          <n-button v-if="!onWeightSetting" size="small" type="error" @click="handleRemoveSkeleton" @pointerup="handleRemoveSkeleton">{{ t('panels.paramsPanel.glyphParamsPanel.removeSkeleton') }}</n-button>
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
            <n-button size="small" @click="handleCloseWeightSetting" @pointerup="handleCloseWeightSetting">{{ t('panels.paramsPanel.glyphParamsPanel.finishWeightSetting') }}</n-button>
          </n-form>
        </div>
      </div>
    </div>

    <!-- 2.5) 字形骨架：参考字形参数编辑（仅在绑定前显示，绑定后参数合并到下方"参数"区域） -->
    <div v-if="isGlyphSkeletonType && editGlyph?.skeleton?.onSkeletonBind && editGlyph?.skeleton?.referenceGlyphData" class="section">
      <div class="section-title">
        {{ t('panels.paramsPanel.glyphParamsPanel.skeletonParamSectionTitle', { name: editGlyph.skeleton.referenceGlyphData.name || '' }) }}
      </div>
      <div class="section-body">
        <n-form label-placement="left" label-width="90">
          <n-form-item v-for="param in glyphSkeletonRefParams" :key="param.uuid" :label="param.name">
            <!-- Number -->
            <div v-if="param.type === ParameterType.Number" style="width: 100%;">
              <n-input-number
                :value="param.value as number"
                :min="param.min ?? 0"
                :max="param.max ?? 1000"
                :step="(param.max ?? 1000) <= 10 ? 0.01 : 1"
                :precision="(param.max ?? 1000) <= 10 ? 2 : 0"
                @update:value="(v) => handleChangeGlyphSkeletonRefParam(param, v)"
              />
              <n-slider
                style="margin-top: 8px;"
                :min="param.min ?? 0"
                :max="param.max ?? 1000"
                :step="(param.max ?? 1000) <= 10 ? 0.01 : 1"
                @update:value="(v) => handleChangeGlyphSkeletonRefParam(param, v)"
                :value="param.value as number"
              />
            </div>
            <!-- Enum -->
            <div v-else-if="param.type === ParameterType.Enum" style="width: 100%;">
              <n-select
                :value="param.value"
                :options="param.options || []"
                @update:value="(v) => handleChangeGlyphSkeletonRefParam(param, v as any)"
              />
            </div>
          </n-form-item>
          <div v-if="glyphSkeletonRefParams.length === 0" style="font-size: 12px; color: var(--light-0);">
            {{ t('panels.paramsPanel.glyphParamsPanel.skeletonRefGlyph') }}: {{ editGlyph?.skeleton?.referenceGlyphData?.name || '—' }}
          </div>
        </n-form>
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

    <!-- 4) 可变参数（Variable Interpolation） -->
    <div class="section">
      <div class="section-title">{{ t('panels.paramsPanel.variablesPanel.title') }}</div>
      <div class="section-body">
        <n-button
          size="small"
          :disabled="addVariableDisabled"
          :title="addVariableDisabledReason"
          @click="addVariableDialogVisible = true"
          style="width: 100%;"
        >
          {{ t('panels.paramsPanel.variablesPanel.addVariable') }}
        </n-button>
        <div v-if="addVariableDisabledReason" style="font-size: 11px; color: var(--warning-color, #e6a23c); margin-top: 4px;">
          {{ addVariableDisabledReason }}
        </div>

        <!-- 预览按钮：仅在存在可变参数时显示 -->
        <n-button
          v-if="glyphVariables.length > 0"
          size="small"
          :type="editorStore.variablePreviewEnabled ? 'primary' : 'default'"
          @click="toggleVariablePreview"
          style="width: 100%; margin-top: 8px;"
        >
          {{ editorStore.variablePreviewEnabled ? t('panels.paramsPanel.variablesPanel.previewOff') : t('panels.paramsPanel.variablesPanel.previewOn') }}
        </n-button>

        <div v-for="variable in glyphVariables" :key="variable.uuid" class="variable-item" style="margin-top: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 13px; font-weight: 500;">{{ variable.name }}</span>
            <n-button size="tiny" type="error" @click="handleDeleteVariable(variable.uuid)">
              {{ t('panels.paramsPanel.variablesPanel.deleteVariable') }}
            </n-button>
          </div>
          <div style="font-size: 11px; color: var(--light-0); margin: 4px 0;">
            {{ t('panels.paramsPanel.variablesPanel.variableMin') }}: {{ variable.min }} |
            {{ t('panels.paramsPanel.variablesPanel.variableDefault') }}: {{ variable.default }} |
            {{ t('panels.paramsPanel.variablesPanel.variableMax') }}: {{ variable.max }}
          </div>
          <n-form label-placement="left" label-width="60">
            <n-form-item :label="t('panels.paramsPanel.variablesPanel.variableValue')">
              <n-input-number
                :value="variable.value"
                :min="variable.min"
                :max="variable.max"
                :precision="1"
                :disabled="!editorStore.variablePreviewEnabled"
                @update:value="(v) => handleVariableValueChange(variable, v)"
              />
            </n-form-item>
          </n-form>
          <n-slider
            :value="variable.value"
            :min="variable.min"
            :max="variable.max"
            :step="1"
            :disabled="!editorStore.variablePreviewEnabled"
            @update:value="(v) => handleVariableValueChange(variable, v)"
          />
          <div style="margin-top: 4px;">
            <span style="font-size: 11px; color: var(--light-0);">{{ t('panels.paramsPanel.variablesPanel.keyframes') }}:</span>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
              <n-tag v-for="kf in variable.keyframes" :key="kf.uuid" size="small" type="info">
                {{ kf.value }} → {{ kf.layer }}
              </n-tag>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AddVariableDialog
    v-model:visible="addVariableDialogVisible"
    :layer-names="glyphLayerNames"
    @confirm="handleAddVariable"
  />
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