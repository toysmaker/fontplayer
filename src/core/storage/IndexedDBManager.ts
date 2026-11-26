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
   * 批量写入：优先走 localForage 底层 IndexedDB 连接的单事务批量写
   * （大字符集导入时数千次单独 setItem 会产生数千个串行事务，极慢且内存尖峰）。
   * 存储格式与 localForage 的 setItem 完全一致（store.put(value, key)），
   * 因此读写互操作安全。非 IndexedDB 驱动（WebSQL 等）回退为受限并发写入。
   */
  async bulkSet(entries: Array<[string, any]>): Promise<void> {
    if (!entries.length) return
    try {
      const lf = this.db as any
      await lf.ready()
      const dbInfo = lf._dbInfo
      const idb: IDBDatabase | undefined = dbInfo && dbInfo.db
      if (idb && typeof idb.transaction === 'function' && idb.objectStoreNames?.contains(dbInfo.storeName)) {
        await new Promise<void>((resolve, reject) => {
          const tx = idb.transaction(dbInfo.storeName, 'readwrite')
          const store = tx.objectStore(dbInfo.storeName)
          for (const [key, value] of entries) {
            store.put(value, key)
          }
          tx.oncomplete = () => resolve()
          tx.onabort = () => reject(tx.error || new Error('bulkSet transaction aborted'))
          tx.onerror = () => reject(tx.error || new Error('bulkSet transaction error'))
        })
        return
      }
    } catch (error) {
      // 单事务路径失败时退化为分块 setItem，保证导入不中断
      console.warn('bulkSet via raw IndexedDB failed, falling back to chunked setItem:', error)
    }
    // 回退：受限并发（避免同时打开数千个事务）
    const CONCURRENCY = 32
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const slice = entries.slice(i, i + CONCURRENCY)
      await Promise.all(slice.map(([key, value]) => this.set(key, value)))
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
