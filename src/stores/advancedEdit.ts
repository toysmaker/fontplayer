/**
 * 高级编辑：样例预览、全局常量、笔画替换、风格切换、脚本批处理（无 _o，仅用 InstanceManager / executeGlyphScript）
 */

import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import * as R from 'ramda'
import type {
  ICharacterFileLite,
  IComponent,
  IConstant,
  ICustomGlyph,
  IGlyphComponent,
} from '@/core/types'
import { ParameterType } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import { ConstantsMap } from '@/core/script/ConstantsMap'
import { getGlobalConstantsMap, setGlobalConstantsMap } from '@/core/script/ParametersMap'
import { orderedListWithItemsForCharacterFile } from '@/features/editor/services/FormatGlyphService'
import { ContourConverter } from '@/core/font/converter'
import { renderAdvancedEditPreview } from '@/core/canvas/advancedEditPreview'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { orderedListWithItemsForGlyph } from '@/core/utils/glyph'

export const PanelType = {
  GlobalVariables: 'globalVariables',
  ConditionFilter: 'conditionFilter',
  Script: 'script',
  StrokeReplace: 'strokeReplace',
  StyleSwitch: 'styleSwitch',
} as const

export type PanelTypeId = (typeof PanelType)[keyof typeof PanelType]

/** 字形参数可能是扁平数组，也可能是 `{ parameters: [...] }`（与 CustomGlyph 构造函数一致） */
function parameterRowsForGlyph(g: ICustomGlyph): Array<{ type: ParameterType; name: string; value: unknown }> | undefined {
  const raw = g.parameters as unknown
  if (!raw) return undefined
  if (Array.isArray(raw)) return raw as Array<{ type: ParameterType; name: string; value: unknown }>
  const inner = (raw as { parameters?: unknown }).parameters
  if (Array.isArray(inner)) return inner as Array<{ type: ParameterType; name: string; value: unknown }>
  return undefined
}

function rewriteGlyphParamsForAdvancedPreview(root: ICharacterFileLite) {
  const walkGlyph = (g: ICustomGlyph) => {
    const params = parameterRowsForGlyph(g)
    if (params) {
      for (const p of params) {
        if (p.type === ParameterType.Constant) {
          p.type = ParameterType.AdvancedEditConstant
        }
      }
    }
    for (const c of g.components || []) {
      if (c.type === 'glyph' && c.value) {
        walkGlyph(c.value as ICustomGlyph)
      }
    }
  }
  for (const comp of root.components || []) {
    if (comp.type === 'glyph' && comp.value) {
      walkGlyph(comp.value as ICustomGlyph)
    }
  }
}

export const useAdvancedEditStore = defineStore('advancedEdit', () => {
  const projectStore = useProjectStore()
  const characterStore = useCharacterStore()
  const editorStore = useEditorStore()

  const activePanel = ref<PanelTypeId>(PanelType.GlobalVariables)
  const sampleCharacters = ref('白日依山尽黄河入海流欲穷千里目更上一层楼')
  const isEditingSample = ref(false)
  const constants = ref<IConstant[]>([])
  const advancedConstantsMap = ConstantsMap.createLocal([])

  const sampleCharactersList = ref<ICharacterFileLite[]>([])
  const originSampleCharactersList = ref<ICharacterFileLite[]>([])

  const strokeMap = new Map<string, ICustomGlyph>()
  const strokeList = ref<
    Array<{
      uuid: string
      name: string
      style?: string
      replaced: boolean
      replacement: { uuid: string; name: string; style?: string } | null
      currentUUID: string
    }>
  >([])
  const selectedStrokeUUID = ref<string | null>(null)
  const onStrokeReplacement = ref(false)
  const selectedStroke = computed(() =>
    strokeList.value.find((s) => s.uuid === selectedStrokeUUID.value),
  )

  const selectedStyleUUID = ref('default')
  const styles = ref<
    Array<{
      uuid: string
      name: string
      strokeStyle: string
      constants: Array<{ name: string; value: number }>
      parameters: Array<{ name: string; value: number; min?: number; max?: number; type?: ParameterType }>
    }>
  >([])

  function setActivePanel(p: PanelTypeId) {
    activePanel.value = p
  }

  function restoreProjectConstantsMap() {
    const list = projectStore.selectedFile?.constants
    const cm = ConstantsMap.getInstance(list && list.length ? list : [])
    setGlobalConstantsMap(cm)
  }

  function runWithAdvancedConstantsMap<T>(fn: () => T): T {
    advancedConstantsMap.update(constants.value)
    const prev = getGlobalConstantsMap()
    setGlobalConstantsMap(advancedConstantsMap)
    try {
      return fn()
    } finally {
      if (prev) setGlobalConstantsMap(prev)
    }
  }

  function getFontMetrics() {
    const fs = projectStore.selectedFile?.fontSettings
    return {
      unitsPerEm: fs?.unitsPerEm ?? 1000,
      descender: fs?.descender ?? -200,
      advanceWidth: fs?.advanceWidth ?? fs?.unitsPerEm ?? 1000,
    }
  }

  function renderCharacterPreview(char: ICharacterFileLite, canvas: HTMLCanvasElement) {
    const m = getFontMetrics()
    runWithAdvancedConstantsMap(() => {
      const ordered = orderedListWithItemsForCharacterFile(char)
      const contours = ContourConverter.componentsToContours(
        ordered,
        {
          ...m,
          preview: true,
          forceUpdate: true,
          advancedEdit: true,
        },
        { x: 0, y: 0 },
      )
      const fillColors = ContourConverter.getFillColors(ordered as IComponent[])
      renderAdvancedEditPreview(
        canvas,
        contours,
        fillColors,
        projectStore.fontPreviewStyle,
      )
    })
  }

  async function updateSampleCharactersList() {
    const file = projectStore.selectedFile
    if (!file) {
      sampleCharactersList.value = []
      originSampleCharactersList.value = []
      return
    }
    const textSet = new Set(Array.from(sampleCharacters.value))
    const list: ICharacterFileLite[] = []
    for (const meta of file.characterList) {
      if (!textSet.has(meta.character.text)) continue
      const full = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      if (!full) continue
      const clone = R.clone(full) as ICharacterFileLite
      rewriteGlyphParamsForAdvancedPreview(clone)
      list.push(clone)
    }
    sampleCharactersList.value = list
    originSampleCharactersList.value = R.clone(list)
  }

  function updateCharactersAndPreview() {
    for (const character of sampleCharactersList.value) {
      const canvas = document.getElementById(
        `advanced-edit-preview-canvas-${character.uuid}`,
      ) as HTMLCanvasElement | null
      if (!canvas) continue
      renderCharacterPreview(character, canvas)
    }
  }

  async function updatePreviewList() {
    await nextTick()
    await updateSampleCharactersList()
    await nextTick()
    for (const character of sampleCharactersList.value) {
      const canvas = document.getElementById(
        `advanced-edit-preview-canvas-${character.uuid}`,
      ) as HTMLCanvasElement | null
      if (!canvas) continue
      renderCharacterPreview(character, canvas)
    }
  }

  async function applyConstantsToEntireProject() {
    const file = projectStore.selectedFile
    if (!file) return
    file.constants = R.clone(constants.value)
    projectStore.markFileUnsaved(file.uuid)
    restoreProjectConstantsMap()
    await characterStore.invalidateAllCachedCharacterPreviews()
  }

  function getGlyphByUUID(uuid: string): ICustomGlyph | undefined {
    const f = projectStore.selectedFile
    if (!f) return undefined
    const pools = [f.stroke_glyphs, f.glyphs, f.radical_glyphs, f.comp_glyphs]
    for (const pool of pools) {
      const g = pool?.find((x) => x.uuid === uuid)
      if (g) return g
    }
    return undefined
  }

  async function getStrokeListFromProject() {
    strokeMap.clear()
    strokeList.value = []
    const file = projectStore.selectedFile
    if (!file) return
    const seen = new Set<string>()
    for (const meta of file.characterList) {
      const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      if (!ch) continue
      for (const comp of ch.components || []) {
        if (comp.type !== 'glyph') continue
        const uuid = (comp.value as ICustomGlyph).uuid
        if (seen.has(uuid)) continue
        const glyph = getGlyphByUUID(uuid)
        if (!glyph) continue
        seen.add(uuid)
        strokeMap.set(uuid, glyph)
        strokeList.value.push({
          uuid,
          name: glyph.name,
          style: glyph.style,
          replaced: false,
          replacement: null,
          currentUUID: uuid,
        })
      }
    }
  }

  function renderStrokePreviewCanvas(uuid?: string) {
    const targets = uuid
      ? strokeList.value.filter((s) => s.uuid === uuid)
      : strokeList.value
    for (const stroke of targets) {
      const key = stroke.replaced && stroke.replacement ? stroke.replacement.uuid : stroke.uuid
      const glyph = strokeMap.get(key)
      if (!glyph) continue
      const canvases = document.querySelectorAll<HTMLCanvasElement>(
        `.stroke-preview-${stroke.uuid}`,
      )
      const ordered = orderedListWithItemsForGlyph(R.clone(glyph))
      const contours = ContourConverter.componentsToContours(ordered as IComponent[], {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
        preview: true,
        forceUpdate: true,
        isGlyph: true,
      }, { x: 0, y: 0 })
      const fillColors = ContourConverter.getFillColors(ordered as IComponent[])
      canvases.forEach((canvas) => {
        renderAdvancedEditPreview(canvas, contours, fillColors, projectStore.fontPreviewStyle)
      })
    }
  }

  async function setReplacementStroke(templateUuid: string) {
    const sel = strokeList.value.find((s) => s.uuid === selectedStrokeUUID.value)
    if (!sel) return
    const targetGlyph = getGlyphByUUID(templateUuid)
    if (!targetGlyph) return
    if (sel.replaced) sel.currentUUID = sel.replacement!.uuid
    sel.replaced = true
    strokeMap.set(templateUuid, targetGlyph)
    sel.replacement = {
      uuid: templateUuid,
      name: targetGlyph.name,
      style: targetGlyph.style,
    }
    await refreshStrokeReplacePreviews()
    await nextTick()
    renderStrokePreviewCanvas(sel.uuid)
  }

  function replaceStrokeForCharacter(characterFile: ICharacterFileLite, stroke: (typeof strokeList.value)[0]) {
    const originUUID = stroke.uuid
    const targetUUID = stroke.replacement!.uuid
    const targetStrokeGlyph = R.clone(strokeMap.get(targetUUID)!)
    for (let i = 0; i < characterFile.components.length; i++) {
      const component = characterFile.components[i]
      const gc = component as IGlyphComponent
      const cur = gc.value as ICustomGlyph
      if (component.type === 'glyph' && cur.uuid === originUUID) {
        const glyph = targetStrokeGlyph
        const destParams = ((glyph.parameters as { parameters?: any[] })?.parameters) || []
        const srcParams =
          (cur.parameters as { parameters?: any[] } | undefined)?.parameters || []
        for (let j = 0; j < destParams.length; j++) {
          const parameter = destParams[j]
          const originParameter = srcParams.find((q: { name: string }) => q.name === parameter.name)
          if (!originParameter) continue
          if (
            originParameter.type !== ParameterType.Constant &&
            originParameter.type !== ParameterType.AdvancedEditConstant
          ) {
            parameter.value = originParameter.value
          } else if (originParameter.type === ParameterType.AdvancedEditConstant) {
            parameter.type = ParameterType.AdvancedEditConstant
            parameter.value = originParameter.value
          } else if (originParameter.type === ParameterType.Constant) {
            parameter.type = ParameterType.Constant
            parameter.value = originParameter.value
          }
        }
        gc.value = glyph
        executeGlyphScript(glyph, component.uuid)
      }
    }
  }

  async function refreshStrokeReplacePreviews() {
    await updateSampleCharactersList()
    const next: ICharacterFileLite[] = []
    for (const orig of originSampleCharactersList.value) {
      const c = R.clone(orig)
      for (const s of strokeList.value) {
        if (s.replaced) replaceStrokeForCharacter(c, s)
      }
      next.push(c)
    }
    sampleCharactersList.value = next
    await nextTick()
    runWithAdvancedConstantsMap(() => {
      for (const character of sampleCharactersList.value) {
        const canvas = document.getElementById(
          `advanced-edit-preview-canvas-${character.uuid}`,
        ) as HTMLCanvasElement | null
        if (!canvas) continue
        const m = getFontMetrics()
        const ordered = orderedListWithItemsForCharacterFile(character)
        const contours = ContourConverter.componentsToContours(
          ordered,
          { ...m, preview: true, forceUpdate: true, advancedEdit: true },
          { x: 0, y: 0 },
        )
        const fillColors = ContourConverter.getFillColors(ordered as IComponent[])
        renderAdvancedEditPreview(canvas, contours, fillColors, projectStore.fontPreviewStyle)
      }
    })
  }

  async function applyStrokeReplacementsToAll() {
    const file = projectStore.selectedFile
    if (!file) return
    for (const meta of file.characterList) {
      const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      if (!ch) continue
      for (const s of strokeList.value) {
        if (s.replaced) replaceStrokeForCharacter(ch, s)
      }
      await characterDataManager.updateCharacter(file.uuid, ch)
    }
    projectStore.markFileUnsaved(file.uuid)
    await characterStore.invalidateAllCachedCharacterPreviews()
  }

  function getStrokeListByStyle(strokeStyle: string): ICustomGlyph[] {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs) return []
    return f.stroke_glyphs.filter((g) => g.style === strokeStyle)
  }

  function mergeStyleConstantsInto(target: IConstant[], style: (typeof styles.value)[0]) {
    for (const c of target) {
      for (const sc of style.constants) {
        if (c.name === sc.name) c.value = sc.value
      }
    }
  }

  /** 仅替换笔画参数（不修改面板 constants）；预览时配合临时 global constants map */
  function applyStyleStrokeReplacementsToCharacter(
    characterFile: ICharacterFileLite,
    style: (typeof styles.value)[0] | undefined,
  ) {
    if (!style) return
    const strokeListByStyle = getStrokeListByStyle(style.strokeStyle)
    for (const strokeGlyph of strokeListByStyle) {
      const strokeName = strokeGlyph.name
      for (const comp of characterFile.components) {
        if (comp.type !== 'glyph') continue
        const gc = comp as IGlyphComponent
        const cur = gc.value as ICustomGlyph
        if (cur.name !== strokeName) continue
        const glyph = R.clone(strokeGlyph)
        const params = ((glyph.parameters as { parameters?: any[] })?.parameters) || []
        const srcParams =
          (cur.parameters as { parameters?: any[] } | undefined)?.parameters || []
        for (let j = 0; j < params.length; j++) {
          const parameter = params[j]
          const originParameter = srcParams.find((q: { name: string }) => q.name === parameter.name)
          if (originParameter && originParameter.type !== ParameterType.AdvancedEditConstant) {
            let replaced = false
            for (const sp of style.parameters) {
              if (parameter.name === sp.name) {
                parameter.value = sp.value
                replaced = true
              }
            }
            if (!replaced) parameter.value = originParameter.value
          } else if (originParameter && originParameter.type === ParameterType.AdvancedEditConstant) {
            parameter.type = ParameterType.AdvancedEditConstant
            parameter.value = originParameter.value
          }
        }
        gc.value = glyph
        executeGlyphScript(glyph, gc.uuid)
      }
    }
  }

  function switchStyle2OnCharacter(characterFile: ICharacterFileLite, style: (typeof styles.value)[0] | undefined) {
    if (!style) return
    const strokeListByStyle = getStrokeListByStyle(style.strokeStyle)
    for (const strokeGlyph of strokeListByStyle) {
      const strokeName = strokeGlyph.name
      for (const comp of characterFile.components) {
        if (comp.type !== 'glyph') continue
        const gc = comp as IGlyphComponent
        const cur = gc.value as ICustomGlyph
        if (cur.name !== strokeName) continue
        const glyph = R.clone(strokeGlyph)
        const params = ((glyph.parameters as { parameters?: any[] })?.parameters) || []
        const srcParams =
          (cur.parameters as { parameters?: any[] } | undefined)?.parameters || []
        for (let j = 0; j < params.length; j++) {
          const parameter = params[j]
          const originParameter = srcParams.find((q: { name: string }) => q.name === parameter.name)
          if (originParameter && originParameter.type !== ParameterType.Constant) {
            let replaced = false
            for (const sp of style.parameters) {
              if (parameter.name === sp.name) {
                parameter.value = sp.value
                replaced = true
              }
            }
            if (!replaced) parameter.value = originParameter.value
          } else if (originParameter && originParameter.type === ParameterType.Constant) {
            parameter.type = ParameterType.Constant
            parameter.value = originParameter.value
          }
        }
        gc.value = glyph
        executeGlyphScript(glyph, gc.uuid)
      }
    }
  }

  async function refreshStyleSwitchPreviews() {
    const style = styles.value.find((s) => s.uuid === selectedStyleUUID.value)
    await updateSampleCharactersList()
    const mergedConstants = R.clone(constants.value)
    if (style) mergeStyleConstantsInto(mergedConstants, style)
    const tempMap = ConstantsMap.createLocal(mergedConstants)
    const prevG = getGlobalConstantsMap()
    setGlobalConstantsMap(tempMap)
    try {
      const next: ICharacterFileLite[] = []
      for (const orig of originSampleCharactersList.value) {
        const c = R.clone(orig)
        applyStyleStrokeReplacementsToCharacter(c, style)
        next.push(c)
      }
      sampleCharactersList.value = next
      await nextTick()
      for (const character of sampleCharactersList.value) {
        const canvas = document.getElementById(
          `advanced-edit-preview-canvas-${character.uuid}`,
        ) as HTMLCanvasElement | null
        if (!canvas) continue
        const m = getFontMetrics()
        const ordered = orderedListWithItemsForCharacterFile(character)
        const contours = ContourConverter.componentsToContours(
          ordered,
          { ...m, preview: true, forceUpdate: true, advancedEdit: true },
          { x: 0, y: 0 },
        )
        const fillColors = ContourConverter.getFillColors(ordered as IComponent[])
        renderAdvancedEditPreview(canvas, contours, fillColors, projectStore.fontPreviewStyle)
      }
    } finally {
      if (prevG) setGlobalConstantsMap(prevG)
    }
  }

  async function applyStyleToEntireProject() {
    const style = styles.value.find((s) => s.uuid === selectedStyleUUID.value)
    const file = projectStore.selectedFile
    if (!style || !file) return
    if (!file.constants) file.constants = []
    mergeStyleConstantsInto(file.constants, style)
    for (const meta of file.characterList) {
      const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      if (!ch) continue
      switchStyle2OnCharacter(ch, style)
      await characterDataManager.updateCharacter(file.uuid, ch)
    }
    constants.value = R.clone(file.constants)
    projectStore.markFileUnsaved(file.uuid)
    restoreProjectConstantsMap()
    await characterStore.invalidateAllCachedCharacterPreviews()
  }

  async function enterPanel() {
    const file = projectStore.selectedFile
    if (file?.constants?.length) {
      constants.value = R.clone(file.constants)
    } else {
      constants.value = []
    }
    advancedConstantsMap.update(constants.value)
    await updatePreviewList()
  }

  function exitPanel() {
    restoreProjectConstantsMap()
  }

  function exitToList() {
    const p = editorStore.prevStatus
    const list =
      p === EditStatus.CharacterList ||
      p === EditStatus.StrokeGlyphList ||
      p === EditStatus.RadicalGlyphList ||
      p === EditStatus.CompGlyphList ||
      p === EditStatus.GlyphList
    editorStore.setEditStatus(list ? p : EditStatus.CharacterList)
  }

  return {
    activePanel,
    setActivePanel,
    sampleCharacters,
    isEditingSample,
    constants,
    advancedConstantsMap,
    sampleCharactersList,
    originSampleCharactersList,
    updateSampleCharactersList,
    updatePreviewList,
    updateCharactersAndPreview,
    renderCharacterPreview,
    applyConstantsToEntireProject,
    enterPanel,
    exitPanel,
    exitToList,
    strokeList,
    strokeMap,
    selectedStrokeUUID,
    selectedStroke,
    onStrokeReplacement,
    getStrokeListFromProject,
    renderStrokePreviewCanvas,
    setReplacementStroke,
    refreshStrokeReplacePreviews,
    applyStrokeReplacementsToAll,
    styles,
    selectedStyleUUID,
    refreshStyleSwitchPreviews,
    applyStyleToEntireProject,
    getGlyphByUUID,
  }
})
