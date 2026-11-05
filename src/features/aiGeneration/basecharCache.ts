/**
 * basechar 骨架图缓存 — 字符生成用
 *
 * 骨架图 = 内置模板字符渲染 → 缩 128×128 → alpha>30 二值掩码 (复刻 demo9 load_base_skeleton)。
 *
 * 两层缓存:
 *   1. 内存 Map (会话级, 上限 MEMORY_LIMIT 张, 每张 128×128 float32 = 64KB)
 *   2. IndexedDB (跨会话复用, 存 float32 掩码)
 *
 * 生成完成后调用 clearMemoryCache() 释放会话级内存, IndexedDB 保留供下次复用。
 */
import localforage from 'localforage'

const MASK_SIZE = 128
const MEMORY_LIMIT = 500
/**
 * 缓存数据版本: 骨架来源/处理逻辑变更时 +1, 自动清空旧缓存
 * (v1 为模板渲染管线的掩码, 与当前 PNG 管线不兼容)
 */
const CACHE_VERSION = 2

let _db: ReturnType<typeof localforage.createInstance> | null = null
let _versionChecked = false

function getDb() {
  if (!_db) {
    _db = localforage.createInstance({ name: 'fontplayer_storage', storeName: 'ai_basechar_cache' })
  }
  return _db
}

async function ensureCacheVersion(): Promise<void> {
  if (_versionChecked) return
  _versionChecked = true
  try {
    const db = getDb()
    const v = await db.getItem<number>('version')
    if (v !== CACHE_VERSION) {
      await db.clear()
      await db.setItem('version', CACHE_VERSION)
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[aiGeneration] basechar 缓存版本检查失败', e)
    }
  }
}

/** 会话级内存缓存: unicode → 128×128 {0,1} float32 */
const _memCache = new Map<number, Float32Array>()

function dbKey(unicode: number): string {
  return `basechar_${unicode}`
}

export async function getCachedBasechar(unicode: number): Promise<Float32Array | null> {
  await ensureCacheVersion()
  const hit = _memCache.get(unicode)
  if (hit) {
    // 刷新插入顺序 (简易 LRU)
    _memCache.delete(unicode)
    _memCache.set(unicode, hit)
    return hit
  }
  try {
    const stored = (await getDb().getItem<Float32Array>(dbKey(unicode))) ?? null
    if (stored && stored.length === MASK_SIZE * MASK_SIZE) {
      _memCache.set(unicode, stored)
      return stored
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[aiGeneration] basechar 缓存读取失败', e)
    }
  }
  return null
}

export async function setCachedBasechar(unicode: number, mask: Float32Array): Promise<void> {
  await ensureCacheVersion()
  _memCache.set(unicode, mask)
  while (_memCache.size > MEMORY_LIMIT) {
    const oldest = _memCache.keys().next().value
    if (oldest === undefined) break
    _memCache.delete(oldest)
  }
  try {
    await getDb().setItem(dbKey(unicode), mask)
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[aiGeneration] basechar 缓存写入失败', e)
    }
  }
}

/** 生成完成后释放会话级内存缓存 (IndexedDB 保留) */
export function clearMemoryCache(): void {
  _memCache.clear()
}

export function getMaskSize(): number {
  return MASK_SIZE
}
