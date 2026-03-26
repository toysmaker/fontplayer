/**
 * Web 默认模板工程：按 components_list 将「字玩标准黑体」例字中的测试笔画模板变换后写入工程字符，并移除非测试笔画模板组件。
 * 对齐 legacy fileHandlers.replaceComponents：加载后合并字玩标准黑体 stroke_glyphs、过滤后刷新轮廓（见 refreshCharacterListContours）。
 */

import * as R from 'ramda'
import type {
  ICharacterFileLite,
  ICharacterFileMetadata,
  IComponent,
  IConstant,
  ICustomGlyph,
  IFontSettings,
  IGlyphComponent,
} from '@/core/types'
import { ContourConverter } from '@/core/font/converter'
import { CanvasManager } from '@/core/canvas/CanvasManager'
import { ConstantsMap } from '@/core/script/ConstantsMap'
import { getGlobalConstantsMap, setGlobalConstantsMap } from '@/core/script/ParametersMap'
import { setGlyphScriptLookupExtras } from '@/core/script/ScriptExecutor'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { selectedItemByUUID } from '@/core/utils/component'
import {
  extractLeafParts,
  getMatchIndex,
  type LeafPart,
} from '@/features/decomposition/utils'
import {
  getComponentBound,
  getTransformByBounds,
  standardTransformStrokes,
} from '@/features/advancedEdit/scripts/utils'
import { genUUID } from '@/utils/uuid'

/** 与 processing.CharacterDecompositionRow 一致（避免与 processing 循环依赖） */
interface DictionaryRowForReplace {
  character: string
  decomposition: string | null
  decomposition2?: string | null
  matches: (number[] | null)[]
}

type MatchTuple = [string, string[][]]

function getMatchesArray(character: ICharacterFileLite): MatchTuple[] {
  const m = character.matches
  if (!Array.isArray(m)) return []
  return m as MatchTuple[]
}

function findAllIndexFromParts(parts: LeafPart[], compName: string): number[][] {
  const arr: number[][] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.name === compName) {
      arr.push(part.match)
    }
  }
  return arr
}

function isTestStrokeTemplate(comp: IComponent): boolean {
  const v = comp.value as ICustomGlyph | undefined
  return v?.style === '测试笔画模板'
}

function templateCharacterToLite(raw: Record<string, unknown>): ICharacterFileLite {
  const c = raw as unknown as ICharacterFileLite
  return {
    uuid: c.uuid,
    type: c.type,
    character: c.character,
    components: c.components ?? [],
    groups: c.groups ?? [],
    orderedList: c.orderedList ?? [],
    view: c.view ?? { zoom: 100, translateX: 0, translateY: 0 },
    info: c.info,
    selectedComponentsTree: c.selectedComponentsTree,
    selectedComponentsUUIDs: c.selectedComponentsUUIDs,
    script: c.script,
    glyph_script: c.glyph_script,
    decomposition: c.decomposition,
    matches: c.matches,
  }
}

let cachedComponentsList: unknown[] | null = null
let cachedTemplatePack: {
  targetCharactersJson: ICharacterFileLite[]
  stroke_glyphs: ICustomGlyph[]
} | null = null

function mergeGlyphsByUuid(primary: ICustomGlyph[], secondary: ICustomGlyph[]): ICustomGlyph[] {
  const map = new Map<string, ICustomGlyph>()
  for (const g of primary) {
    map.set(g.uuid, g)
  }
  for (const g of secondary) {
    map.set(g.uuid, g)
  }
  return [...map.values()]
}

/**
 * 将 v3 模板中的 stroke_glyphs 并入工程笔画池（同 uuid 以工程内为准），对齐 legacy 对 json.stroke_glyphs 的 instanceGlyph + addGlyph。
 * 须在 processGlyphs 之前调用，以便新并入的笔画执行脚本并写入 contourRef/previewRef。
 */
export async function mergeProjectStrokeGlyphsWithTemplatePack(
  projectStrokes: ICustomGlyph[],
): Promise<ICustomGlyph[]> {
  try {
    await ensureTemplateCharacterPack()
    return mergeGlyphsByUuid(getTemplateStrokeGlyphsCached(), projectStrokes)
  } catch (e) {
    console.error('[mergeProjectStrokeGlyphsWithTemplatePack]', e)
    return projectStrokes
  }
}

async function ensureComponentsListJson(): Promise<unknown[]> {
  if (cachedComponentsList) return cachedComponentsList
  const res = await fetch('/data/components_list_draft_v5_temp.json')
  if (!res.ok) throw new Error(`[replaceTemplateComponents] components_list fetch ${res.status}`)
  cachedComponentsList = (await res.json()) as unknown[]
  return cachedComponentsList
}

async function ensureTemplateCharacterPack(): Promise<ICharacterFileLite[]> {
  if (cachedTemplatePack) return cachedTemplatePack.targetCharactersJson
  const res = await fetch('/data/字玩标准黑体_组件_v3.json')
  if (!res.ok) throw new Error(`[replaceTemplateComponents] template JSON fetch ${res.status}`)
  const json = (await res.json()) as {
    file?: { characterList?: unknown[] }
    stroke_glyphs?: ICustomGlyph[]
  }
  const list = json.file?.characterList ?? []
  cachedTemplatePack = {
    targetCharactersJson: list.map((row) => templateCharacterToLite(row as Record<string, unknown>)),
    stroke_glyphs: json.stroke_glyphs ?? [],
  }
  return cachedTemplatePack.targetCharactersJson
}

function getTemplateStrokeGlyphsCached(): ICustomGlyph[] {
  return cachedTemplatePack?.stroke_glyphs ?? []
}

/**
 * 与原版 fontplayer `stores/files.ts` 的 `orderedListWithItemsForCharacterFile` 一致：
 * group 项会展开为 `groups` 中的条目，参与下标计数。
 * 重构版 `FormatGlyphService` 为编辑态省略了 group，若用于 replace 会导致 part_index 与 components_list 错位。
 */
function orderedListWithItemsForReplaceLegacy(character: ICharacterFileLite): IGlyphComponent[] {
  if (!character.orderedList?.length) {
    return character.components ?? []
  }
  return character.orderedList
    .map((item: { type: string; uuid: string }) => {
      if (item.type === 'group') {
        return selectedItemByUUID(character.groups ?? [], item.uuid)
      }
      return selectedItemByUUID(character.components, item.uuid)
    })
    .filter((x): x is NonNullable<typeof x> => x != null) as IGlyphComponent[]
}

function extractTemplateStrokesForExample(
  targetCharacterData: ICharacterFileLite,
  partIndex: number,
  partStrokesCount: number,
): IGlyphComponent[] {
  const visible = orderedListWithItemsForReplaceLegacy(targetCharacterData).filter(
    (item) => (item as { visible?: boolean }).visible,
  ) as IGlyphComponent[]
  const removed = visible.splice(partIndex, partStrokesCount)
  return removed.filter((item) => isTestStrokeTemplate(item)) as IGlyphComponent[]
}

export interface ReplaceTemplateComponentsOptions {
  map: Map<string, DictionaryRowForReplace>
  /** 当前工程 load 数据中的字形池（loadProject 尚未 addFile 时 selectedFile 不可用）；与模板 stroke_glyphs 合并后供 script_reference 解析 */
  projectGlyphsForScriptLookup?: ICustomGlyph[]
  /** 工程全局常量（loadProject 在写入 store 前执行替换，需注入以便参数/脚本解析） */
  projectConstants?: IConstant[]
  /** 用于替换结束后按字重算组件 contour/preview（对齐 refreshCharacterListContours） */
  fontSettings?: IFontSettings
  onProgress?: (done: number, total: number) => void
  yieldToMain?: () => Promise<void>
}

function sanitizeCharacterAfterTemplateFilter(character: ICharacterFileLite): void {
  const keep = new Set(character.components.map((c) => c.uuid))
  character.groups = (character.groups || []).filter((g) => keep.has(g.uuid))
  delete character.previewRef
  delete character.contourRef
  character.selectedComponentsTree = undefined
  CanvasManager.invalidateCache(character.uuid)
}

async function refreshCharacterContoursAfterTemplateReplace(
  fileUuid: string,
  metadataList: ICharacterFileMetadata[],
  fontSettings: IFontSettings | undefined,
  yieldToMain?: () => Promise<void>,
): Promise<void> {
  const unitsPerEm = fontSettings?.unitsPerEm || 1000
  const descender = fontSettings?.descender ?? -200
  const baseOpts = {
    unitsPerEm,
    descender,
    advanceWidth: unitsPerEm,
    forceUpdate: true,
  }
  for (let i = 0; i < metadataList.length; i++) {
    const meta = metadataList[i]!
    const character = await characterDataManager.loadCharacter(fileUuid, meta.uuid)
    if (!character) continue
    try {
      const components = ContourConverter.getComponentsForCharacter(character)
      if (components.length === 0) continue
      ContourConverter.componentsToContours(
        components,
        { ...baseOpts, preview: false },
        { x: 0, y: 0 },
      )
      ContourConverter.componentsToContours(
        components,
        { ...baseOpts, preview: true },
        { x: 0, y: 0 },
      )
      await characterDataManager.updateCharacter(fileUuid, character)
    } catch (e) {
      console.error(`[replaceTemplateComponents] refresh contours ${meta.uuid}`, e)
    }
    if (yieldToMain && (i + 1) % 50 === 0) {
      await yieldToMain()
    }
  }
}

/**
 * 在部件分解已写入各字符后调用；按字典与 components_list 替换笔画并统一过滤非「测试笔画模板」组件。
 */
export async function replaceTemplateComponentsForOpenedProject(
  fileUuid: string,
  metadataList: ICharacterFileMetadata[],
  options: ReplaceTemplateComponentsOptions,
): Promise<void> {
  const dictionaryMap = options.map
  const componentsListJson = await ensureComponentsListJson()
  const targetCharactersJson = await ensureTemplateCharacterPack()
  const templateStrokeGlyphs = getTemplateStrokeGlyphsCached()
  const projectFromData = options.projectGlyphsForScriptLookup ?? []
  const mergedForScript = mergeGlyphsByUuid(projectFromData, templateStrokeGlyphs)
  setGlyphScriptLookupExtras(mergedForScript)
  const prevGlobalConstantsMap = getGlobalConstantsMap()
  setGlobalConstantsMap(ConstantsMap.createLocal(options.projectConstants ?? []))

  try {
  let to_be_modified_str = ''
  let stroke_undefined_str = ''
  let origin_stroke_undefined_str = ''
  let part_undefined_str = ''
  let to_be_added_dic_str = ''
  let to_be_modified_str_1 = ''
  let to_be_modified_str_2 = ''
  let has_same_comp_str = ''
  let has_same_comp_diff_variation_str = ''
  let target_character_not_found_str = ''

  const same_comp_characters_map = new Map<string, boolean>()

  for (let i = 0; i < componentsListJson.length; i++) {
    const component = componentsListJson[i] as Record<string, unknown>
    const component_name = component.name as string
    const component_id = component.id as string | number
    const example = component.example as string

    for (let j = 0; j < example.length; j++) {
      const exampleChar = example[j]
      const partIndexRaw = Array.isArray(component.part_index)
        ? (component.part_index as number[])[j]
        : (component.part_index as number)
      const partStrokesCountRaw = Array.isArray(component.part_strokes_count)
        ? (component.part_strokes_count as number[])[j]
        : (component.part_strokes_count as number)
      const partIndex = partIndexRaw
      const partStrokesCount = partStrokesCountRaw

      const target_character_data = targetCharactersJson.find(
        (charFile) => charFile.character?.text === exampleChar,
      )
      if (!target_character_data) {
        target_character_not_found_str += `${exampleChar},`
        continue
      }

      const strokes = extractTemplateStrokesForExample(target_character_data, partIndex, partStrokesCount)

      const variation = component.variation as unknown[] | undefined
      let charactersStr: string
      if (variation?.length) {
        const vj = variation[j] as { characters?: string } | undefined
        charactersStr = vj?.characters ?? (component.characters as string)
      } else {
        charactersStr = component.characters as string
      }

      for (let k = 0; k < charactersStr.length; k++) {
        const char = charactersStr[k]

        if (same_comp_characters_map.get(`${char}-${component_id}`)) {
          continue
        }

        const dic_data = dictionaryMap.get(char)
        if (!dic_data) {
          to_be_added_dic_str += `${char},`
          continue
        }
        const meta = metadataList.find((m) => m.character?.text === char)
        if (!meta) {
          continue
        }
        const fileCharacter = await characterDataManager.loadCharacter(fileUuid, meta.uuid)
        if (!fileCharacter) {
          to_be_modified_str += `${char},`
          continue
        }

        let parts = extractLeafParts(dic_data.decomposition as string | null)

        let match_indices: (string | number[] | 'all' | 'null')[] = []
        if (component_name.includes('_')) {
          match_indices = getMatchIndex(dic_data.decomposition2, component_id) as unknown as (
            | number[]
            | string
            | 'all'
            | 'null'
          )[]
        } else if (component_name === '川2') {
          const part = parts.find((item) => item.name === '川')
          if (!part) {
            part_undefined_str += `${component_name},`
            continue
          }
          match_indices = [part.match]
        } else if (component_name === char) {
          match_indices = ['all']
        } else if (dic_data.decomposition === null) {
          match_indices = ['null']
        } else {
          match_indices = findAllIndexFromParts(parts, component_name)
          if (!match_indices || !match_indices.length) {
            if (component_name === '士') {
              match_indices = findAllIndexFromParts(parts, '土')
            } else if (component_name === '日') {
              match_indices = findAllIndexFromParts(parts, '曰')
            } else if (component_name === '月') {
              match_indices = findAllIndexFromParts(parts, '⺼')
            }

            if (!match_indices || !match_indices.length) {
              part_undefined_str += `${component_name},`
              continue
            }
          }
        }

        for (let n = 0; n < match_indices.length; n++) {
          const match_index = Array.isArray(match_indices[n])
            ? (match_indices[n] as number[]).join(',')
            : String(match_indices[n])

          if (n >= 1) {
            if (!has_same_comp_str.includes(char)) {
              has_same_comp_str += `${char},`
              if (variation?.length) {
                has_same_comp_diff_variation_str += `${char},`
              }
              same_comp_characters_map.set(`${char}-${component_id}`, true)
            }
          }

          const matchesArr = getMatchesArray(fileCharacter)
          if (match_index !== 'all' && !matchesArr.find((match) => match[0] === match_index)) {
            if (!to_be_modified_str.includes(char)) {
              to_be_modified_str += `${char},`
              if (!match_index) {
                to_be_modified_str_1 += `${char},`
              } else {
                to_be_modified_str_2 += `${char},`
              }
            }
            continue
          }

          const ordered_components = orderedListWithItemsForReplaceLegacy(fileCharacter)
          let originStrokes: IComponent[] = []
          if (match_index === 'all') {
            originStrokes = ordered_components
          } else {
            const matchRow = matchesArr.find((m) => m[0] === match_index)
            if (!matchRow) continue
            const originStrokes_uuids = matchRow[1]
            originStrokes = R.flatten(originStrokes_uuids).map((uuid) =>
              fileCharacter.components.find((c) => c.uuid === uuid),
            ) as IComponent[]
          }

          if (strokes.filter((stroke) => !stroke).length) {
            stroke_undefined_str += `${component_name},`
            continue
          } else if (originStrokes.filter((stroke) => !stroke).length) {
            origin_stroke_undefined_str += `${char},`
            continue
          }

          const targetBound = getComponentBound(strokes as unknown as IGlyphComponent[][], 100)
          const finalBound = getComponentBound(originStrokes as unknown as IGlyphComponent[][], 50)

          const transform = getTransformByBounds(targetBound, finalBound)
          const finalStrokes = R.flatten(
            standardTransformStrokes(strokes as unknown as IGlyphComponent[][], transform),
          ) as IGlyphComponent[]

          finalStrokes.forEach((stroke) => {
            stroke.uuid = genUUID()
          })

          fileCharacter.components.push(...finalStrokes)
          fileCharacter.orderedList.push(
            ...finalStrokes.map((stroke) => ({
              uuid: stroke.uuid,
              type: 'component' as const,
            })),
          )
        }

        await characterDataManager.updateCharacter(fileUuid, fileCharacter)
      }
    }
  }

  console.log('[replaceTemplateComponents] to_be_modified_str', to_be_modified_str)
  console.log('[replaceTemplateComponents] stroke_undefined_str', stroke_undefined_str)
  console.log('[replaceTemplateComponents] origin_stroke_undefined_str', origin_stroke_undefined_str)
  console.log('[replaceTemplateComponents] part_undefined_str', part_undefined_str)
  console.log('[replaceTemplateComponents] to_be_added_dic_str', to_be_added_dic_str)
  console.log('[replaceTemplateComponents] to_be_modified_str_1', to_be_modified_str_1)
  console.log('[replaceTemplateComponents] to_be_modified_str_2', to_be_modified_str_2)
  console.log('[replaceTemplateComponents] has_same_comp_str', has_same_comp_str)
  console.log('[replaceTemplateComponents] has_same_comp_diff_variation_str', has_same_comp_diff_variation_str)
  console.log('[replaceTemplateComponents] target_character_not_found_str', target_character_not_found_str)

  const total = metadataList.length
  const yieldToMain = options.yieldToMain
  for (let i = 0; i < metadataList.length; i++) {
    const meta = metadataList[i]!
    const character = await characterDataManager.loadCharacter(fileUuid, meta.uuid)
    if (!character) continue

    const uuidsToRemove = character.components
      .filter((item) => (item.value as ICustomGlyph | undefined)?.style !== '测试笔画模板')
      .map((item) => item.uuid)

    character.components = character.components.filter((item) =>
      isTestStrokeTemplate(item),
    )
    character.orderedList = character.orderedList.filter(
      (orderedItem) => !uuidsToRemove.includes(orderedItem.uuid),
    )
    if (character.components.length > 0) {
      character.selectedComponentsUUIDs = [character.components[0]!.uuid]
    } else {
      character.selectedComponentsUUIDs = []
    }

    sanitizeCharacterAfterTemplateFilter(character)

    await characterDataManager.updateCharacter(fileUuid, character)
    const done = i + 1
    if (done % 10 === 0 || done === total) {
      options.onProgress?.(done, total)
    }
    if (yieldToMain && done % 50 === 0) {
      await yieldToMain()
    }
  }

  await refreshCharacterContoursAfterTemplateReplace(
    fileUuid,
    metadataList,
    options.fontSettings,
    yieldToMain,
  )
  } finally {
    setGlobalConstantsMap(prevGlobalConstantsMap)
    setGlyphScriptLookupExtras(null)
  }
}
