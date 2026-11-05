/**
 * 汉字读音释义服务
 *
 * 数据文件（public/data/dictionary/dictionary_zh.min.json，约 637KB）在应用
 * 启动后空闲时预热加载（requestIdleCallback），不阻塞首屏；查询按 Unicode
 * 码点 O(1) 索引。注意：vite/打包环境的静态服务会透明解压 .gz 文件，
 * 因此这里直接使用未压缩 JSON，避免依赖环境特定的解压行为。
 */

export interface DictionaryEntry {
  pinyin?: string[]
  definitionZh: string
}

export type DictionaryIndex = Record<string, DictionaryEntry>

const DATA_URL = '/data/dictionary/dictionary_zh.min.json'

let loadPromise: Promise<DictionaryIndex | null> | null = null

async function fetchDictionary(): Promise<DictionaryIndex | null> {
  try {
    const res = await fetch(DATA_URL)
    if (!res.ok) return null
    return (await res.json()) as DictionaryIndex
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[DictionaryService] load dictionary failed:', err)
    }
    return null
  }
}

/** 预热加载（应用空闲时调用一次；可重复调用，幂等） */
export function warmupDictionary(): void {
  if (!loadPromise) {
    loadPromise = fetchDictionary()
  }
}

/** 等待数据就绪（InfoPanel 查询前调用） */
export async function ensureDictionary(): Promise<DictionaryIndex | null> {
  warmupDictionary()
  return loadPromise
}

/** 按 Unicode 码点字符串查询（如 'U+4E00' 或 '4E00'） */
export function lookupByUnicode(
  index: DictionaryIndex | null,
  unicode: string,
): DictionaryEntry | null {
  if (!index) return null
  const code = unicode.replace(/^U\+/i, '').toUpperCase()
  return index[code] ?? null
}
