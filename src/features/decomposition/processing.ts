/**
 * 加载部件分解原始数据到 IndexedDB，并为字符生成 decomposition / matches（不写 fillColor）
 */

import type { ICharacterFileLite, ICharacterFileMetadata } from '@/core/types'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { useDecompositionDataStore } from '@/stores/decompositionData'
import { DECOMPOSITION_CHARACTER_LIST_IDB_KEY } from '@/features/decomposition/constants'
import { buildStrokeUuidGroupsFromOrderedComponents } from '@/features/decomposition/utils'

export interface CharacterDecompositionRow {
  character: string
  decomposition: string | null
  /** 与 character_list_final_v8 一致；部件 id 匹配（如带下划线的 component name）时用到 */
  decomposition2?: string | null
  matches: (number[] | null)[]
}

let cachedRows: CharacterDecompositionRow[] | null = null
let cachedMap: Map<string, CharacterDecompositionRow> | null = null
let loadInFlight: Promise<void> | null = null

function setCache(rows: CharacterDecompositionRow[]) {
  cachedRows = rows
  cachedMap = new Map(rows.map((r) => [r.character, r]))
}

async function readRowsFromIdb(): Promise<CharacterDecompositionRow[] | null> {
  const raw = await indexedDBManager.get<CharacterDecompositionRow[]>(DECOMPOSITION_CHARACTER_LIST_IDB_KEY)
  if (raw && Array.isArray(raw) && raw.length > 0) {
    return raw
  }
  return null
}

/**
 * 拉取（若 IDB 无则 fetch）并缓存 character_list_final_v8；更新 decompositionData store。
 */
export async function loadDecompositionData(): Promise<void> {
  if (loadInFlight) {
    return loadInFlight
  }

  loadInFlight = (async () => {
    const store = useDecompositionDataStore()
    try {
      const existing = await readRowsFromIdb()
      if (existing) {
        setCache(existing)
        store.markReady()
        return
      }

      const res = await fetch('/data/character_list_final_v8.json')
      if (!res.ok) {
        throw new Error(`[decomposition] fetch failed: ${res.status}`)
      }
      const json = (await res.json()) as CharacterDecompositionRow[]
      if (!Array.isArray(json) || json.length === 0) {
        throw new Error('[decomposition] invalid JSON payload')
      }
      await indexedDBManager.set(DECOMPOSITION_CHARACTER_LIST_IDB_KEY, json)
      setCache(json)
      store.markReady()
    } catch (e) {
      console.error('[decomposition] loadDecompositionData', e)
      throw e
    } finally {
      loadInFlight = null
    }
  })()

  return loadInFlight
}

async function ensureLookup(): Promise<Map<string, CharacterDecompositionRow> | null> {
  if (cachedMap && cachedRows?.length) {
    return cachedMap
  }
  const fromIdb = await readRowsFromIdb()
  if (fromIdb) {
    setCache(fromIdb)
    return cachedMap
  }
  return null
}

/**
 * 尽力加载分解字典；失败时返回 null、不抛错（用于打开工程等不能因字典失败而中断主流程的场景）。
 */
export async function tryEnsureDecompositionLookup(): Promise<Map<string, CharacterDecompositionRow> | null> {
  try {
    await loadDecompositionData()
  } catch (e) {
    console.error('[decomposition] tryEnsureDecompositionLookup: load failed', e)
    return null
  }
  return ensureLookup()
}

/**
 * 打开工程后：按元数据从 IDB 取完整字符，写入 decomposition / matches 并写回 IDB。
 * 用于「字玩默认模板工程」等需在本地补全分解数据的场景。
 * 可传入 options.map（由 tryEnsureDecompositionLookup 得到）以避免重复加载；未传 map 时会内部 try load，失败则静默跳过。
 */
export async function buildDecompositionForOpenedProjectCharacters(
  fileUuid: string,
  metadataList: ICharacterFileMetadata[],
  options?: {
    map?: Map<string, CharacterDecompositionRow>
    onProgress?: (done: number, total: number) => void
    yieldToMain?: () => Promise<void>
  },
): Promise<void> {
  let map = options?.map
  if (!map) {
    try {
      await loadDecompositionData()
    } catch (e) {
      console.error('[decomposition] buildDecompositionForOpenedProjectCharacters: load failed', e)
      return
    }
    map = await ensureLookup()
  }
  if (metadataList.length === 0 || !map) return

  const total = metadataList.length
  const yieldToMain = options?.yieldToMain

  for (let i = 0; i < metadataList.length; i++) {
    const meta = metadataList[i]!
    const ch = await characterDataManager.loadCharacter(fileUuid, meta.uuid)
    if (ch) {
      await buildDecompositionForCharacter(ch, map)
      await characterDataManager.updateCharacter(fileUuid, ch)
    }
    const done = i + 1
    if (done % 10 === 0 || done === total) {
      options?.onProgress?.(done, total)
    }
    if (yieldToMain && done % 50 === 0) {
      await yieldToMain()
    }
  }
}

/**
 * 为单个字符写入 decomposition、matches（与原版 processCharacters_decomposition 一致，不含 fillColor）。
 * @param dicRowOrMap 可选：单行字典或整表 Map，省略则从 IDB/内存缓存查找
 * @returns 是否成功写入字典中存在的字符
 */
export async function buildDecompositionForCharacter(
  character: ICharacterFileLite,
  dicRowOrMap?: CharacterDecompositionRow | Map<string, CharacterDecompositionRow> | null,
): Promise<boolean> {
  const charText = character.character?.text
  if (!charText) return false

  let dic: CharacterDecompositionRow | undefined
  if (dicRowOrMap instanceof Map) {
    dic = dicRowOrMap.get(charText)
  } else if (dicRowOrMap && dicRowOrMap.character === charText) {
    dic = dicRowOrMap
  }

  if (!dic) {
    const map = await ensureLookup()
    dic = map?.get(charText)
  }
  if (!dic) return false

  const strokes = buildStrokeUuidGroupsFromOrderedComponents(
    character.components ?? [],
    character.orderedList ?? [],
  )
  if (!strokes) return false

  character.decomposition = dic.decomposition

  const matches = new Map<string, string[][]>()
  for (let j = 0; j < dic.matches.length; j++) {
    const match_index = dic.matches[j] ? dic.matches[j]!.join(',') : 'null'
    const strokeGroup = strokes[j]
    if (!matches.has(match_index)) {
      matches.set(match_index, [])
    }
    matches.get(match_index)!.push(strokeGroup)
  }
  character.matches = Array.from(matches)
  return true
}

/**
 * 为字符列表批量生成 decomposition / matches（共享一次字典查找）
 */
export async function buildDecompositionForCharacterList(characters: ICharacterFileLite[]): Promise<void> {
  const map = await ensureLookup()
  if (!map) return
  for (const c of characters) {
    await buildDecompositionForCharacter(c, map)
  }
}

export {
  mergeProjectStrokeGlyphsWithTemplatePack,
  replaceTemplateComponentsForOpenedProject,
  type ReplaceTemplateComponentsOptions,
} from './replaceTemplateComponents'
