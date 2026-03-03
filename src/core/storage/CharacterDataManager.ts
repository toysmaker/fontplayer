/**
 * 字符数据管理器
 * 负责从IndexedDB按需加载字符数据，减少内存占用
 */

import { indexedDBManager } from './IndexedDBManager'
import type { ICharacterFileLite, ICharacterFileMetadata } from '../types'

export class CharacterDataManager {
  private static instance: CharacterDataManager
  private cache: Map<string, ICharacterFileLite> = new Map()
  private loadingPromises: Map<string, Promise<ICharacterFileLite | null>> = new Map()
  private readonly MAX_CACHE_SIZE = 100 // 最多缓存100个字符数据

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
    // 如果缓存已满，删除最旧的
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, character)
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
   */
  async updateCharacter(fileUUID: string, character: ICharacterFileLite): Promise<void> {
    const key = CharacterDataManager.generateCharacterKey(fileUUID, character.uuid)
    const cacheKey = `${fileUUID}_${character.uuid}`

    // 更新IndexedDB
    await indexedDBManager.set(key, character)

    // 更新缓存
    if (this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, character)
    }
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
  }
}

// 导出单例
export const characterDataManager = CharacterDataManager.getInstance()
