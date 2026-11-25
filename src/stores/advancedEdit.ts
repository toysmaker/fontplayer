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
import {
  orderedListWithItemsForCharacterFile,
} from '@/features/editor/services/FormatGlyphService'
import { defaultGridItem, ensureCharacterInfoGridSettings } from '@/stores/character'
import {
  planWholeStyleReplace,
  replaceGlyphComponentValueWithTarget,
  ensureStrokeParamCompatibility,
} from '@/features/strokeStyleReplace'
import type { IGridItem } from '@/core/types'
import { ContourConverter } from '@/core/font/converter'
import { renderAdvancedEditPreview, renderZoomedCharacterPreview as renderZoomedPreviewCanvas } from '@/core/canvas/advancedEditPreview'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { glyphSkeletonBindFromRefGlyph, glyphSkeletonRebind, calculatePointBones, applyGlyphSkeletonTransformation } from '@/features/glyphSkeletonBind'
import { orderedListWithItemsForGlyph, parameterRowsForGlyph } from '@/core/utils/glyph'
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
  /** 笔画替换 + 风格切换 合并后的统一面板 */
  StrokeStyleReplace: 'strokeStyleReplace',
  FangYuanStyleDesign: 'fangYuanStyleDesign',
  FreeLayout: 'freeLayout',
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

/**
 * 样例预览专用：改写顶层组件的 uuid 与 orderedList 引用（加 __advprev 后缀）。
 * 预览克隆与真实字符共用组件 uuid 时，脚本执行/骨架重绑会以相同 key 写入实例池，
 * 污染真实字符的实例 → 样例空白、字符列表笔画缺失。改写后预览全部落在独立实例上。
 */
function uniquifyComponentUUIDsForPreview(ch: ICharacterFileLite) {
  const remap = new Map<string, string>()
  for (const comp of ch.components || []) {
    const next = `${comp.uuid}__advprev`
    remap.set(comp.uuid, next)
    comp.uuid = next
  }
  if (Array.isArray(ch.orderedList)) {
    for (const item of ch.orderedList as Array<{ uuid?: string }>) {
      if (item.uuid && remap.has(item.uuid)) {
        item.uuid = remap.get(item.uuid)!
      }
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

  // 自由布局：共享的九宫格参数（改变一个 sample 的布局 → 联动所有 sample）
  const freeLayoutInitialGrid = ref<IGridItem>(defaultGridItem())
  const freeLayoutCurrentGrid = ref<IGridItem>(defaultGridItem())
  const freeLayoutGridEditTarget = ref<'initialGrid' | 'currentGrid'>('currentGrid')

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

  /** 整体笔画风格替换：已确认的待应用风格（供「一键更新全部字库」重复应用） */
  const wholeReplaceStyle = ref('')

  /** 按风格名取笔画池字形（与选择对话框的风格匹配口径一致：trim 后比较）
   *  读取时顺带治愈历史数据（幂等）：补齐脚本需要的别名参数 +
   *  对不自行解析常量的脚本，把常量 UUID 字符串值解析为数值 */
  function getStrokeGlyphsByStyle(style: string): ICustomGlyph[] {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs?.length) return []
    const list = f.stroke_glyphs.filter((g) => (g.style || '').trim() === style.trim())
    const resolveConstant = (uuid: string): number | undefined => {
      const cm = projectStore.constantsMap as unknown as { getByUUID?: (u: string) => unknown } | undefined
      const v = cm?.getByUUID?.(uuid)
      return typeof v === 'number' ? v : undefined
    }
    let healed = false
    for (const g of list) {
      const before = JSON.stringify(g.parameters ?? [])
      ensureStrokeParamCompatibility(g, undefined, resolveConstant)
      if (JSON.stringify(g.parameters ?? []) !== before) healed = true
    }
    // 池数据被治愈（别名补齐 / 常量解析），标记未保存以便持久化
    if (healed) projectStore.markFileUnsaved(f.uuid)
    return list
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

  function renderCharacterPreview(char: ICharacterFileLite, canvas: HTMLCanvasElement, grid?: { initialGrid: IGridItem; currentGrid: IGridItem } | null) {
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
          grid: grid || undefined,
          useSkeletonGrid: grid ? true : undefined,
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

  function renderZoomedCharacterPreview(char: ICharacterFileLite, canvas: HTMLCanvasElement, grid?: { initialGrid: IGridItem; currentGrid: IGridItem } | null) {
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
          grid: grid || undefined,
          useSkeletonGrid: grid ? true : undefined,
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

  function updateCharactersAndPreview(grid?: { initialGrid: IGridItem; currentGrid: IGridItem } | null) {
    for (const character of sampleCharactersList.value) {
      const canvas = document.getElementById(
        `advanced-edit-preview-canvas-${character.uuid}`,
      ) as HTMLCanvasElement | null
      if (!canvas) continue
      renderCharacterPreview(character, canvas, grid)
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

  function replaceStrokeForCharacter(
    characterFile: ICharacterFileLite,
    stroke: (typeof strokeList.value)[0],
    opts?: { matchByName?: boolean; ignoreTempDataGuard?: boolean },
  ) {
    const originUUID = stroke.uuid
    const targetUUID = stroke.replacement!.uuid
    const source = strokeMap.get(targetUUID)
    if (!source) return
    for (let i = 0; i < characterFile.components.length; i++) {
      const component = characterFile.components[i]
      const gc = component as IGlyphComponent
      const cur = gc.value as ICustomGlyph
      const matched =
        component.type === 'glyph' &&
        (cur.uuid === originUUID || (opts?.matchByName && cur.name === stroke.name))
      if (matched) {
        // JSON 深拷贝：避免 ramda clone 对 Vue 响应式代理的别名问题污染笔画池
        const glyph = JSON.parse(JSON.stringify(source)) as ICustomGlyph
        const destParams = parameterRowsForGlyph(glyph) ?? []
        const srcParams = parameterRowsForGlyph(cur) ?? []
        for (let j = 0; j < destParams.length; j++) {
          const parameter = destParams[j]
          const originParameter = srcParams.find((q: { name: string }) => q.name === parameter.name)
          if (!originParameter) continue
          if (originParameter.value === undefined || originParameter.value === null) continue
          // 兼容处理 1：Enum 参数是风格专属语义，跨风格复制会带错值，目标保留自身枚举默认值
          if (originParameter.type === ParameterType.Enum || parameter.type === ParameterType.Enum) continue
          // 兼容处理 2：内置模板笔画参数值可能是常量 UUID 字符串（源脚本自行解析），
          // 目标风格脚本期望普通数值；类型不一致时保留目标风格默认值，避免 NaN 导致空白
          if (
            originParameter.type !== ParameterType.Constant &&
            originParameter.type !== ParameterType.AdvancedEditConstant &&
            typeof originParameter.value !== typeof parameter.value
          ) {
            continue
          }
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
        // 通用参数兼容：目标风格脚本读取的参数名与目标参数列表不一致时按源笔画补齐；
        // 并解析目标参数里的常量 UUID 字符串值（治愈被历史复制污染的笔画池）
        const resolveConstant = (uuid: string): number | undefined => {
          const cm = projectStore.constantsMap as unknown as { getByUUID?: (u: string) => unknown } | undefined
          const v = cm?.getByUUID?.(uuid)
          return typeof v === 'number' ? v : undefined
        }
        ensureStrokeParamCompatibility(glyph, cur, resolveConstant)
        executeGlyphScript(
          glyph,
          component.uuid,
          opts?.ignoreTempDataGuard ? { ignoreTempDataGuard: true } : undefined,
        )
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
      uniquifyComponentUUIDsForPreview(c)
      for (const s of strokeList.value) {
        // uuid 已改写为预览专用，改用名称匹配
        if (s.replaced) replaceStrokeForCharacter(c, s, { matchByName: true })
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

  /**
   * 整体笔画风格替换（样例规划）：对样例字符按名称+关键点匹配规划替换对，不写数据。
   * 仅用于「一键替换所有笔画」的校验提示；样例预览与工程级写入分别由
   * refreshMergedStyleStrokePreviews 与 applyMergedStrokeReplacementsToEntireProject 完成。
   */
  async function planWholeStyleReplaceForSamples(
    style: string,
  ): Promise<{ totalPairs: number; skippedNames: string[] } | null> {
    const styledStrokes = getStrokeGlyphsByStyle(style)
    if (!styledStrokes.length) return null
    const skippedNames = new Map<string, string>()
    let totalPairs = 0
    for (const ch of originSampleCharactersList.value) {
      const plan = planWholeStyleReplace(ch, style, styledStrokes)
      totalPairs += plan.pairs.length
      for (const s of plan.skipped) {
        if (!skippedNames.has(s.name)) skippedNames.set(s.name, s.reason)
      }
    }
    return { totalPairs, skippedNames: Array.from(skippedNames.keys()) }
  }

  /**
   * 自由布局：将共享的 initialGrid → currentGrid 变换批量写入工程全部字符。
   * 非破坏式：只写布局数据（info.gridSettings + useSkeletonGrid），不展开字形组件、
   * 不改写组件坐标；渲染/预览/导出时按布局数据变换（与字符编辑器布局变换一致）。
   */
  async function applyFreeLayoutToEntireProject() {
    const file = projectStore.selectedFile
    if (!file) return
    const list = file.characterList ?? []
    const n = Math.max(1, list.length)
    projectStore.loading = true
    projectStore.loadingTotal = n
    projectStore.loadingProgress = 0
    projectStore.loadingMessage = '正在将自由布局写入全部字符…'
    let lastYield = performance.now()
    let bulkCompleted = false
    try {
      const initialGrid = R.clone(freeLayoutInitialGrid.value)
      const currentGrid = R.clone(freeLayoutCurrentGrid.value)
      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
        if (!ch) continue
        ensureCharacterInfoGridSettings(ch)
        const gs = ch.info!.gridSettings!
        gs.initialGrid = R.clone(initialGrid)
        gs.currentGrid = R.clone(currentGrid)
        gs.dx = currentGrid.dx
        gs.dy = currentGrid.dy
        gs.size = currentGrid.width
        gs.centerSquareSize = (currentGrid.width / 3) * currentGrid.centerSquareScale
        ch.info!.useSkeletonGrid = true
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
      // 重置自由布局状态
      freeLayoutInitialGrid.value = defaultGridItem()
      freeLayoutCurrentGrid.value = defaultGridItem()
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

  function getStrokeListByStyle(strokeStyle: string): ICustomGlyph[] {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs) return []
    return f.stroke_glyphs.filter((g) => g.style === strokeStyle)
  }

  /** 当前字库笔画池中是否存在该风格（任一笔画即可） */
  function projectHasStrokeStyle(strokeStyle: string): boolean {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs?.length) return false
    return f.stroke_glyphs.some((g) => g.style === strokeStyle)
  }

  /** 写回全库时与原版 switchStyle2 一致：替换后执行字形脚本（训练数据脚本 trainingDataV1/V2 使用） */
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

  /** 合并面板样例预览：按应用顺序 (a) 整体替换 → (b) 单笔画替换 合成预览 */
  async function refreshMergedStyleStrokePreviews() {
    const wholeStyle = wholeReplaceStyle.value
    const styledStrokes = wholeStyle ? getStrokeGlyphsByStyle(wholeStyle) : []
    await updateSampleCharactersList()
    const next: ICharacterFileLite[] = []
    for (const orig of originSampleCharactersList.value) {
      const c = R.clone(orig)
      // 预览克隆使用专用组件 uuid，避免脚本执行/骨架重绑污染真实字符的实例池
      uniquifyComponentUUIDsForPreview(c)
      // (a) 整体替换（规划在 uniquify 之后，替换对携带预览专用 uuid）
      if (wholeStyle && styledStrokes.length) {
        const plan = planWholeStyleReplace(c, wholeStyle, styledStrokes)
        for (const pair of plan.pairs) {
          replaceGlyphComponentValueWithTarget(c, pair.componentUuid, pair.targetGlyph)
        }
      }
      // (b) 单笔画替换（显式设置最终生效；名称回退因为 (a) 可能已换过 value）
      for (const s of strokeList.value) {
        if (s.replaced) replaceStrokeForCharacter(c, s, { matchByName: true })
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

  /**
   * 合并面板「一键更新全部字库」：单遍逐字符，按顺序应用
   * (a) 整体笔画风格替换（wholeReplaceStyle）→ (b) 单笔画替换（显式设置最终生效）。
   * 未配置的部分自动跳过。
   */
  async function applyMergedStrokeReplacementsToEntireProject() {
    const file = projectStore.selectedFile
    if (!file) return
    const wholeStyle = wholeReplaceStyle.value
    const styledStrokes = wholeStyle ? getStrokeGlyphsByStyle(wholeStyle) : []
    const wholeSelected = !!wholeStyle && styledStrokes.length > 0
    const anyPerStroke = strokeList.value.some((s) => s.replaced)
    if (!wholeSelected && !anyPerStroke) return

    const list = file.characterList ?? []
    const n = Math.max(1, list.length)
    projectStore.loading = true
    projectStore.loadingTotal = n
    projectStore.loadingProgress = 0
    projectStore.loadingMessage = '正在应用笔画风格替换到全部字符…'
    let lastYield = performance.now()
    let bulkCompleted = false

    try {
      let failedCount = 0
      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        try {
          const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
          if (!ch) continue
          // (a) 整体笔画风格替换（名称+关键点匹配，跳过不匹配）
          if (wholeSelected) {
            const plan = planWholeStyleReplace(ch, wholeStyle, styledStrokes)
            for (const pair of plan.pairs) {
              replaceGlyphComponentValueWithTarget(ch, pair.componentUuid, pair.targetGlyph)
            }
          }
          // (b) 单笔画替换（名称回退匹配；整体替换已对同 uuid 执行过脚本，须绕过 tempData 守卫）
          if (anyPerStroke) {
            for (const s of strokeList.value) {
              if (s.replaced) {
                replaceStrokeForCharacter(ch, s, { matchByName: true, ignoreTempDataGuard: true })
              }
            }
          }
          await characterDataManager.updateCharacter(file.uuid, ch)
        } catch (err) {
          // 单个字符数据异常不应中断全库治愈，跳过并记录
          failedCount++
          if (import.meta.env.DEV) {
            console.warn(`[applyMerged] char ${meta.uuid} failed:`, err)
          }
        }
        projectStore.loadingProgress = i + 1
        const now = performance.now()
        if (now - lastYield >= 16) {
          await new Promise<void>((r) => setTimeout(r, 0))
          lastYield = performance.now()
        }
      }
      if (failedCount > 0 && import.meta.env.DEV) {
        if (import.meta.env.DEV) { console.warn(`[applyMerged] ${failedCount} characters failed`) }
      }
      projectStore.markFileUnsaved(file.uuid)
      await characterStore.invalidateAllCachedCharacterPreviews()
      await refreshMergedStyleStrokePreviews()
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
      // 预览克隆使用专用组件 uuid，避免脚本执行/骨架重绑污染真实字符的实例池
      uniquifyComponentUUIDsForPreview(c)
      applyFangYuanStylesToCharacterData(c, idx, options)
      if (strokeStyleTagSelected.value) {
        replaceGlyphComponentsByStyleTag(c, strokeStyleTagSelected.value)
      }
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
        if (strokeStyleTagSelected.value) {
          replaceGlyphComponentsByStyleTag(ch, strokeStyleTagSelected.value)
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

  // ============= 笔画风格切换（字形骨架绑定支持） =============
  const strokeStyleTagSelected = ref<string>('')

  const strokeStyleTagOptions = computed(() => {
    const file = projectStore.selectedFile
    if (!file?.stroke_glyphs?.length) return []
    const tags = new Set<string>()
    for (const g of file.stroke_glyphs) {
      if (g.style && g.style.trim()) tags.add(g.style.trim())
    }
    return Array.from(tags).sort()
  })

  /** 用指定风格标签的字形替换字符中的字形组件（预览用，不写回 store） */
  function replaceGlyphComponentsByStyleTag(characterFile: ICharacterFileLite, styleTag: string): void {
    if (!styleTag) return
    const file = projectStore.selectedFile
    if (!file?.stroke_glyphs?.length) return
    const styledGlyphs = file.stroke_glyphs.filter((g) => g.style === styleTag)
    if (!styledGlyphs.length) return

    if (import.meta.env.DEV) { console.log('[strokeStyleReplace] replacing with tag:', styleTag, 'styledGlyphs:', styledGlyphs.length) }

    for (let i = 0; i < characterFile.components.length; i++) {
      const comp = characterFile.components[i]
      if (comp.type !== 'glyph') continue
      const gc = comp as IGlyphComponent
      const curGlyph = gc.value as ICustomGlyph
      const strokeName = curGlyph.name
      const matched = styledGlyphs.find((g) => g.name === strokeName)
      if (!matched) continue

      const newGlyph = R.clone(matched) as ICustomGlyph
      const destParams = parameterRowsForGlyph(newGlyph) ?? []
      const srcParams = parameterRowsForGlyph(curGlyph) ?? []

      // 复制同名参数值
      for (const dp of destParams) {
        const sp = srcParams.find((q: any) => q.name === dp.name)
        if (!sp) continue
        if (sp.type === ParameterType.Constant) {
          dp.type = ParameterType.Constant
          dp.value = sp.value
        } else if (dp.type !== ParameterType.Constant) {
          dp.value = sp.value
        }
      }

      // 字形骨架绑定：保留原字形的笔组件和绑定数据，用新风格字形重新生成骨架并变形
      const isOldGlyphSkeleton = (curGlyph.skeleton as any)?.type === 'glyphSkeleton'
      const isNewGlyphSkeleton = (newGlyph.skeleton as any)?.type === 'glyphSkeleton'

      if (isOldGlyphSkeleton && isNewGlyphSkeleton) {
        if (import.meta.env.DEV) { console.log('[strokeStyleReplace] glyphSkeleton replace:', strokeName, 'oldParams:', srcParams?.length, 'newParams:', destParams?.length) }
        // 字形骨架切换：复制 ox/oy，保留新风格字形的笔组件（由新骨架变形）
        if ((newGlyph.skeleton as any) && (curGlyph.skeleton as any)) {
          ;(newGlyph.skeleton as any).ox = (curGlyph.skeleton as any).ox ?? 0
          ;(newGlyph.skeleton as any).oy = (curGlyph.skeleton as any).oy ?? 0
        }
        // 确保 adaptedScript 函数名匹配
        const refData = (newGlyph.skeleton as any)?.referenceGlyphData
        if (refData) {
          if (!refData.adaptedScript && refData.script) {
            const refUuid = (newGlyph.skeleton as any).referenceGlyphUUID || ''
            const editUuid = newGlyph.uuid
            refData.adaptedScript = refData.script.replace(`script_${refUuid.replaceAll('-', '_')}`, `script_${editUuid.replaceAll('-', '_')}`)
          } else if (refData.adaptedScript) {
            const editFnName = `script_${newGlyph.uuid.replaceAll('-', '_')}`
            if (!refData.adaptedScript.includes(editFnName)) {
              refData.adaptedScript = refData.adaptedScript.replace(/script_[a-z0-9_]+/g, editFnName)
            }
          }
        }
      }

      gc.value = newGlyph

      // 字形骨架绑定：需要将 adaptedScript 临时设置到 glyph.script 上供脚本执行
      if (isNewGlyphSkeleton) {
        const refData = (newGlyph.skeleton as any)?.referenceGlyphData
        const adaptedScript = refData?.adaptedScript
        const savedScript = newGlyph.script
        if (adaptedScript) {
          newGlyph.script = adaptedScript
          newGlyph.script_reference = undefined
        }
        try {
          executeGlyphScript(newGlyph, comp.uuid, { ignoreTempDataGuard: true })
        } finally {
          newGlyph.script = savedScript
        }
        // 脚本执行后绑定笔组件到新骨架
        const inst = instanceManager.acquireTemporaryInstance(
          comp.uuid,
          () => new CustomGlyph(newGlyph),
          'glyph',
        ) as unknown as CustomGlyph
        if (inst) {
          inst._components = []
          const hasExistingBind = !!(newGlyph.skeleton as any)?.glyphSkeletonBindData
          if (import.meta.env.DEV) {
            console.log('[strokeStyleReplace] glyphSkeleton bind:', {
              strokeName,
              hasExistingBind,
              hasPenComps: newGlyph.components?.some((c: any) => c.type === 'pen'),
              penCount: newGlyph.components?.filter((c: any) => c.type === 'pen').length || 0,
              oldBindBones: (newGlyph.skeleton as any)?.glyphSkeletonBindData?.bones?.length || 0,
            })
          }
          if (hasExistingBind) {
            glyphSkeletonRebind(inst)
          } else if (refData && newGlyph.components?.some((c: any) => c.type === 'pen')) {
            glyphSkeletonBindFromRefGlyph(inst, refData, (newGlyph.skeleton as any).boneSegmentsPerRefLine || 5)
          }
          // 更新 componentPointRanges 为新字形笔组件的 UUID（originalPoints 和 bindMatrix 由 rebind/bindFn 保留）
          const bindData = (newGlyph.skeleton as any)?.glyphSkeletonBindData
          if (bindData && newGlyph.components) {
            const penComps = (newGlyph.components as any[]).filter((c: any) => c.type === 'pen')
            const newRanges: Array<{componentUUID: string, start: number, end: number}> = []
            let offset = 0
            for (const pc of penComps) {
              const pts = pc.value?.points
              if (pts && pts.length > 0) {
                newRanges.push({ componentUUID: pc.uuid, start: offset, end: offset + pts.length })
                offset += pts.length
              }
            }
            if (newRanges.length > 0) {
              bindData.componentPointRanges = newRanges
            }
          }
        }
      } else {
        executeGlyphScript(newGlyph, comp.uuid)
      }
    }
  }

  /** 笔画风格切换预览：刷新样例字符 */
  async function refreshStrokeStylePreviews() {
    const tag = strokeStyleTagSelected.value
    if (import.meta.env.DEV) { console.log('[strokeStyleReplace] refreshStrokeStylePreviews, tag:', tag) }
    await updateSampleCharactersList()
    const chars: ICharacterFileLite[] = []
    for (const orig of originSampleCharactersList.value) {
      const c = R.clone(orig)
      // 预览克隆使用专用组件 uuid，避免脚本执行/骨架重绑污染真实字符的实例池
      uniquifyComponentUUIDsForPreview(c)
      if (tag) replaceGlyphComponentsByStyleTag(c, tag)
      chars.push(c)
    }
    sampleCharactersList.value = chars
    await nextTick()
    requestAnimationFrame(() => renderStrokeStylePreviews())
  }

  function renderStrokeStylePreviews() {
    const m = getFontMetrics()
    for (const ch of sampleCharactersList.value) {
      const canvas = document.getElementById(`advanced-edit-preview-canvas-${ch.uuid}`) as HTMLCanvasElement | null
      if (!canvas) continue
      const ordered = orderedListWithItemsForCharacterFile(ch)
      const contours = ContourConverter.componentsToContours(
        ordered,
        { ...m, preview: true, forceUpdate: true, advancedEdit: true },
        { x: 0, y: 0 },
      )
      const fillColors = ContourConverter.getFillColors(ordered as IComponent[])
      renderAdvancedEditPreview(canvas, contours, fillColors, projectStore.fontPreviewStyle)
    }
  }

  /** 一键更新全部字库：将笔画风格切换应用到所有字符 */
  async function applyStrokeStyleToEntireProject() {
    const tag = strokeStyleTagSelected.value
    if (!tag) return
    const file = projectStore.selectedFile
    if (!file) return

    const list = file.characterList ?? []
    const n = Math.max(1, list.length)
    projectStore.loading = true
    projectStore.loadingTotal = n
    projectStore.loadingProgress = 0
    projectStore.loadingMessage = '正在应用笔画风格到全部字符…'
    let lastYield = performance.now()
    let bulkCompleted = false

    try {
      if (import.meta.env.DEV) { console.log('[strokeStyleReplace] applyToEntireProject, tag:', tag, 'charCount:', list.length) }
      for (let i = 0; i < list.length; i++) {
        const meta = list[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
        if (!ch) continue
        const beforeCount = ch.components?.filter((c: any) => c.type === 'glyph').length || 0
        replaceGlyphComponentsByStyleTag(ch, tag)
        const afterGlyphs = ch.components?.filter((c: any) => c.type === 'glyph') || []
        if (import.meta.env.DEV && afterGlyphs.length > 0 && i < 3) {
          if (import.meta.env.DEV) { console.log(`[strokeStyleReplace] char ${i} "${(meta.character as any)?.text || ''}": ${beforeCount} glyphs, styles:`, afterGlyphs.map((c: any) => (c.value as any)?.style || (c.value as any)?.skeleton?.type || 'none')) }
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
      await refreshStrokeStylePreviews()
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
    freeLayoutInitialGrid,
    freeLayoutCurrentGrid,
    freeLayoutGridEditTarget,
    applyFreeLayoutToEntireProject,
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
    wholeReplaceStyle,
    getStrokeGlyphsByStyle,
    planWholeStyleReplaceForSamples,
    refreshMergedStyleStrokePreviews,
    applyMergedStrokeReplacementsToEntireProject,
    getGlyphByUUID,
    switchStyle2OnCharacterWithScripts,
    getStrokeListByStyle,
    projectHasStrokeStyle,
    fangYuanStyleItems,
    fangYuanStyleSelections,
    fangYuanStyleNumericValues,
    initFangYuanStyleSelections,
    refreshFangYuanStylePreviews,
    quickRefreshFangYuanStylePreviews,
    applyFangYuanStylesToEntireProject,
    strokeStyleTagSelected,
    strokeStyleTagOptions,
    replaceGlyphComponentsByStyleTag,
    refreshStrokeStylePreviews,
    applyStrokeStyleToEntireProject,
  }
})
