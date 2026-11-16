/**
 * 动效渲染辅助：布局网格 / 关键帧参数应用 / 编辑管线渲染
 *
 * 与编辑页面渲染保持一致：
 * - 字形组件定位走字符布局网格（grid + useSkeletonGrid），与编辑画布相同
 * - 分色与编辑页面一致（comp.fillColor → value.fillColor → '#000'）
 *
 * 内存与实例管理：
 * - 渲染在字符克隆上进行，克隆中所有字形组件的 uuid 会被重新生成（rekey），
 *   避免与正在编辑的字符实例（InstanceManager 中同 key 的实例）互相污染；
 *   渲染结束后释放本次创建的全部临时实例
 */

import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import type { ICharacterFileLite, IAnimationKeyframe, ICustomGlyph, IGlyphComponent, IComponent, IParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
import { orderedListWithItemsForCharacterFile } from '@/features/editor/services/FormatGlyphService'
import { parameterRowsForGlyph } from '@/core/utils/glyph'
import { executeCharacterScript, executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { ConstantsMap } from '@/core/script/ConstantsMap'
import { getGlobalConstantsMap, setGlobalConstantsMap } from '@/core/script/ParametersMap'
import { useProjectStore } from '@/stores/project'
import { ensureCharacterInfoGridSettings } from '@/stores/character'
import { render as renderCharacterEditorCanvas } from '@/core/canvas/EditorCanvasRenderer'
import { mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { BackgroundType, GridType, type IBackground, type IGrid } from '@/core/canvas/types'
import { fontRenderStyle } from '@/core/script/globals'
import type { ILayoutTransformGrid } from '@/core/utils/grid'
import type { SdfMetrics } from './sdf'

export type { SdfMetrics }

export function getCharacterMetrics(_char?: ICharacterFileLite | null): SdfMetrics {
  // 动效渲染与高级编辑预览一致：优先文件字体设置，回退到默认 em 度量
  const fs = useProjectStore().selectedFile?.fontSettings as
    | { unitsPerEm?: number; descender?: number; advanceWidth?: number }
    | undefined
  const unitsPerEm = fs?.unitsPerEm ?? 1000
  return {
    unitsPerEm,
    descender: fs?.descender ?? -200,
    advanceWidth: fs?.advanceWidth ?? unitsPerEm,
  }
}

/** 布局网格（与编辑画布一致：currentGrid 生效） */
export function characterLayoutGrid(char: ICharacterFileLite): ILayoutTransformGrid | undefined {
  ensureCharacterInfoGridSettings(char)
  const gs = char.info?.gridSettings
  if (!gs?.initialGrid || !gs?.currentGrid) return undefined
  return {
    initialGrid: gs.initialGrid,
    currentGrid: gs.currentGrid,
    gridEditTarget: 'currentGrid',
  }
}

/** 当前字符的有序组件列表 */
export function characterOrderedComponents(char: ICharacterFileLite): IComponent[] {
  return orderedListWithItemsForCharacterFile(char)
}

/** 组件填充色（与编辑器一致：comp.fillColor → value.fillColor → '#000'） */
export function componentFillColor(comp: IComponent): string {
  const raw = comp as { fillColor?: string; value?: { fillColor?: string } }
  return (
    (raw.value?.fillColor && String(raw.value.fillColor).trim()) ||
    (raw.fillColor && String(raw.fillColor).trim()) ||
    '#000'
  )
}

/** 字符中所有字形组件（笔画），供组件列表/参数编辑使用 */
export function characterGlyphComponents(char: ICharacterFileLite): IGlyphComponent[] {
  const out: IGlyphComponent[] = []
  for (const comp of char.components || []) {
    if (comp.type === 'glyph') out.push(comp as IGlyphComponent)
  }
  return out
}

/** 可参与动效编辑的参数行（Number/Enum/Constant；Number 型常量参数同样可编辑） */
export function editableParameterRowsOf(rows: unknown): IParameter[] {
  const list = (rows as IParameter[] | undefined) ?? []
  return list.filter(
    (r) =>
      r.type === ParameterType.Number ||
      r.type === ParameterType.Enum ||
      r.type === ParameterType.Constant,
  )
}

/** 字形可编辑参数行 */
export function editableParameterRows(glyph: ICustomGlyph): IParameter[] {
  return editableParameterRowsOf(parameterRowsForGlyph(glyph))
}

/** 字符自身参数行（字符与字形一样可以包含参数） */
export function characterParameterRows(char: ICharacterFileLite): IParameter[] {
  return editableParameterRowsOf(char.parameters)
}

// ================= 烘焙克隆（实例隔离） =================

/**
 * 递归替换克隆中所有字形组件的 uuid（含字形 value 内嵌套的字形组件），
 * 并同步各层 orderedList。返回新 key 列表，渲染结束后统一释放。
 */
function rekeyCloneComponentKeys(char: ICharacterFileLite): { keys: string[]; uuidMap: Map<string, string> } {
  const keys: string[] = []
  /** 原 uuid → 新 uuid（仅字形组件；嵌套字形共用映射表） */
  const uuidMap = new Map<string, string>()

  const remapList = (
    components: IComponent[] | undefined,
    orderedList: Array<{ type: string; uuid: string }> | undefined,
  ) => {
    if (!components) return
    const localMap = new Map<string, string>()
    for (const comp of components) {
      if (comp.type !== 'glyph') continue
      const next = genUUID()
      localMap.set(comp.uuid, next)
      uuidMap.set(comp.uuid, next)
      comp.uuid = next
      keys.push(next)
      const value = (comp as IGlyphComponent).value as ICustomGlyph | undefined
      if (value && typeof value === 'object') {
        remapList(value.components, value.orderedList)
      }
    }
    if (orderedList && localMap.size > 0) {
      for (const item of orderedList) {
        const next = localMap.get(item.uuid)
        if (next) item.uuid = next
      }
    }
  }

  remapList(char.components, char.orderedList)
  return { keys, uuidMap }
}

export interface BakeCloneSession {
  clone: ICharacterFileLite
  /** 原组件 uuid → 克隆中新 uuid（用于把关键帧里存的原始 uuid 映射到克隆） */
  uuidMap: Map<string, string>
  /**
   * 执行字符脚本（字符自身参数 → 组件再生成），使用独立实例 key。
   * 仅当关键帧实际包含字符参数变化时才执行（避免非幂等脚本重复运行）；
   * 执行后将脚本产物（components/orderedList）同步回克隆。
   */
  runCharacterScript: (shouldRun: boolean) => void
  /** 释放本次渲染创建的全部临时实例（必须调用） */
  release: () => void
}

/** 创建渲染用克隆：深拷贝 + 组件 rekey，与编辑实例完全隔离 */
export function createBakeClone(char: ICharacterFileLite): BakeCloneSession {
  const clone = R.clone(char) as ICharacterFileLite
  const { keys: glyphKeys, uuidMap } = rekeyCloneComponentKeys(clone)
  let charKey: string | null = null
  // 快照当前实例池：release 时清扫本次渲染新增的临时实例（字符脚本可能新建组件）
  const pool = (instanceManager as unknown as { instancePool?: Map<string, { type?: string }> })
    .instancePool
  const beforeKeys = pool ? new Set(pool.keys()) : null

  return {
    clone,
    uuidMap,
    runCharacterScript: (shouldRun: boolean) => {
      const script = clone.script
      if (!shouldRun || !script) return
      // 独立 key：不与编辑中的 Character 实例（key = 字符 uuid）冲突
      charKey = `${clone.uuid}-bake-${genUUID()}`
      executeCharacterScript(clone, charKey)
      // 字符脚本在实例的浅拷贝数组上产出组件，同步回克隆
      const inst = instanceManager.getInstance(charKey, () => null as never, 'character') as
        | { _character?: ICharacterFileLite }
        | null
      if (inst?._character) {
        clone.components = inst._character.components || []
        clone.orderedList = inst._character.orderedList || []
      }
    },
    release: () => {
      for (const k of glyphKeys) {
        instanceManager.releaseTemporaryInstance(k)
      }
      if (charKey) {
        instanceManager.releaseTemporaryInstance(charKey)
      }
      // 清扫本次渲染期间新增的临时字形实例（字符脚本动态创建的组件不在 glyphKeys 中）
      if (pool && beforeKeys) {
        for (const [k, inst] of pool) {
          if (!beforeKeys.has(k) && inst?.type === 'glyph' && instanceManager.isTemporary(k)) {
            instanceManager.releaseTemporaryInstance(k)
          }
        }
      }
    },
  }
}

/** 在注入的常量覆盖环境下执行 fn（恢复现场） */
export function withKeyframeConstantsMap<T>(
  constants: Record<string, number> | undefined,
  fn: () => T,
): T {
  if (!constants || Object.keys(constants).length === 0) return fn()
  const file = useProjectStore().selectedFile
  const list = (file?.constants ?? []).map((c) => ({
    ...c,
    value: constants[c.uuid] !== undefined ? constants[c.uuid] : c.value,
  }))
  const cm = ConstantsMap.createLocal(list)
  const prev = getGlobalConstantsMap()
  setGlobalConstantsMap(cm)
  try {
    return fn()
  } finally {
    setGlobalConstantsMap(prev)
  }
}

/** 关键帧参数草稿覆盖（当前正在编辑的值） */
export interface KeyframeOverride {
  componentUuid?: string
  params?: Record<string, number>
  charParams?: Record<string, number>
  /** 选中组件的位置草稿（ox/oy） */
  positions?: { x: number; y: number }
}

/**
 * 将关键帧参数快照应用到渲染克隆（原地修改；脚本执行由调用方负责）。
 * - 字形参数：按 componentUUID/paramUUID 覆盖
 * - 组件位置（ox/oy）：关键帧存储值优先，当前编辑的组件用草稿覆盖
 * - 字符参数：按 paramUUID 覆盖（由 runCharacterScript 驱动组件再生成）
 * override 优先于关键帧存储值。
 */
export function applyKeyframeParamsToCharacter(
  char: ICharacterFileLite,
  keyframe: IAnimationKeyframe,
  override?: KeyframeOverride,
  /** 克隆组件的 uuid 已 rekey：原 uuid → 新 uuid（用于把关键帧里的原始 uuid 映射回克隆） */
  uuidMap?: Map<string, string>,
): void {
  // 反向映射：克隆 uuid → 原始 uuid
  let reverse: Map<string, string> | null = null
  if (uuidMap) {
    reverse = new Map<string, string>()
    for (const [orig, next] of uuidMap) reverse.set(next, orig)
  }
  const origOf = (uuid: string) => (reverse ? reverse.get(uuid) ?? uuid : uuid)

  // 字形组件参数
  for (const comp of char.components || []) {
    if (comp.type !== 'glyph') continue
    const gc = comp as IGlyphComponent
    const glyph = gc.value as ICustomGlyph | undefined
    if (!glyph || typeof glyph !== 'object') continue

    const origUuid = origOf(comp.uuid)
    const stored = keyframe.params[origUuid]
    const draft = override && override.componentUuid === origUuid ? override.params : null

    for (const row of editableParameterRows(glyph)) {
      if (row.type === ParameterType.Constant) continue // 常量走 keyframe.constants 注入
      const v =
        draft && draft[row.uuid] !== undefined
          ? draft[row.uuid]
          : stored && stored[row.uuid] !== undefined
            ? stored[row.uuid]
            : undefined
      if (v === undefined) continue
      if (Number(row.value) !== Number(v)) {
        row.value = v
        // glyphSkeleton 笔画的脚本读取 referenceGlyphData.parameters，同步镜像
        const refData = (glyph as unknown as { skeleton?: { referenceGlyphData?: { parameters?: Array<{ uuid: string; value: unknown }> } } })
          .skeleton?.referenceGlyphData
        if (refData?.parameters) {
          const rp = refData.parameters.find((p) => p.uuid === row.uuid)
          if (rp) rp.value = v
        }
      }
    }

    // 组件位置（ox/oy）
    const storedPos = keyframe.positions?.[origUuid]
    const draftPos = override && override.componentUuid === origUuid ? override.positions : null
    const pos = draftPos ?? storedPos
    if (pos) {
      gc.ox = pos.x
      gc.oy = pos.y
    }
  }

  // 字符自身参数
  const charStored = keyframe.charParams
  const charDraft = override?.charParams
  if ((charStored || charDraft) && Array.isArray(char.parameters)) {
    for (const row of char.parameters as IParameter[]) {
      if (row.type === ParameterType.Constant) continue
      const v =
        charDraft && charDraft[row.uuid] !== undefined
          ? charDraft[row.uuid]
          : charStored && charStored[row.uuid] !== undefined
            ? charStored[row.uuid]
            : undefined
      if (v === undefined) continue
      if (Number(row.value) !== Number(v)) row.value = v
    }
  }
}

/**
 * 关键帧可见组件列表（原始 uuid 映射到克隆新 uuid）。
 * 整字符 hidden 返回空；hiddenComponents 中的组件被过滤。
 */
export function visibleComponentsForBake(
  session: BakeCloneSession,
  keyframe: IAnimationKeyframe,
): IComponent[] {
  if (keyframe.hidden) return []
  if (!keyframe.hiddenComponents || keyframe.hiddenComponents.length === 0) {
    return characterOrderedComponents(session.clone)
  }
  const hiddenNew = new Set<string>()
  for (const orig of keyframe.hiddenComponents) {
    const next = session.uuidMap.get(orig)
    if (next) hiddenNew.add(next)
  }
  return characterOrderedComponents(session.clone).filter((c) => !hiddenNew.has(c.uuid))
}

/** 对渲染克隆上全部字形组件执行脚本（脚本组件实例需要 _components 才能渲染） */
export function executeAllGlyphScriptsOnClone(char: ICharacterFileLite): void {
  for (const comp of char.components || []) {
    if (comp.type !== 'glyph') continue
    const glyph = (comp as IGlyphComponent).value as ICustomGlyph | undefined
    if (!glyph || typeof glyph !== 'object') continue
    executeGlyphScript(glyph, comp.uuid, { ignoreTempDataGuard: true })
  }
}

// 渲染画布（模块级复用，避免每次渲染分配大画布；仅在渲染调用栈内使用）
let bakeRenderCanvas: HTMLCanvasElement | null = null

/**
 * 用编辑画布同一渲染管线（EditorCanvasRenderer.render）把字符画到离屏画布上。
 * 临时切换 fontRenderStyle（结束后恢复）；字符文字置空避免背景字体提示污染画面。
 */
export function renderCharacterLikeEditor(
  clone: ICharacterFileLite,
  visible: IComponent[],
  style: 'color' | 'black' | 'contour',
): HTMLCanvasElement {
  const file = useProjectStore().selectedFile
  const width = mapCanvasWidth(file?.width || 1000)
  const height = mapCanvasHeight(file?.height || 1000)
  if (!bakeRenderCanvas) bakeRenderCanvas = document.createElement('canvas')
  bakeRenderCanvas.width = width
  bakeRenderCanvas.height = height

  const prevStyle = fontRenderStyle.value
  fontRenderStyle.value = style
  try {
    renderCharacterEditorCanvas(bakeRenderCanvas, true, false, {
      mode: 'character',
      character: { ...clone, character: { ...clone.character, text: '' } },
      components: visible,
      background: { type: BackgroundType.Color, color: '#FFFFFF' } as IBackground,
      grid: { type: GridType.None, precision: 20 } as IGrid,
      layoutTransformGrid: characterLayoutGrid(clone),
    })
  } finally {
    fontRenderStyle.value = prevStyle
  }
  return bakeRenderCanvas
}
