<script setup lang="ts">
/**
 * 字形组件参数编辑面板
 * 支持字符和字形两种编辑模式
 */

import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NInputNumber,
  NForm,
  NFormItem,
  NInput,
  NEmpty,
  NSlider,
  NSelect,
  NSwitch,
  NIcon,
  NButton,
  NColorPicker,
  NPopover,
  NModal,
  useDialog,
  useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useComponentEditor } from '../composables/useComponentEditor'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { useCharacterGridEditStore } from '@/stores/characterGridEdit'
import { EditStatus, ParameterType, IParameter, ICustomGlyph, IConstant } from '@/core/types'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { expandGlyphComponent } from '@/features/editor/services/FormatGlyphService'
import { roundToPrecision } from '@/utils/number'
import { genUUID } from '@/utils/uuid'
import {
  collectCharacterComponentHits,
  collectProjectConstantUsageHitsAsync,
  collectStandaloneGlyphEditingHits,
  dedupeConstantUsageHitsByComponent,
} from '@/features/editor/globalParam/traverseConstantUsages'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import {
  useEditorConstantsSessionStore,
} from '@/stores/editorConstantsSession'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()

const { selectedComponent, selectedComponentUUID, modifyComponent, editStatus } = useComponentEditor()

const showSetAsModal = ref(false)
const showSelectModal = ref(false)
const dialogTargetParam = ref<IParameter | null>(null)
const setAsConstantName = ref('')
const selectConstantUuid = ref<string | null>(null)

const glyphInstanceFillColor = computed(() => {
  const c = selectedComponent.value
  if (!c || c.type !== 'glyph') return null
  const v = c.fillColor
  return v && String(v).trim() ? v : null
})

const handleGlyphInstanceFillColor = (color: string | null) => {
  if (!selectedComponent.value || selectedComponent.value.type !== 'glyph') return
  const trimmed = color?.trim()
  if (trimmed) {
    modifyComponent({ fillColor: trimmed })
  } else {
    modifyComponent({ fillColor: undefined })
  }
}

const clearGlyphInstanceFillColor = () => handleGlyphInstanceFillColor(null)
const editorStore = useEditorStore()
const characterStore = useCharacterStore()
const glyphStore = useGlyphStore()
const projectStore = useProjectStore()
const characterGridEditStore = useCharacterGridEditStore()
const editorConstantsSession = useEditorConstantsSessionStore()
const { draftVersion } = storeToRefs(editorConstantsSession)

/** 与 VirtualCharacterList / VirtualGlyphList 约定：detail.done 在刷新完成后调用（可能多个 listener 共享同一 done） */
function dispatchForceListRefresh(eventName: string): Promise<void> {
  return Promise.race([
    new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        resolve()
      }
      window.dispatchEvent(new CustomEvent(eventName, { detail: { done } }))
    }),
    new Promise<void>((resolve) => setTimeout(resolve, eventName === 'force-character-list-refresh' ? 800 : 80)),
  ])
}

const getConstantMeta = (uuid: string): IConstant | null => {
  if (editorConstantsSession.active) {
    return editorConstantsSession.getConstantMeta(uuid)
  }
  return projectStore.selectedFile?.constants?.find((c) => c.uuid === uuid) || null
}

const selectableConstantsForDialog = computed((): IConstant[] => {
  const file = projectStore.selectedFile
  const param = dialogTargetParam.value
  if (!param) return []
  const pool = editorConstantsSession.active
    ? editorConstantsSession.workingConstants
    : file?.constants ?? []
  if (!pool.length) return []
  const desiredType =
    param.type === ParameterType.Constant
      ? (getConstantMeta(String(param.value))?.type ?? ParameterType.Number)
      : param.type
  return pool.filter((c) => (c.type ?? ParameterType.Number) === desiredType)
})

watch(
  () => [editStatus.value, projectStore.selectedFileUUID] as const,
  ([status]) => {
    if (status === EditStatus.Edit || status === EditStatus.Glyph) {
      editorConstantsSession.startSession(projectStore.selectedFile)
    } else {
      editorConstantsSession.endSession()
    }
  },
  { immediate: true },
)

watch(showSelectModal, (open) => {
  if (open && selectableConstantsForDialog.value.length) {
    selectConstantUuid.value = selectableConstantsForDialog.value[0].uuid
  }
})

function getCurrentSelectionTree(): string[] {
  if (editStatus.value === EditStatus.Edit) {
    return [...characterStore.selectedComponentsTree]
  }
  if (editStatus.value === EditStatus.Glyph) {
    return [...glyphStore.selectedComponentsTree]
  }
  return []
}

function selectComponentByMode(uuid: string, tree: string[]) {
  if (editStatus.value === EditStatus.Edit) {
    characterStore.selectComponent(uuid, tree)
  } else if (editStatus.value === EditStatus.Glyph) {
    glyphStore.selectComponent(uuid, tree)
  }
}

/** 已调用 cancelEditGlobalForUuid 之后：重算脚本并刷新主画布 / 列表缓存 */
function runCanvasRefreshAfterCancelGlobalDraft(constantUuid: string) {
  const status = editStatus.value
  const ch = characterStore.editingCharacter
  const eg = glyphStore.editingGlyph
  void nextTick().then(async () => {
    if (status === EditStatus.Edit && ch) {
      const hits = dedupeConstantUsageHitsByComponent(
        collectCharacterComponentHits(ch, constantUuid),
      )
      for (const h of hits) {
        if (h.glyph.script || h.glyph.script_reference || h.glyph.skeleton) {
          executeGlyphScript(h.glyph, h.componentUuid)
          if (!instanceManager.isEditing(h.componentUuid)) {
            instanceManager.releaseTemporaryInstance(h.componentUuid)
          }
        }
      }
    } else if (status === EditStatus.Glyph && eg) {
      const hits = dedupeConstantUsageHitsByComponent(
        collectStandaloneGlyphEditingHits(eg, constantUuid),
      )
      for (const h of hits) {
        if (h.glyph.script || h.glyph.script_reference || h.glyph.skeleton) {
          executeGlyphScript(h.glyph, h.componentUuid)
          if (!instanceManager.isEditing(h.componentUuid)) {
            instanceManager.releaseTemporaryInstance(h.componentUuid)
          }
        }
      }
    }
    characterStore.characterListVersion++
    glyphStore.glyphListVersion++
    if (status === EditStatus.Glyph) {
      glyphStore.programmingPreviewTick++
    }
    if (status === EditStatus.Edit) {
      characterGridEditStore.bumpMainCanvasRerender()
      await dispatchForceListRefresh('force-character-list-refresh')
    } else if (status === EditStatus.Glyph) {
      await dispatchForceListRefresh('force-glyph-list-refresh')
    }
  })
}

function isOtherGlobalEditLocking(parameter: IParameter) {
  void draftVersion.value
  if (parameter.type !== ParameterType.Constant) return false
  const self = String(parameter.value)
  const active = editorConstantsSession.getActiveEditingGlobalUuid()
  return !!active && active !== self
}

const selectionSnapshot = ref<{ uuid: string; tree: string[] }>({ uuid: '', tree: [] })
const selectionRevertGuard = ref(false)

watch(
  selectedComponentUUID,
  (newUuid, oldUuid) => {
    if (selectionRevertGuard.value) {
      selectionRevertGuard.value = false
      selectionSnapshot.value = {
        uuid: newUuid ?? '',
        tree: getCurrentSelectionTree(),
      }
      return
    }

    const inPanel = editStatus.value === EditStatus.Edit || editStatus.value === EditStatus.Glyph
    if (!inPanel || !editorConstantsSession.active) {
      selectionSnapshot.value = {
        uuid: newUuid ?? '',
        tree: getCurrentSelectionTree(),
      }
      return
    }

    const activeGlobal = editorConstantsSession.getActiveEditingGlobalUuid()
    if (!activeGlobal) {
      selectionSnapshot.value = {
        uuid: newUuid ?? '',
        tree: getCurrentSelectionTree(),
      }
      return
    }

    if (oldUuid === undefined || newUuid === oldUuid) {
      selectionSnapshot.value = {
        uuid: newUuid ?? '',
        tree: getCurrentSelectionTree(),
      }
      return
    }

    const intended = {
      uuid: newUuid ?? '',
      tree: getCurrentSelectionTree(),
    }
    const snap = selectionSnapshot.value

    selectionRevertGuard.value = true
    selectComponentByMode(snap.uuid, snap.tree)

    dialog.warning({
      title: t('panels.paramsPanel.params.unsavedGlobalEditSwitchSelectionTitle'),
      content: t('panels.paramsPanel.params.unsavedGlobalEditSwitchSelection'),
      positiveText: t('panels.paramsPanel.params.switchSelectionIgnore'),
      negativeText: t('panels.paramsPanel.params.switchSelectionStay'),
      onPositiveClick: () => {
        editorConstantsSession.cancelEditGlobalForUuid(activeGlobal, projectStore.selectedFile)
        runCanvasRefreshAfterCancelGlobalDraft(activeGlobal)
        selectionRevertGuard.value = true
        selectComponentByMode(intended.uuid, intended.tree)
      },
    })
  },
)

onMounted(() => {
  selectionSnapshot.value = {
    uuid: selectedComponentUUID.value || '',
    tree: getCurrentSelectionTree(),
  }
})

function applyToCurrentEmbeddedGlyph(mutate: (gv: ICustomGlyph) => void) {
  const comp = selectedComponent.value
  if (!comp || comp.type !== 'glyph') return
  const gv0 = comp.value as ICustomGlyph
  const gv: ICustomGlyph = {
    ...gv0,
    parameters: (gv0.parameters || []).map((p) => ({ ...p })),
    system_script: gv0.system_script ? { ...gv0.system_script } : undefined,
  }
  mutate(gv)
  modifyComponent({ value: gv })
  void nextTick().then(() => executeGlyphScript(gv, comp.uuid))
}

function buildNewConstantFromParam(param: IParameter, name: string, uuid: string): IConstant | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (param.type === ParameterType.Number) {
    const precision = param.max && param.max <= 10 ? 2 : 0
    return {
      uuid,
      name: trimmed,
      type: ParameterType.Number,
      value: roundToPrecision(Number(param.value), precision),
      min: param.min,
      max: param.max,
    }
  }
  if (param.type === ParameterType.Enum) {
    return {
      uuid,
      name: trimmed,
      type: ParameterType.Enum,
      value: Number(param.value),
      options: param.options ? param.options.map((o) => ({ ...o })) : [],
    }
  }
  if (param.type === ParameterType.Constant) {
    const meta = getConstantMeta(String(param.value))
    if (!meta) return null
    return {
      uuid,
      name: trimmed,
      type: meta.type ?? ParameterType.Number,
      value: meta.value,
      min: meta.min,
      max: meta.max,
      options: meta.options ? meta.options.map((o) => ({ ...o })) : undefined,
      ratio: meta.ratio,
      ratioed: meta.ratioed,
    }
  }
  return null
}

function openSetAsDialog(parameter: IParameter) {
  dialogTargetParam.value = parameter
  setAsConstantName.value = parameter.name
  showSetAsModal.value = true
}

function openSelectDialog(parameter: IParameter) {
  dialogTargetParam.value = parameter
  showSelectModal.value = true
}

function confirmSetAsGlobal() {
  const param = dialogTargetParam.value
  const file = projectStore.selectedFile
  if (!param || !file) return
  if (!setAsConstantName.value.trim()) {
    message.warning(t('panels.paramsPanel.params.emptyConstantName'))
    return
  }
  const newUuid = genUUID()
  const constant = buildNewConstantFromParam(param, setAsConstantName.value, newUuid)
  if (!constant) {
    message.warning(t('panels.paramsPanel.params.cannotCreateGlobalFromParam'))
    return
  }
  if (!file.constants) file.constants = []
  file.constants.push(constant)
  applyToCurrentEmbeddedGlyph((gv) => {
    const idx = gv.parameters.findIndex((p) => p.uuid === param.uuid)
    if (idx < 0) return
    gv.parameters[idx] = {
      ...gv.parameters[idx],
      type: ParameterType.Constant,
      value: newUuid,
    }
    if (gv.system_script && param.name in gv.system_script) {
      delete gv.system_script[param.name]
    }
  })
  projectStore.markFileUnsaved(file.uuid)
  editorConstantsSession.onNewConstantAppended(constant)
  showSetAsModal.value = false
  dialogTargetParam.value = null
}

function confirmSelectGlobal() {
  const param = dialogTargetParam.value
  const file = projectStore.selectedFile
  const uuidPick = selectConstantUuid.value
  if (!param || !file || !uuidPick) {
    if (!selectableConstantsForDialog.value.length) {
      message.warning(t('panels.paramsPanel.params.noMatchingGlobalParam'))
    }
    return
  }
  applyToCurrentEmbeddedGlyph((gv) => {
    const idx = gv.parameters.findIndex((p) => p.uuid === param.uuid)
    if (idx < 0) return
    gv.parameters[idx] = {
      ...gv.parameters[idx],
      type: ParameterType.Constant,
      value: uuidPick,
    }
    if (gv.system_script && param.name in gv.system_script) {
      delete gv.system_script[param.name]
    }
  })
  projectStore.markFileUnsaved(file.uuid)
  showSelectModal.value = false
  dialogTargetParam.value = null
}

function handleCancelGlobalParam(parameter: IParameter) {
  if (parameter.type !== ParameterType.Constant) return
  const meta = getConstantMeta(String(parameter.value))
  if (!meta) return
  const file = projectStore.selectedFile
  applyToCurrentEmbeddedGlyph((gv) => {
    const idx = gv.parameters.findIndex((p) => p.uuid === parameter.uuid)
    if (idx < 0) return
    const p = gv.parameters[idx]
    gv.parameters[idx] = {
      ...p,
      type: meta.type ?? ParameterType.Number,
      value: meta.value,
      min: meta.min,
      max: meta.max,
      options: meta.options ? meta.options.map((o) => ({ ...o })) : undefined,
      ratio: meta.ratio,
      ratioed: meta.ratioed,
    }
    if (gv.system_script && parameter.name in gv.system_script) {
      delete gv.system_script[parameter.name]
    }
  })
  if (file) projectStore.markFileUnsaved(file.uuid)
}

async function handleUpdateGlobalParam(parameter: IParameter) {
  if (parameter.type !== ParameterType.Constant) return
  const file = projectStore.selectedFile
  if (!file) return
  const constantUuid = String(parameter.value)
  editorConstantsSession.mergeConstantToFile(constantUuid, file)
  projectStore.markFileUnsaved(file.uuid)

  const charList = file.characterList ?? []
  const scanTotal = Math.max(1, charList.length + 1)

  projectStore.loading = true
  projectStore.loadingTotal = scanTotal
  projectStore.loadingProgress = 0
  projectStore.loadingMessage =
    charList.length === 0
      ? t('panels.paramsPanel.params.globalParamUpdateScanGlyphs')
      : t('panels.paramsPanel.params.globalParamUpdateScanCharacters', {
          current: 0,
          total: charList.length,
        })

  let hits: Awaited<ReturnType<typeof collectProjectConstantUsageHitsAsync>> = []
  try {
    hits = await collectProjectConstantUsageHitsAsync({
      file,
      constantUuid,
      editingCharacter: characterStore.editingCharacter,
      loadCharacter: (f, u) => characterDataManager.loadCharacter(f, u),
      onScanProgress: (done, total) => {
        projectStore.loadingProgress = done
        projectStore.loadingTotal = total
        if (charList.length === 0) {
          projectStore.loadingMessage = t('panels.paramsPanel.params.globalParamUpdateScanGlyphs')
        } else if (done <= charList.length) {
          projectStore.loadingMessage = t('panels.paramsPanel.params.globalParamUpdateScanCharacters', {
            current: done,
            total: charList.length,
          })
        } else {
          projectStore.loadingMessage = t('panels.paramsPanel.params.globalParamUpdateScanGlyphs')
        }
      },
    })
  } catch (e) {
    console.error('[handleUpdateGlobalParam] scan failed', e)
    message.error(String((e as Error)?.message || e))
  }

  const execTotal = Math.max(1, hits.length)
  projectStore.loadingTotal = execTotal
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = t('panels.paramsPanel.params.globalParamUpdateProgress')

  try {
    if (hits.length === 0) {
      projectStore.loadingProgress = 1
    }
    let lastYieldTime = performance.now()
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i]
      // 无脚本且无骨架的字形：executeGlyphScript 只会 clear() _components 而不填充，
      // 跳过以避免清空实例组件并触发渲染器死循环
      if (h.glyph.script || h.glyph.script_reference || h.glyph.skeleton) {
        executeGlyphScript(h.glyph, h.componentUuid)
        // 释放本次为更新创建的临时实例，避免 temporaryInstances 无限增长
        if (!instanceManager.isEditing(h.componentUuid)) {
          instanceManager.releaseTemporaryInstance(h.componentUuid)
        }
      }
      projectStore.loadingProgress = i + 1
      projectStore.loadingMessage =
        t('panels.paramsPanel.params.globalParamUpdateProgress') +
        ' ' +
        t('panels.paramsPanel.params.globalParamUpdateProgressDetail', {
          current: i + 1,
          total: hits.length,
        })
      // 时间驱动的让步：每 ~16ms 让出主线程，让浏览器有机会重绘进度条
      const now = performance.now()
      if (now - lastYieldTime >= 16) {
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        lastYieldTime = performance.now()
      }
    }
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }

  characterStore.characterListVersion++
  glyphStore.glyphListVersion++
  if (editStatus.value === EditStatus.Glyph) {
    glyphStore.programmingPreviewTick++
  }
  if (editStatus.value === EditStatus.Edit) {
    characterGridEditStore.bumpMainCanvasRerender()
    await dispatchForceListRefresh('force-character-list-refresh')
  } else if (editStatus.value === EditStatus.Glyph) {
    await dispatchForceListRefresh('force-glyph-list-refresh')
  }
  editorConstantsSession.clearEditingModeForUuid(constantUuid)
  editorConstantsSession.syncWorkingFromFile(projectStore.selectedFile)
  await nextTick()
}

function handleGlobalParamPrimaryAction(parameter: IParameter) {
  if (parameter.type !== ParameterType.Constant) return
  const uuid = String(parameter.value)
  if (!editorConstantsSession.isEditingGlobal(uuid)) {
    editorConstantsSession.beginEditGlobal(uuid)
    return
  }
  void handleUpdateGlobalParam(parameter)
}

function handleCancelEditGlobalDraft(parameter: IParameter) {
  if (parameter.type !== ParameterType.Constant) return
  const constantUuid = String(parameter.value)
  editorConstantsSession.cancelEditGlobalForUuid(constantUuid, projectStore.selectedFile)
  runCanvasRefreshAfterCancelGlobalDraft(constantUuid)
}

function isConstantControlsLocked(parameter: IParameter) {
  if (parameter.type !== ParameterType.Constant) return true
  return !editorConstantsSession.isEditingGlobal(String(parameter.value))
}

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
  void draftVersion.value
  if (param.type !== ParameterType.Constant) {
    return param.value
  }

  const uuidValue = String(param.value)
  if (editorConstantsSession.active) {
    const v = editorConstantsSession.draftConstantsMap.getByUUID(uuidValue)
    if (v !== undefined) return v
  }

  const constantsMap = projectStore.constantsMap
  if (constantsMap && typeof constantsMap.getByUUID === 'function') {
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
  
  // 如果是数值类型，限制精度
  let processedValue: number | string = value
  if (typeof value === 'number' && parameter.type === ParameterType.Number) {
    // 根据参数的最大值决定精度：如果 max <= 10，使用2位小数，否则使用0位小数
    const precision = parameter.max && parameter.max <= 10 ? 2 : 0
    processedValue = roundToPrecision(value, precision)
  }
  
  // 如果是 Constant 类型，更新工作副本中的常量（仅「编辑全局变量」模式下；提交前不写 file.constants）
  if (parameter.type === ParameterType.Constant) {
    const constantUUID = String(parameter.value)
    const numericValue = typeof processedValue === 'number' ? processedValue : Number(processedValue)
    const precision = parameter.max && parameter.max <= 10 ? 2 : 0
    const roundedValue = roundToPrecision(numericValue, precision)

    if (editorConstantsSession.active) {
      if (!editorConstantsSession.isEditingGlobal(constantUUID)) return
      editorConstantsSession.updateWorkingConstant(constantUUID, roundedValue)
    } else {
      const constantsMap = projectStore.constantsMap
      if (constantsMap) {
        constantsMap.updateConstantValue(constantUUID, roundedValue)
        if (projectStore.selectedFile?.constants) {
          const constant = projectStore.selectedFile.constants.find((c) => c.uuid === constantUUID)
          if (constant) {
            constant.value = roundedValue
          }
        }
      }
    }
  } else {
    // 对于非 Constant 类型，更新参数值
    const param = glyphValue.parameters.find(p => p.uuid === parameter.uuid)
    if (!param) {
      return
    }
    
    param.value = processedValue
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
    executeGlyphScript(updatedGlyphValue, selectedComponent.value.uuid)
    
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
  // 限制精度为1位小数（与 input-number 的 precision="1" 保持一致）
  modifyComponent({ ox: roundToPrecision(ox, 1) })
}

const handleChangeOY = (oy: number | null) => {
  if (oy === null || !selectedComponentUUID.value) return
  // 限制精度为1位小数（与 input-number 的 precision="1" 保持一致）
  modifyComponent({ oy: roundToPrecision(oy, 1) })
}

const handleChangeName = (name: string) => {
  if (!selectedComponentUUID.value) return
  modifyComponent({ name })
}

const handleFormatGlyphComponent = () => {
  if (!selectedComponent.value || selectedComponent.value.type !== 'glyph') {
    dialog.warning({
      title: t('panels.paramsPanel.formatComponent.title'),
      content:
        '请先选择一个字形组件。格式化会把脚本字形组件转换为普通轮廓组件，此操作不可撤销，继续前请确认已保存工程。',
      positiveText: '确定',
    })
    return
  }

  const glyphComponent = selectedComponent.value as any
  const { components, orderedItems } = expandGlyphComponent(glyphComponent)

  if (!components.length) {
    dialog.warning({
      title: t('panels.paramsPanel.formatComponent.title'),
      content:
        '该字形组件没有可转换的轮廓组件。格式化只对由脚本生成的笔画/几何组件生效。',
      positiveText: '确定',
    })
    return
  }

  dialog.warning({
    title: t('panels.paramsPanel.formatComponent.title'),
    content:
      '格式化会把当前选中的脚本字形组件转换为一组普通轮廓组件，并删除原脚本及参数，无法自动还原。是否继续？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (editStatus.value === EditStatus.Edit) {
        characterStore.replaceGlyphComponentWithComponents(
          glyphComponent.uuid,
          components as any,
          orderedItems,
        )
        await nextTick()
        characterStore.updateCharacterListFromEditFile()
      } else if (editStatus.value === EditStatus.Glyph) {
        glyphStore.replaceGlyphComponentWithComponents(
          glyphComponent.uuid,
          components as any,
          orderedItems,
        )
        await nextTick()
        glyphStore.updateGlyphListFromEditFile()
      }
      projectStore.markFileUnsaved(projectStore.selectedFile!.uuid)
    },
  })
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
              <div class="glyph-param-block">
                <div class="param-inputs-grow">
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
                <n-popover trigger="click" placement="right" :width="260">
                  <template #trigger>
                    <span class="constant-note constant-note--trigger constant-note--local">
                      <span class="constant-note-text constant-note-text--local">{{ t('panels.paramsPanel.params.localVariableNote') }}</span>
                      <span class="constant-note-icon">
                        <n-icon>
                          <font-awesome-icon :icon="['fas', 'pen-to-square']" />
                        </n-icon>
                      </span>
                    </span>
                  </template>
                  <div class="global-param-popover-actions">
                    <n-button block size="small" @click="openSetAsDialog(parameter)">
                      {{ t('panels.paramsPanel.setAsGlobalParam') }}
                    </n-button>
                    <n-button block size="small" @click="openSelectDialog(parameter)">
                      {{ t('panels.paramsPanel.selectGlobalParam') }}
                    </n-button>
                  </div>
                </n-popover>
              </div>
            </template>
            
            <!-- Enum 类型参数 -->
            <template v-else-if="parameter.type === ParameterType.Enum">
              <div class="glyph-param-block">
                <n-select
                  class="enum-select-grow"
                  :value="parameter.value"
                  :options="parameter.options?.map(opt => ({ label: opt.label, value: opt.value })) || []"
                  @update:value="(v) => handleChangeParameter(parameter, v)"
                />
                <n-popover trigger="click" placement="right" :width="260">
                  <template #trigger>
                    <span class="constant-note constant-note--trigger constant-note--local">
                      <span class="constant-note-text constant-note-text--local">{{ t('panels.paramsPanel.params.localVariableNote') }}</span>
                      <span class="constant-note-icon">
                        <n-icon>
                          <font-awesome-icon :icon="['fas', 'pen-to-square']" />
                        </n-icon>
                      </span>
                    </span>
                  </template>
                  <div class="global-param-popover-actions">
                    <n-button block size="small" @click="openSetAsDialog(parameter)">
                      {{ t('panels.paramsPanel.setAsGlobalParam') }}
                    </n-button>
                    <n-button block size="small" @click="openSelectDialog(parameter)">
                      {{ t('panels.paramsPanel.selectGlobalParam') }}
                    </n-button>
                  </div>
                </n-popover>
              </div>
            </template>
            
            <!-- Constant 类型参数（显示常量值，可编辑但不更新列表；按常量自身 type 渲染） -->
            <template v-else-if="parameter.type === ParameterType.Constant">
              <div class="glyph-param-block">
                <template v-if="getConstantMeta(String(parameter.value))?.type === ParameterType.Enum">
                  <n-select
                    :value="getConstantValue(parameter) as any"
                    :disabled="isConstantControlsLocked(parameter)"
                    :options="getConstantMeta(String(parameter.value))?.options?.map((opt: any) => ({ label: opt.label, value: opt.value })) || []"
                    @update:value="(v) => handleChangeParameter(parameter, Number(v))"
                  />
                </template>
                <template v-else>
                  <n-input-number
                    :value="getConstantValue(parameter) as number"
                    :disabled="isConstantControlsLocked(parameter)"
                    :step="(getConstantMeta(String(parameter.value))?.max ?? parameter.max) && (getConstantMeta(String(parameter.value))?.max ?? parameter.max) <= 10 ? 0.01 : 1"
                    :min="getConstantMeta(String(parameter.value))?.min ?? parameter.min"
                    :max="getConstantMeta(String(parameter.value))?.max ?? parameter.max"
                    :precision="(getConstantMeta(String(parameter.value))?.max ?? parameter.max) && (getConstantMeta(String(parameter.value))?.max ?? parameter.max) <= 10 ? 2 : 0"
                    @update:value="(v) => handleChangeParameter(parameter, v ?? 0)"
                  />
                  <n-slider
                    :value="getConstantValue(parameter) as number"
                    :disabled="isConstantControlsLocked(parameter)"
                    :step="(getConstantMeta(String(parameter.value))?.max ?? parameter.max) && (getConstantMeta(String(parameter.value))?.max ?? parameter.max) <= 10 ? 0.01 : 1"
                    :min="getConstantMeta(String(parameter.value))?.min ?? (parameter.min ?? 0)"
                    :max="getConstantMeta(String(parameter.value))?.max ?? (parameter.max ?? 100)"
                    :precision="(getConstantMeta(String(parameter.value))?.max ?? parameter.max) && (getConstantMeta(String(parameter.value))?.max ?? parameter.max) <= 10 ? 2 : 0"
                    @update:value="(v) => handleChangeParameter(parameter, v)"
                    style="width: 100%; margin-top: 8px;"
                  />
                </template>
                <n-popover trigger="click" placement="right" :width="260">
                  <template #trigger>
                    <span class="constant-note constant-note--trigger constant-note--global">
                      <span class="constant-note-text constant-note-text--global">{{ t('panels.paramsPanel.params.globalConstantNote') }}</span>
                      <span class="constant-note-icon">
                        <n-icon>
                          <font-awesome-icon :icon="['fas', 'pen-to-square']" />
                        </n-icon>
                      </span>
                    </span>
                  </template>
                  <div class="global-param-popover-actions">
                    <n-button block size="small" @click="handleCancelGlobalParam(parameter)">
                      {{ t('panels.paramsPanel.cancelGlobalParam') }}
                    </n-button>
                    <n-button block size="small" @click="openSetAsDialog(parameter)">
                      {{ t('panels.paramsPanel.setAsGlobalParam') }}
                    </n-button>
                    <n-button block size="small" @click="openSelectDialog(parameter)">
                      {{ t('panels.paramsPanel.selectGlobalParam') }}
                    </n-button>
                    <n-button
                      v-if="editorConstantsSession.isEditingGlobal(String(parameter.value))"
                      block
                      size="small"
                      @click="handleCancelEditGlobalDraft(parameter)"
                    >
                      {{ t('panels.paramsPanel.params.cancelEditGlobalParam') }}
                    </n-button>
                    <n-button
                      type="primary"
                      block
                      size="small"
                      :disabled="isOtherGlobalEditLocking(parameter)"
                      @click="handleGlobalParamPrimaryAction(parameter)"
                    >
                      {{
                        editorConstantsSession.isEditingGlobal(String(parameter.value))
                          ? t('panels.paramsPanel.updateGlobalParam')
                          : t('panels.paramsPanel.params.editGlobalParam')
                      }}
                    </n-button>
                  </div>
                </n-popover>
              </div>
            </template>
          </n-form-item>
        </n-form>
      </div>

      <div
        class="fill-color-wrap"
        v-if="
          editStatus === EditStatus.Edit &&
          selectedComponent &&
          selectedComponent.type === 'glyph'
        "
      >
        <div class="section-title">{{ t('panels.paramsPanel.fillColor.title') }}</div>
        <p class="fill-color-hint">{{ t('panels.paramsPanel.fillColor.hint') }}</p>
        <n-form label-placement="left" label-width="80px">
          <n-form-item :label="t('panels.paramsPanel.fillColor.label')" :show-feedback="false">
            <div class="fill-color-row">
              <div class="params-fill-color-wrap">
                <n-color-picker
                  size="small"
                  :value="glyphInstanceFillColor"
                  :show-alpha="true"
                  @update:value="handleGlyphInstanceFillColor"
                />
              </div>
              <n-button size="small" quaternary @click="clearGlyphInstanceFillColor">
                {{ t('panels.paramsPanel.fillColor.clear') }}
              </n-button>
            </div>
          </n-form-item>
        </n-form>
      </div>

      <!-- 格式化字形组件 -->
      <div
        class="format-component-wrap"
        v-if="selectedComponent && selectedComponent.type === 'glyph'"
      >
        <div class="section-title">
          {{ t('panels.paramsPanel.formatComponent.title') }}
        </div>
        <n-button
          type="warning"
          block
          class="format-button"
          @click="handleFormatGlyphComponent"
        >
          {{ t('panels.paramsPanel.formatComponent.button') }}
        </n-button>
      </div>
    </template>
    
    <div v-else class="empty-state">
      <n-empty :description="t('panels.paramsPanel.params.glyphPanelNoSelection')" />
    </div>

    <n-modal
      v-model:show="showSetAsModal"
      preset="dialog"
      :title="t('dialogs.setAsGlobalParamDialog.title')"
      :style="{ width: '360px' }"
    >
      <n-form label-placement="left" label-width="88">
        <n-form-item :label="t('dialogs.setAsGlobalParamDialog.paramName')">
          <n-input v-model:value="setAsConstantName" :maxlength="100" show-count @keyup.enter="confirmSetAsGlobal" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showSetAsModal = false">{{ t('dialogs.setAsGlobalParamDialog.cancel') }}</n-button>
        <n-button type="primary" @click="confirmSetAsGlobal">{{ t('dialogs.setAsGlobalParamDialog.confirm') }}</n-button>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showSelectModal"
      preset="dialog"
      :title="t('dialogs.selectGlobalParamDialog.title')"
      :style="{ width: '360px' }"
    >
      <n-form label-placement="left" label-width="88">
        <n-form-item :label="t('dialogs.selectGlobalParamDialog.globalParam')">
          <n-select
            v-model:value="selectConstantUuid"
            :options="selectableConstantsForDialog.map((c) => ({ label: c.name, value: c.uuid }))"
            :placeholder="t('dialogs.selectGlobalParamDialog.globalParam')"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showSelectModal = false">{{ t('dialogs.selectGlobalParamDialog.cancel') }}</n-button>
        <n-button type="primary" @click="confirmSelectGlobal">{{ t('dialogs.selectGlobalParamDialog.confirm') }}</n-button>
      </template>
    </n-modal>
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

.param-inputs-grow {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.enum-select-grow {
  width: 100%;
  min-width: 0;
}

.global-param-popover-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.glyph-param-block {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}

.glyph-param-block .n-input-number {
  width: 100%;
}

.glyph-param-block .n-slider {
  width: 100%;
}

.glyph-param-block .enum-select-grow {
  width: 100%;
}

.constant-note {
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  margin-top: 8px;
}

.constant-note--global {
  color: #7a2703;
}

.constant-note--local {
  color: var(--primary-0);
}

.constant-note :deep(.n-icon) {
  font-size: 14px !important;
}

.constant-note--trigger {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.constant-note-text {
  margin-right: 5px;
}

.constant-note-text--global {
  color: #7a2703;
}

.constant-note-text--local {
  color: var(--primary-0);
}

.format-component-wrap {
  margin-top: 24px;
}

.format-button {
  margin-top: 8px;
}

.fill-color-hint {
  margin: -12px 0 6px 0;
  font-size: 12px;
  color: var(--n-text-color-3);
  line-height: 1.4;
}

.fill-color-wrap {
  margin-bottom: 0;
}

.fill-color-wrap :deep(.n-form) {
  margin-bottom: 0;
}

.fill-color-wrap :deep(.n-form-item) {
  margin-bottom: 0 !important;
}

.fill-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.fill-color-row :deep(.params-fill-color-wrap) {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.fill-color-row :deep(.params-fill-color-wrap .n-color-picker) {
  width: 28px !important;
  height: 28px !important;
  max-height: 28px;
}

.fill-color-row :deep(.params-fill-color-wrap .n-color-picker-trigger) {
  height: 100% !important;
  min-height: 0;
  box-sizing: border-box;
}

.fill-color-row :deep(.params-fill-color-wrap .n-color-picker-trigger__value) {
  display: none !important;
}

.fill-color-row :deep(.n-button.n-button--small-type) {
  flex-shrink: 0;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}
</style>