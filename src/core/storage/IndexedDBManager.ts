/**
 * IndexedDB 存储管理器
 * 用于存储大型数据（轮廓、预览等）
 */

import localForage from 'localforage'

export class IndexedDBManager {
  private static instance: IndexedDBManager
  private db: LocalForage

  private constructor() {
    this.db = localForage.createInstance({
      name: 'fontplayer_storage',
      storeName: 'large_data',
      description: 'Storage for large font data (contours, previews, etc.)',
    })
  }

  /**
   * 获取单例实例
   */
  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager()
    }
    return IndexedDBManager.instance
  }

  /**
   * 存储数据
   */
  async set(key: string, value: any): Promise<void> {
    try {
      await this.db.setItem(key, value)
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error)
      throw error
    }
  }

  /**
   * 获取数据
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      return await this.db.getItem<T>(key)
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error)
      return null
    }
  }

  /**
   * 删除数据
   */
  async remove(key: string): Promise<void> {
    try {
      await this.db.removeItem(key)
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error)
      throw error
    }
  }

  /**
   * 批量删除数据
   */
  async removeBatch(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map(key => this.remove(key)))
    } catch (error) {
      console.error('Failed to remove batch:', error)
      throw error
    }
  }

  /**
   * 检查数据是否存在
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.db.getItem(key)
      return value !== null
    } catch (error) {
      console.error(`Failed to check item ${key}:`, error)
      return false
    }
  }

  /**
   * 获取所有键
   */
  async keys(): Promise<string[]> {
    try {
      return await this.db.keys()
    } catch (error) {
      console.error('Failed to get keys:', error)
      return []
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    try {
      await this.db.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
      throw error
    }
  }

  /**
   * 生成唯一键
   */
  static generateKey(prefix: string, uuid: string, suffix?: string): string {
    return suffix ? `${prefix}_${uuid}_${suffix}` : `${prefix}_${uuid}`
  }

  /**
   * 生成轮廓键
   */
  static generateContourKey(uuid: string): string {
    return this.generateKey('contour', uuid)
  }

  /**
   * 生成预览键
   */
  static generatePreviewKey(uuid: string): string {
    return this.generateKey('preview', uuid)
  }
}

// 导出单例
export const indexedDBManager = IndexedDBManager.getInstance()
