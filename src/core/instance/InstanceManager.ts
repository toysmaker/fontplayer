/**
 * 实例化管理器
 * 实现延迟实例化策略，减少内存占用
 * 
 * 策略：
 * 1. 只在编辑时才创建实例
 * 2. 使用 LRU 缓存管理实例池
 * 3. 自动清理不使用的实例
 */

import type { ICharacterFileLite, ICustomGlyph } from '../types'

/**
 * 实例类型
 */
export type InstanceType = 'character' | 'glyph'

/**
 * 实例接口
 */
export interface IInstance {
  uuid: string
  type: InstanceType
  lastUsed: number
  cleanup?: () => void
}

/**
 * 实例管理器
 */
export class InstanceManager {
  private instancePool: Map<string, IInstance> = new Map()
  private maxPoolSize: number = 10
  private editingUUIDs: Set<string> = new Set()
  private temporaryInstances: Set<string> = new Set() // 临时实例集合（用于脚本执行等）

  /**
   * 设置最大实例池大小
   */
  setMaxPoolSize(size: number) {
    this.maxPoolSize = size
    this.cleanupPool()
  }

  /**
   * 标记某个 UUID 正在编辑
   */
  markEditing(uuid: string) {
    this.editingUUIDs.add(uuid)
  }

  /**
   * 取消编辑标记
   */
  unmarkEditing(uuid: string) {
    this.editingUUIDs.delete(uuid)
    // 如果不在编辑状态，可以选择释放实例（但保留在池中以便快速恢复）
    // 这里暂时不释放，由 LRU 策略管理
  }

  /**
   * 检查是否正在编辑
   */
  isEditing(uuid: string): boolean {
    return this.editingUUIDs.has(uuid)
  }

  /**
   * 获取实例（延迟实例化）
   * 用于编辑状态或临时使用
   */
  getInstance<T extends IInstance>(
    uuid: string,
    factory: () => T,
    type: InstanceType
  ): T | null {
    // 如果正在编辑或临时使用，创建或获取实例
    if (this.isEditing(uuid) || this.isTemporary(uuid)) {
      if (!this.instancePool.has(uuid)) {
        const instance = factory()
        instance.uuid = uuid
        instance.type = type
        instance.lastUsed = Date.now()
        this.instancePool.set(uuid, instance)
        this.cleanupPool()
      } else {
        // 更新最后使用时间
        const instance = this.instancePool.get(uuid)!
        instance.lastUsed = Date.now()
      }
      return this.instancePool.get(uuid) as T
    }
    
    // 不在编辑状态且不是临时使用，不创建实例
    return null
  }

  /**
   * 获取临时实例（用于脚本执行等非编辑场景）
   * 使用完后必须调用 releaseTemporaryInstance 释放
   */
  acquireTemporaryInstance<T extends IInstance>(
    uuid: string,
    factory: () => T,
    type: InstanceType
  ): T {
    // 标记为临时实例
    this.temporaryInstances.add(uuid)
    
    // 如果实例已存在，直接返回
    if (this.instancePool.has(uuid)) {
      const instance = this.instancePool.get(uuid)!
      instance.lastUsed = Date.now()
      return instance as T
    }
    
    // 创建新实例
    const instance = factory()
    instance.uuid = uuid
    instance.type = type
    instance.lastUsed = Date.now()
    this.instancePool.set(uuid, instance)
    
    // 触发清理（虽然临时实例不会被清理，但可以清理其他非临时实例）
    this.cleanupPool()
    
    return instance
  }

  /**
   * 释放临时实例
   */
  releaseTemporaryInstance(uuid: string) {
    // 如果是临时实例，立即释放
    if (this.temporaryInstances.has(uuid)) {
      this.temporaryInstances.delete(uuid)
      // 如果不在编辑状态，释放实例
      if (!this.isEditing(uuid)) {
        this.releaseInstance(uuid)
      }
    }
  }

  /**
   * 检查是否为临时实例
   */
  isTemporary(uuid: string): boolean {
    return this.temporaryInstances.has(uuid)
  }

  /**
   * 释放实例
   */
  releaseInstance(uuid: string) {
    const instance = this.instancePool.get(uuid)
    if (instance) {
      // 执行清理
      if (instance.cleanup) {
        instance.cleanup()
      }
      this.instancePool.delete(uuid)
      this.editingUUIDs.delete(uuid)
    }
  }

  /**
   * 清理实例池（LRU 策略）
   */
  private cleanupPool() {
    if (this.instancePool.size <= this.maxPoolSize) {
      return
    }

    // 找到最久未使用的实例（排除正在编辑和临时使用的）
    const candidates: Array<{ uuid: string; lastUsed: number }> = []
    
    for (const [uuid, instance] of this.instancePool.entries()) {
      // 跳过正在编辑或临时使用的实例
      if (this.isEditing(uuid) || this.isTemporary(uuid)) {
        continue
      }
      candidates.push({
        uuid,
        lastUsed: instance.lastUsed,
      })
    }

    // 按最后使用时间排序
    candidates.sort((a, b) => a.lastUsed - b.lastUsed)

    // 移除最久未使用的实例，直到池大小符合要求
    const toRemove = this.instancePool.size - this.maxPoolSize
    for (let i = 0; i < toRemove && i < candidates.length; i++) {
      this.releaseInstance(candidates[i].uuid)
    }
  }

  /**
   * 获取所有实例
   */
  getAllInstances(): IInstance[] {
    return Array.from(this.instancePool.values())
  }

  /**
   * 获取实例数量
   */
  getInstanceCount(): number {
    return this.instancePool.size
  }

  /**
   * 清空所有实例
   */
  clear() {
    for (const uuid of this.instancePool.keys()) {
      this.releaseInstance(uuid)
    }
    this.editingUUIDs.clear()
    this.temporaryInstances.clear()
  }

  /**
   * 查找最久未使用的实例（用于调试）
   */
  findLRU(): string | null {
    let lru: { uuid: string; lastUsed: number } | null = null

    for (const [uuid, instance] of this.instancePool.entries()) {
      // 跳过正在编辑的实例
      if (this.isEditing(uuid)) {
        continue
      }
      
      if (!lru || instance.lastUsed < lru.lastUsed) {
        lru = { uuid, lastUsed: instance.lastUsed }
      }
    }

    return lru?.uuid || null
  }

  /**
   * 获取或创建字形实例（如果不存在则创建临时实例）
   * 用于渲染等场景，不需要编辑状态
   */
  getOrCreateGlyphInstance(
    glyph: ICustomGlyph,
    factory: () => IInstance
  ): IInstance {
    const uuid = glyph.uuid
    
    // 如果实例已存在，直接返回
    if (this.instancePool.has(uuid)) {
      const instance = this.instancePool.get(uuid)!
      instance.lastUsed = Date.now()
      return instance
    }
    
    // 如果不在编辑状态且不是临时实例，创建临时实例
    if (!this.isEditing(uuid) && !this.isTemporary(uuid)) {
      return this.acquireTemporaryInstance(uuid, factory, 'glyph')
    }
    
    // 否则使用 getInstance
    return this.getInstance(uuid, factory, 'glyph') || factory()
  }
}

// 导出单例
export const instanceManager = new InstanceManager()
