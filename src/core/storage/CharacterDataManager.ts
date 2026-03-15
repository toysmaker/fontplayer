/**
 * 字符数据管理器
 * 负责从IndexedDB按需加载字符数据，减少内存占用
 */

import { indexedDBManager } from './IndexedDBManager'
import type { ICharacterFileLite, ICharacterFileMetadata } from '../types'

export class CharacterDataManager {
  private static instance: CharacterDataManager
  private cache: Map<string, ICharacterFileLite> = new Map()
  private cacheAccessTime: Map<string, number> = new Map() // 记录访问时间，用于 LRU
  private loadingPromises: Map<string, Promise<ICharacterFileLite | null>> = new Map()
  private readonly MAX_CACHE_SIZE = 30 // 最多缓存30个字符数据（减少内存占用）

  private constructor() {}

  static getInstance(): CharacterDataManager {
    if (!CharacterDataManager.instance) {
      CharacterDataManager.instance = new CharacterDataManager()
    }
    return CharacterDataManager.instance
  }

  /**
   * 生成字符数据的IndexedDB键
   */
  private static generateCharacterKey(fileUUID: string, characterUUID: string): string {
    return `character_${fileUUID}_${characterUUID}`
  }

  /**
   * 批量存储字符数据到IndexedDB
   */
  async storeCharacters(fileUUID: string, characters: ICharacterFileLite[]): Promise<void> {
    const promises = characters.map(async (character) => {
      const key = CharacterDataManager.generateCharacterKey(fileUUID, character.uuid)
      await indexedDBManager.set(key, character)
    })
    await Promise.all(promises)
  }

  /**
   * 从IndexedDB加载字符数据
   */
  async loadCharacter(fileUUID: string, characterUUID: string): Promise<ICharacterFileLite | null> {
    // 检查缓存
    const cacheKey = `${fileUUID}_${characterUUID}`
    if (this.cache.has(cacheKey)) {
      // 更新访问时间（LRU）
      this.cacheAccessTime.set(cacheKey, Date.now())
      return this.cache.get(cacheKey)!
    }

    // 检查是否正在加载
    if (this.loadingPromises.has(cacheKey)) {
      return await this.loadingPromises.get(cacheKey)!
    }

    // 开始加载
    const loadPromise = this.doLoadCharacter(fileUUID, characterUUID, cacheKey)
    this.loadingPromises.set(cacheKey, loadPromise)

    try {
      const character = await loadPromise
      return character
    } finally {
      this.loadingPromises.delete(cacheKey)
    }
  }

  /**
   * 实际加载字符数据
   */
  private async doLoadCharacter(
    fileUUID: string,
    characterUUID: string,
    cacheKey: string
  ): Promise<ICharacterFileLite | null> {
    const key = CharacterDataManager.generateCharacterKey(fileUUID, characterUUID)
    const character = await indexedDBManager.get<ICharacterFileLite>(key)

    if (character) {
      // 添加到缓存
      this.addToCache(cacheKey, character)
      return character
    }

    return null
  }

  /**
   * 添加到缓存（LRU策略）
   */
  private addToCache(key: string, character: ICharacterFileLite): void {
    // 如果缓存已满，删除最久未使用的
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU()
    }
    this.cache.set(key, character)
    this.cacheAccessTime.set(key, Date.now())
  }
  
  /**
   * 移除最久未使用的缓存（LRU 策略）
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, time] of this.cacheAccessTime.entries()) {
      if (time < oldestTime) {
        oldestTime = time
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.cacheAccessTime.delete(oldestKey)
    }
  }
  
  /**
   * 清理不可见的字符数据缓存
   */
  cleanupInvisible(visibleUUIDs: Set<string>, fileUUID: string): void {
    const toRemove: string[] = []
    for (const [key] of this.cache) {
      // key 格式: fileUUID_characterUUID
      const parts = key.split('_')
      if (parts.length >= 2 && parts[0] === fileUUID) {
        const characterUUID = parts.slice(1).join('_')
        if (!visibleUUIDs.has(characterUUID)) {
          toRemove.push(key)
        }
      }
    }
    toRemove.forEach(key => {
      this.cache.delete(key)
      this.cacheAccessTime.delete(key)
    })
    
    // 如果缓存仍然超过限制，使用 LRU 策略清理
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const excess = this.cache.size - this.MAX_CACHE_SIZE
      for (let i = 0; i < excess; i++) {
        this.evictLRU()
      }
    }
  }
  
  /**
   * 强制清理所有缓存（用于内存压力大时）
   */
  forceCleanupAllCache(): void {
    this.cache.clear()
    this.cacheAccessTime.clear()
  }

  /**
   * 批量加载字符数据
   */
  async loadCharacters(fileUUID: string, characterUUIDs: string[]): Promise<Map<string, ICharacterFileLite>> {
    const results = new Map<string, ICharacterFileLite>()
    const promises = characterUUIDs.map(async (uuid) => {
      const character = await this.loadCharacter(fileUUID, uuid)
      if (character) {
        results.set(uuid, character)
      }
    })
    await Promise.all(promises)
    return results
  }

  /**
   * 更新字符数据（同时更新缓存和IndexedDB）
   * 先同步更新内存缓存，再异步写入IndexedDB，避免 loadCharacter 竞态读到旧数据
   */
  async updateCharacter(fileUUID: string, character: ICharacterFileLite): Promise<void> {
    const key = CharacterDataManager.generateCharacterKey(fileUUID, character.uuid)
    const cacheKey = `${fileUUID}_${character.uuid}`

    // 先同步更新内存缓存（无论之前是否存在），避免后续 loadCharacter 读到旧数据
    this.addToCache(cacheKey, character)

    // 再异步更新IndexedDB
    await indexedDBManager.set(key, character)
  }

  /**
   * 删除字符数据
   */
  async deleteCharacter(fileUUID: string, characterUUID: string): Promise<void> {
    const key = CharacterDataManager.generateCharacterKey(fileUUID, characterUUID)
    const cacheKey = `${fileUUID}_${characterUUID}`

    // 从IndexedDB删除
    await indexedDBManager.remove(key)

    // 从缓存删除
    this.cache.delete(cacheKey)
  }

  /**
   * 清空文件的所有字符数据
   */
  async clearFileCharacters(fileUUID: string): Promise<void> {
    const keys = await indexedDBManager.keys()
    const fileKeys = keys.filter(key => key.startsWith(`character_${fileUUID}_`))
    await indexedDBManager.removeBatch(fileKeys)

    // 清空相关缓存
    const cacheKeysToDelete: string[] = []
    for (const [key] of this.cache) {
      if (key.startsWith(`${fileUUID}_`)) {
        cacheKeysToDelete.push(key)
      }
    }
    cacheKeysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheAccessTime.clear()
  }
}

// 导出单例
export const characterDataManager = CharacterDataManager.getInstance()
