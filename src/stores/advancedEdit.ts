/**
 * 高级编辑：样例预览、全局常量、笔画替换、风格切换、脚本批处理（无 _o，仅用 InstanceManager / executeGlyphScript）
 */

import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import * as R from 'ramda'
import { i18n } from '@/i18n'
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
import { useGlyphStore } from '@/stores/glyph'
import { EditStatus } from '@/core/types'
import { ConstantsMap } from '@/core/script/ConstantsMap'
import { getGlobalConstantsMap, setGlobalConstantsMap } from '@/core/script/ParametersMap'
import { orderedListWithItemsForCharacterFile } from '@/features/editor/services/FormatGlyphService'
import { ContourConverter } from '@/core/font/converter'
import { renderAdvancedEditPreview, renderZoomedCharacterPreview as renderZoomedPreviewCanvas } from '@/core/canvas/advancedEditPreview'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { orderedListWithItemsForGlyph, parameterRowsForGlyph } from '@/core/utils/glyph'
import {
  applySharedSerifConstantsPatch,
  isSerifStylePreset,
  processCharacterAfterSongStyleSwitch,
  processCharacterBeforeSerifStyleSwitch,
} from '../features/advancedEdit/styleSwitchPostProcess'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { collectProjectConstantUsageHitsForUuidsAsync } from '@/features/editor/globalParam/traverseConstantUsages'
import {
  FANG_YUAN_STYLE_ITEMS,
  applyStyleToGlyphParameter,
  getValueParamName,
  VALUE_PARAM_DEFAULTS,
  applyNumericValueToGlyph,
  type StyleItem,
} from '../features/advancedEdit/fangYuanStyleConfig'
import {
  collectCharacterJointData,
  initFangYuanRules,
} from '../features/advancedEdit/fangYuanRules'
import type { FangYuanRuleExtra } from '../features/advancedEdit/fangYuanRules'

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

export const PanelType = {
  GlobalVariables: 'globalVariables',
  ConditionFilter: 'conditionFilter',
  Script: 'script',
  StrokeReplace: 'strokeReplace',
  StyleSwitch: 'styleSwitch',
  FangYuanStyleDesign: 'fangYuanStyleDesign',
} as const

export type PanelTypeId = (typeof PanelType)[keyof typeof PanelType]

export type StyleSwitchPreset = {
  uuid: string
  name: string
  strokeStyle: string
  constants: Array<{ name: string; value: number }>
  parameters: Array<{
    name: string
    value: number
    min?: number
    max?: number
    type?: ParameterType
  }>
}

/** 与原 StyleSwitchPanel 一致的可导入风格模板（uuid 固定，便于选中态持久） */
export const STYLE_SWITCH_PRESETS: StyleSwitchPreset[] = [
  {
    uuid: 'default',
    name: '默认风格',
    strokeStyle: '默认风格',
    constants: [],
    parameters: [],
  },
  {
    uuid: 'ss-heiti',
    name: '字玩标准黑体',
    strokeStyle: '字玩标准黑体',
    constants: [
      { name: '起笔风格', value: 2 },
      { name: '起笔数值', value: 1 },
      { name: '转角风格', value: 1 },
      { name: '转角数值', value: 1 },
      { name: '字重变化', value: 0 },
      { name: '弯曲程度', value: 1 },
    ],
    parameters: [
      { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
  {
    uuid: 'ss-heiti-round',
    name: '字玩标准黑体-圆角',
    strokeStyle: '字玩标准黑体',
    constants: [
      { name: '起笔风格', value: 2 },
      { name: '起笔数值', value: 1 },
      { name: '转角风格', value: 0 },
      { name: '转角数值', value: 1 },
      { name: '字重变化', value: 0 },
      { name: '弯曲程度', value: 2 },
    ],
    parameters: [
      { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
  {
    uuid: 'ss-sketch',
    name: '测试手绘风格',
    strokeStyle: '测试手绘风格',
    constants: [],
    parameters: [
      { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
  {
    uuid: 'ss-song',
    name: '字玩标准宋体',
    strokeStyle: '字玩标准宋体',
    constants: [],
    parameters: [
      { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
  {
    uuid: 'ss-fangsong',
    name: '字玩标准仿宋',
    strokeStyle: '字玩标准仿宋',
    constants: [],
    parameters: [
      { name: '字重', value: 30, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
  {
    uuid: 'ss-kai',
    name: '字玩标准楷体',
    strokeStyle: '字玩标准楷体',
    constants: [],
    parameters: [
      { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
  {
    uuid: 'ss-li',
    name: '字玩标准隶书',
    strokeStyle: '字玩标准隶书',
    constants: [],
    parameters: [
      { name: '字重', value: 50, min: 40, max: 100, type: ParameterType.Number },
    ],
  },
]

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
  const glyphStore = useGlyphStore()

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
  const styles = ref<StyleSwitchPreset[]>([])

  function initStyleSwitchTemplates() {
    if (styles.value.length) return
    styles.value = STYLE_SWITCH_PRESETS.map((p) => R.clone(p))
  }

  /** 当前字库笔画池中是否存在该风格（任一笔画即可） */
  function projectHasStrokeStyle(strokeStyle: string): boolean {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs?.length) return false
    return f.stroke_glyphs.some((g) => g.style === strokeStyle)
  }

  function isStyleSwitchOptionEnabled(preset: StyleSwitchPreset): boolean {
    if (preset.uuid === 'default') return true
    return projectHasStrokeStyle(preset.strokeStyle)
  }

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
      setGlobalConstantsMap(prev)
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

  function renderZoomedCharacterPreview(char: ICharacterFileLite, canvas: HTMLCanvasElement) {
    const m = getFontMetrics()
    runWithAdvancedConstantsMap(() => {
      const ordered = orderedListWithItemsForCharacterFile(char)
      const contours = ContourConverter.componentsToContours(
        ordered,
        {
          ...m,
          preview: false,
          forceUpdate: true,
          advancedEdit: true,
        },
        { x: 0, y: 0 },
      )
      renderZoomedPreviewCanvas(canvas, contours, m.unitsPerEm, m.descender)
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

  async function afterBulkMutateMainList() {
    characterStore.characterListVersion++
    glyphStore.glyphListVersion++
    await dispatchForceListRefresh('force-character-list-refresh')
  }

  /** 从磁盘重载样例、重绘中间栏；可选重绘笔画替换侧栏 */
  async function refreshAdvancedEditSamplesAfterBulk(options?: { redrawStrokeSidebar?: boolean }) {
    await updateSampleCharactersList()
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateCharactersAndPreview()
          resolve()
        })
      })
    })
    if (options?.redrawStrokeSidebar && strokeList.value.length) {
      await redrawStrokeListPreviews()
    }
  }

  async function applyConstantsToEntireProject() {
    const file = projectStore.selectedFile
    if (!file) return

    const t = i18n.global.t
    const charList = file.characterList ?? []
    const scanTotal = Math.max(1, charList.length + 1)

    projectStore.loading = true
    projectStore.loadingTotal = scanTotal
    projectStore.loadingProgress = 0
    projectStore.loadingMessage =
      charList.length === 0
        ? String(t('panels.paramsPanel.params.globalParamUpdateScanGlyphs'))
        : String(
            t('panels.paramsPanel.params.globalParamUpdateScanCharacters', {
              current: 0,
              total: charList.length,
            }),
          )

    let bulkCompleted = false
    try {
      file.constants = R.clone(constants.value)
      projectStore.markFileUnsaved(file.uuid)
      restoreProjectConstantsMap()

      const constantUuids = [...new Set((file.constants ?? []).map((c) => c.uuid).filter(Boolean))]

      const { hits, characterByUuid } = await collectProjectConstantUsageHitsForUuidsAsync({
        file,
        constantUuids,
        editingCharacter: characterStore.editingCharacter,
        loadCharacter: (f, u) => characterDataManager.loadCharacter(f, u),
        onScanProgress: (done, total) => {
          projectStore.loadingProgress = done
          projectStore.loadingTotal = total
          if (charList.length === 0) {
            projectStore.loadingMessage = String(t('panels.paramsPanel.params.globalParamUpdateScanGlyphs'))
          } else if (done <= charList.length) {
            projectStore.loadingMessage = String(
              t('panels.paramsPanel.params.globalParamUpdateScanCharacters', {
                current: Math.min(done, charList.length),
                total: charList.length,
              }),
            )
          } else {
            projectStore.loadingMessage = String(t('panels.paramsPanel.params.globalParamUpdateScanGlyphs'))
          }
        },
      })

      const execTotal = Math.max(1, hits.length)
      projectStore.loadingTotal = execTotal
      projectStore.loadingProgress = 0
      projectStore.loadingMessage = String(t('panels.paramsPanel.params.globalParamUpdateProgress'))

      const dirtyCharacterUuids = new Set<string>()
      let lastYield = performance.now()

      for (let i = 0; i < hits.length; i++) {
        const h = hits[i]
        if (h.glyph.script || h.glyph.script_reference || h.glyph.skeleton) {
          executeGlyphScript(h.glyph, h.componentUuid)
          if (!instanceManager.isEditing(h.componentUuid)) {
            instanceManager.releaseTemporaryInstance(h.componentUuid)
          }
          if (h.characterUuid) dirtyCharacterUuids.add(h.characterUuid)
        }
        projectStore.loadingProgress = Math.max(1, i + 1)
        projectStore.loadingMessage =
          String(t('panels.paramsPanel.params.globalParamUpdateProgress')) +
          ' ' +
          String(
            t('panels.paramsPanel.params.globalParamUpdateProgressDetail', {
              current: i + 1,
              total: hits.length,
            }),
          )
        const now = performance.now()
        if (now - lastYield >= 16) {
          await new Promise<void>((r) => setTimeout(r, 0))
          lastYield = performance.now()
        }
      }

      if (hits.length === 0) {
        projectStore.loadingProgress = 1
      }

      for (const cid of dirtyCharacterUuids) {
        const ch = characterByUuid.get(cid)
        if (ch) await characterDataManager.updateCharacter(file.uuid, ch)
      }

      await characterStore.invalidateAllCachedCharacterPreviews()
      await refreshAdvancedEditSamplesAfterBulk({ redrawStrokeSidebar: strokeList.value.length > 0 })
      bulkCompleted = true
    } finally {
      projectStore.loading = false
      projectStore.loadingProgress = 0
      projectStore.loadingTotal = 0
      projectStore.loadingMessage = ''
    }
    if (bulkCompleted) await afterBulkMutateMainList()
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

  /**
   * 右侧笔画缩略图：与 CustomGlyph.components 一致 —— 同时包含字形内引用/有序列表组件与脚本生成的 _components。
   */
  function renderStrokePreviewCanvas(uuid?: string) {
    const targets = uuid
      ? strokeList.value.filter((s) => s.uuid === uuid)
      : strokeList.value
    for (const stroke of targets) {
      const glyphKey = stroke.replaced && stroke.replacement ? stroke.replacement.uuid : stroke.uuid
      const sourceGlyph = strokeMap.get(glyphKey)
      if (!sourceGlyph) continue
      const byId = document.getElementById(
        `advanced-edit-stroke-canvas-${stroke.uuid}`,
      ) as HTMLCanvasElement | null
      const canvases = byId
        ? [byId]
        : Array.from(
            document.querySelectorAll<HTMLCanvasElement>(
              `.stroke-preview-${CSS.escape(stroke.uuid)}`,
            ),
          )
      if (!canvases.length) continue

      const instanceKey = `adv-stroke-sidebar-${stroke.uuid}`
      if (instanceManager.isTemporary(instanceKey)) {
        instanceManager.releaseTemporaryInstance(instanceKey)
      }

      const glyph = R.clone(sourceGlyph) as ICustomGlyph
      try {
        executeGlyphScript(glyph, instanceKey)
        const inst = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyph),
          'glyph',
        ) as CustomGlyph
        const fromGlyph = orderedListWithItemsForGlyph(glyph) as IComponent[]
        const fromScript = (inst._components ?? []) as IComponent[]
        const list = fromGlyph.concat(fromScript)
        const contours = ContourConverter.componentsToContours(
          list,
          {
            unitsPerEm: 1000,
            descender: -200,
            advanceWidth: 1000,
            preview: true,
            forceUpdate: true,
            isGlyph: true,
          },
          { x: 0, y: 0 },
        )
        const fillColors = ContourConverter.getFillColors(list)
        canvases.forEach((canvas) => {
          renderAdvancedEditPreview(canvas, contours, fillColors, projectStore.fontPreviewStyle)
        })
      } catch (e) {
        console.error('[advancedEdit] renderStrokePreviewCanvas', stroke.uuid, e)
      } finally {
        instanceManager.releaseTemporaryInstance(instanceKey)
      }
    }
  }

  /** 右侧笔画列表 canvas 在 n-scrollbar 内，需等布局后再 querySelector */
  async function redrawStrokeListPreviews() {
    await nextTick()
    await nextTick()
    const strokeListEl = document.querySelector('.stroke-list')
    void strokeListEl?.getBoundingClientRect()
    await new Promise<void>((r) => setTimeout(r, 0))
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          renderStrokePreviewCanvas()
          resolve()
        })
      })
    })
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
  }

  function replaceStrokeForCharacter(characterFile: ICharacterFileLite, stroke: (typeof strokeList.value)[0]) {
    const originUUID = stroke.uuid
    const targetUUID = stroke.replacement!.uuid
    const source = strokeMap.get(targetUUID)
    if (!source) return
    const targetStrokeGlyph = R.clone(source)
    for (let i = 0; i < characterFile.components.length; i++) {
      const component = characterFile.components[i]
      const gc = component as IGlyphComponent
      const cur = gc.value as ICustomGlyph
      if (component.type === 'glyph' && cur.uuid === originUUID) {
        const glyph = targetStrokeGlyph
        const destParams = parameterRowsForGlyph(glyph) ?? []
        const srcParams = parameterRowsForGlyph(cur) ?? []
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

  /** v-if 切 tab 后 flex/滚动区首帧布局未稳定，canvas 可能仍为 0 尺寸；强制同步布局并多帧后再绘制 */
  async function waitForAdvancedEditSampleGridPaint(): Promise<void> {
    await nextTick()
    await nextTick()
    const grid = document.getElementById('advanced-edit-characters-list')
    void grid?.offsetHeight
    void grid?.getBoundingClientRect()
    await new Promise<void>((r) => setTimeout(r, 0))
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  async function refreshStrokeReplacePreviews() {
    await updateSampleCharactersList()
    const next: ICharacterFileLite[] = []
    for (const orig of originSampleCharactersList.value) {
      const c = R.clone(orig)
      for (const s of strokeList.value) {
        if (s.replaced) replaceStrokeForCharacter(c, s)
      }
      rewriteGlyphParamsForAdvancedPreview(c)
      next.push(c)
    }
    sampleCharactersList.value = next
    await waitForAdvancedEditSampleGridPaint()
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
    await redrawStrokeListPreviews()
  }

  async function applyStrokeReplacementsToAll() {
    const file = projectStore.selectedFile
    if (!file) return
    const list = file.characterList ?? []
    const n = Math.max(1, list.length)
    projectStore.loading = true
    projectStore.loadingTotal = n
    projectStore.loadingProgress = 0
    projectStore.loadingMessage = '正在将笔画替换写入全部字符…'
    let lastYield = performance.now()
    let bulkCompleted = false
    try {
      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
        if (!ch) continue
        for (const s of strokeList.value) {
          if (s.replaced) replaceStrokeForCharacter(ch, s)
        }
        await characterDataManager.updateCharacter(file.uuid, ch)
        projectStore.loadingProgress = i + 1
        const now = performance.now()
        if (now - lastYield >= 16) {
          await new Promise<void>((r) => setTimeout(r, 0))
          lastYield = performance.now()
        }
      }
      projectStore.markFileUnsaved(file.uuid)
      await characterStore.invalidateAllCachedCharacterPreviews()
      await refreshStrokeReplacePreviews()
      bulkCompleted = true
    } finally {
      projectStore.loading = false
      projectStore.loadingProgress = 0
      projectStore.loadingTotal = 0
      projectStore.loadingMessage = ''
    }
    if (bulkCompleted) await afterBulkMutateMainList()
  }

  function getStrokeListByStyle(strokeStyle: string): ICustomGlyph[] {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs) return []
    return f.stroke_glyphs.filter((g) => g.style === strokeStyle)
  }

  function mergeStyleConstantsInto(target: IConstant[], style: StyleSwitchPreset) {
    for (const c of target) {
      for (const sc of style.constants) {
        if (c.name === sc.name) c.value = sc.value
      }
    }
  }

  /** 仅替换笔画数据；不在此执行脚本，避免与 ContourConverter 内 executeGlyphScript 重复执行（tempData 会导致第二次跳过，预览错位） */
  function applyStyleStrokeReplacementsToCharacter(
    characterFile: ICharacterFileLite,
    style: StyleSwitchPreset | undefined,
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
        const destParams = parameterRowsForGlyph(glyph) ?? []
        const srcParams = parameterRowsForGlyph(cur) ?? []
        for (let j = 0; j < destParams.length; j++) {
          const parameter = destParams[j]
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
      }
    }
  }

  function switchStyle2OnCharacter(characterFile: ICharacterFileLite, style: StyleSwitchPreset | undefined) {
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
        const destParams = parameterRowsForGlyph(glyph) ?? []
        const srcParams = parameterRowsForGlyph(cur) ?? []
        for (let j = 0; j < destParams.length; j++) {
          const parameter = destParams[j]
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
      }
    }
  }

  /** 写回全库时与原版 switchStyle2 一致：替换后执行字形脚本 */
  function switchStyle2OnCharacterWithScripts(
    characterFile: ICharacterFileLite,
    style: StyleSwitchPreset | undefined,
  ) {
    if (!style) return
    const strokeListByStyle = getStrokeListByStyle(style.strokeStyle)
    for (const strokeGlyph of strokeListByStyle) {
      const strokeName = strokeGlyph.name
      for (let i = 0; i < characterFile.components.length; i++) {
        const component = characterFile.components[i]
        if (component.type !== 'glyph') continue
        const gc = component as IGlyphComponent
        const cur = gc.value as ICustomGlyph
        if (cur.name !== strokeName) continue
        const glyph = R.clone(strokeGlyph)
        const destParams = parameterRowsForGlyph(glyph) ?? []
        const srcParams = parameterRowsForGlyph(cur) ?? []
        for (let j = 0; j < destParams.length; j++) {
          const parameter = destParams[j]
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
        executeGlyphScript(glyph, component.uuid)
      }
    }
  }

  async function refreshStyleSwitchPreviews() {
    const style = styles.value.find((s) => s.uuid === selectedStyleUUID.value)
    await updateSampleCharactersList()
    const mergedConstants = R.clone(constants.value)
    if (style) mergeStyleConstantsInto(mergedConstants, style)
    if (style && isSerifStylePreset(style)) applySharedSerifConstantsPatch(mergedConstants)
    const tempMap = ConstantsMap.createLocal(mergedConstants)
    const prevG = getGlobalConstantsMap()
    setGlobalConstantsMap(tempMap)
    try {
      const next: ICharacterFileLite[] = []
      for (const orig of originSampleCharactersList.value) {
        const c = R.clone(orig)
        if (style?.uuid === 'ss-fangsong') {
          processCharacterBeforeSerifStyleSwitch(c, mergedConstants, 'fangsong')
        } else if (style?.uuid === 'ss-kai') {
          processCharacterBeforeSerifStyleSwitch(c, mergedConstants, 'kai')
        } else if (style?.uuid === 'ss-li') {
          processCharacterBeforeSerifStyleSwitch(c, mergedConstants, 'li')
        }
        applyStyleStrokeReplacementsToCharacter(c, style)
        if (style?.uuid === 'ss-song') {
          processCharacterAfterSongStyleSwitch(c, mergedConstants)
        }
        rewriteGlyphParamsForAdvancedPreview(c)
        next.push(c)
      }
      sampleCharactersList.value = next
      await nextTick()
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
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
            resolve()
          })
        })
      })
    } finally {
      setGlobalConstantsMap(prevG)
    }
  }

  async function applyStyleToEntireProject() {
    const style = styles.value.find((s) => s.uuid === selectedStyleUUID.value)
    const file = projectStore.selectedFile
    if (!style || !file) return
    if (style.uuid !== 'default' && !projectHasStrokeStyle(style.strokeStyle)) return

    const list = file.characterList ?? []
    const n = Math.max(1, list.length)
    projectStore.loading = true
    projectStore.loadingTotal = n
    projectStore.loadingProgress = 0
    projectStore.loadingMessage = '正在应用风格到全部字符…'
    let lastYield = performance.now()
    let bulkCompleted = false

    try {
      if (!file.constants) file.constants = []
      mergeStyleConstantsInto(file.constants, style)
      if (isSerifStylePreset(style)) applySharedSerifConstantsPatch(file.constants)

      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
        if (!ch) continue
        if (style.uuid === 'ss-fangsong') {
          processCharacterBeforeSerifStyleSwitch(ch, file.constants, 'fangsong')
        } else if (style.uuid === 'ss-kai') {
          processCharacterBeforeSerifStyleSwitch(ch, file.constants, 'kai')
        } else if (style.uuid === 'ss-li') {
          processCharacterBeforeSerifStyleSwitch(ch, file.constants, 'li')
        }
        switchStyle2OnCharacterWithScripts(ch, style)
        if (style.uuid === 'ss-song') {
          processCharacterAfterSongStyleSwitch(ch, file.constants)
        }
        await characterDataManager.updateCharacter(file.uuid, ch)
        projectStore.loadingProgress = i + 1
        const now = performance.now()
        if (now - lastYield >= 16) {
          await new Promise<void>((r) => setTimeout(r, 0))
          lastYield = performance.now()
        }
      }
      constants.value = R.clone(file.constants)
      projectStore.markFileUnsaved(file.uuid)
      restoreProjectConstantsMap()
      await characterStore.invalidateAllCachedCharacterPreviews()
      await refreshStyleSwitchPreviews()
      bulkCompleted = true
    } finally {
      projectStore.loading = false
      projectStore.loadingProgress = 0
      projectStore.loadingTotal = 0
      projectStore.loadingMessage = ''
    }
    if (bulkCompleted) await afterBulkMutateMainList()
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

  // ========== 字玩方圆黑体专属设计通道 ==========

  // 注册风格规则（在 store 初始化时调用一次）
  initFangYuanRules()

  const fangYuanStyleItems = ref<StyleItem[]>(FANG_YUAN_STYLE_ITEMS)
  const fangYuanStyleSelections = ref<Record<string, number>>({})
  const fangYuanStyleNumericValues = ref<Record<string, number>>({})

  /**
   * 关节/辅助线数据缓存。
   * 数值 slider 变化时关节位置不变，复用缓存避免重复执行脚本。
   * 风格选择变化时（refreshFangYuanStylePreviews）清空缓存。
   */
  const fangYuanJointDataCache = new Map<string, ReturnType<typeof collectCharacterJointData>>()

  function initFangYuanStyleSelections() {
    const sel: Record<string, number> = {}
    const num: Record<string, number> = {}
    for (const item of FANG_YUAN_STYLE_ITEMS) {
      sel[item.label] = 0
      const valueParamName = getValueParamName(item.paramName)
      num[item.label] = VALUE_PARAM_DEFAULTS[valueParamName]?.value ?? 1
    }
    fangYuanStyleSelections.value = sel
    fangYuanStyleNumericValues.value = num
  }

  /**
   * 构建规则检查所需的上下文数据（预执行脚本采集关节/辅助线 + 当前组件定位）
   */
  function buildFangYuanRuleExtra(
    allJointData: ReturnType<typeof collectCharacterJointData>,
    compUuid: string,
  ): FangYuanRuleExtra {
    return {
      allComponents: allJointData,
      currentComponent: allJointData.find((d) => d.uuid === compUuid)!,
      verticalThreshold: 20,
    }
  }

  /**
   * 仅修改参数数据，不执行脚本。
   * 用于预览：避免与 ContourConverter 内 executeGlyphScript 重复执行。
   *
   * 规则检查需要关节/辅助线数据，首次执行时会调用 collectCharacterJointData
   * 并缓存结果。后续 numeric slider 变化时跳过采集，直接复用缓存。
   */
  function applyFangYuanStylesToCharacterData(
    char: ICharacterFileLite,
    charIndex: number,
    options?: { skipJointCollection?: boolean },
  ) {
    const cacheKey = char.uuid
    const skipCollection = options?.skipJointCollection && fangYuanJointDataCache.has(cacheKey)

    let allJointData: ReturnType<typeof collectCharacterJointData>
    if (skipCollection) {
      allJointData = fangYuanJointDataCache.get(cacheKey)!
    } else {
      if (import.meta.env.DEV) {
        console.log(`[FangYuanStore] collectJointData for charIndex=${charIndex}`)
      }
      allJointData = collectCharacterJointData(char)
      fangYuanJointDataCache.set(cacheKey, allJointData)
    }

    for (const item of FANG_YUAN_STYLE_ITEMS) {
      const selectedValue = fangYuanStyleSelections.value[item.label]
      const numericValue = fangYuanStyleNumericValues.value[item.label]
      if (selectedValue === undefined || selectedValue === 0) continue
      const glyphNameSet = new Set(item.glyphNames)
      const valueParamName = getValueParamName(item.paramName)
      for (const comp of char.components) {
        if (comp.type !== 'glyph') continue
        const gc = comp as IGlyphComponent
        const glyph = gc.value as ICustomGlyph
        if (!glyphNameSet.has(glyph.name)) continue
        const extra = buildFangYuanRuleExtra(allJointData, gc.uuid)
        applyStyleToGlyphParameter(glyph, item.paramName, selectedValue, charIndex, extra as any)
        if (numericValue !== undefined) {
          applyNumericValueToGlyph(glyph, valueParamName, numericValue)
        }
      }
    }
  }

  /**
   * 修改参数并执行脚本。
   * 用于一键更新全库：需要持久化脚本执行结果。
   *
   * 注：规则检查需要关节/辅助线数据，因此在修改参数前先执行一次脚本采集数据。
   * 修改参数后会再次执行脚本以应用新参数值。
   */
  function applyFangYuanStylesToCharacterWithScripts(char: ICharacterFileLite, charIndex: number) {
    const allJointData = collectCharacterJointData(char)

    for (const item of FANG_YUAN_STYLE_ITEMS) {
      const selectedValue = fangYuanStyleSelections.value[item.label]
      const numericValue = fangYuanStyleNumericValues.value[item.label]
      if (selectedValue === undefined || selectedValue === 0) continue
      const glyphNameSet = new Set(item.glyphNames)
      const valueParamName = getValueParamName(item.paramName)
      for (const comp of char.components) {
        if (comp.type !== 'glyph') continue
        const gc = comp as IGlyphComponent
        const glyph = gc.value as ICustomGlyph
        if (!glyphNameSet.has(glyph.name)) continue
        const extra = buildFangYuanRuleExtra(allJointData, gc.uuid)
        applyStyleToGlyphParameter(glyph, item.paramName, selectedValue, charIndex, extra as any)
        if (numericValue !== undefined) {
          applyNumericValueToGlyph(glyph, valueParamName, numericValue)
        }
        executeGlyphScript(glyph, comp.uuid)
      }
    }
  }

  /** 从 originSampleCharactersList 克隆并应用样式 */
  function applyFangYuanStylesToClones(options?: { skipJointCollection?: boolean }) {
    const next: ICharacterFileLite[] = []
    let idx = 0
    for (const orig of originSampleCharactersList.value) {
      const c = R.clone(orig)
      applyFangYuanStylesToCharacterData(c, idx, options)
      rewriteGlyphParamsForAdvancedPreview(c)
      next.push(c)
      idx++
    }
    sampleCharactersList.value = next
  }

  /** 将 sampleCharactersList 渲染到 canvas */
  function renderFangYuanPreviews() {
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

  /** 刷新字玩方圆黑体风格预览（完整：从 DB 加载，清空关节数据缓存） */
  async function refreshFangYuanStylePreviews() {
    fangYuanJointDataCache.clear()
    await updateSampleCharactersList()
    applyFangYuanStylesToClones()
    await nextTick()
    await waitForAdvancedEditSampleGridPaint()
    renderFangYuanPreviews()
  }

  /** 快速刷新预览（跳过 DB 加载和关节采集，用于 slider 等高频交互） */
  function quickRefreshFangYuanStylePreviews() {
    applyFangYuanStylesToClones({ skipJointCollection: true })
    renderFangYuanPreviews()
  }

  /** 一键更新全部字库：将当前风格选择写入所有字符 */
  async function applyFangYuanStylesToEntireProject() {
    const file = projectStore.selectedFile
    if (!file) return

    const list = file.characterList ?? []
    const n = Math.max(1, list.length)
    projectStore.loading = true
    projectStore.loadingTotal = n
    projectStore.loadingProgress = 0
    projectStore.loadingMessage = '正在应用字玩方圆黑体风格到全部字符…'
    let lastYield = performance.now()
    let bulkCompleted = false

    try {
      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
        if (!ch) continue
        applyFangYuanStylesToCharacterWithScripts(ch, i)
        await characterDataManager.updateCharacter(file.uuid, ch)
        projectStore.loadingProgress = i + 1
        const now = performance.now()
        if (now - lastYield >= 16) {
          await new Promise<void>((r) => setTimeout(r, 0))
          lastYield = performance.now()
        }
      }
      projectStore.markFileUnsaved(file.uuid)
      restoreProjectConstantsMap()
      await characterStore.invalidateAllCachedCharacterPreviews()
      await refreshFangYuanStylePreviews()
      bulkCompleted = true
    } finally {
      projectStore.loading = false
      projectStore.loadingProgress = 0
      projectStore.loadingTotal = 0
      projectStore.loadingMessage = ''
    }
    if (bulkCompleted) await afterBulkMutateMainList()
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
    renderZoomedCharacterPreview,
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
    redrawStrokeListPreviews,
    setReplacementStroke,
    refreshStrokeReplacePreviews,
    applyStrokeReplacementsToAll,
    styles,
    selectedStyleUUID,
    initStyleSwitchTemplates,
    isStyleSwitchOptionEnabled,
    projectHasStrokeStyle,
    refreshStyleSwitchPreviews,
    applyStyleToEntireProject,
    getGlyphByUUID,
    fangYuanStyleItems,
    fangYuanStyleSelections,
    fangYuanStyleNumericValues,
    initFangYuanStyleSelections,
    refreshFangYuanStylePreviews,
    quickRefreshFangYuanStylePreviews,
    applyFangYuanStylesToEntireProject,
  }
})
