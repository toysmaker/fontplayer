/**
 * 实例化管理器
 * 实现延迟实例化策略，减少内存占用
 *
 * 策略：
 * 1. 只在编辑时才创建实例（或临时获取用于渲染/导出）
 * 2. 使用 LRU 缓存管理实例池，默认最大 10 个实例
 * 3. 编辑中的实例（markEditing）永不参与 LRU 清理；临时实例（acquireTemporary）在用完后应 release，否则可能被 LRU 清理
 *
 * 生命周期约定：
 * - 编辑界面：当前编辑字符/字形在进入编辑时 markEditing + getInstance，仅在对应 Editor 的 onUnmounted 中 unmarkEditing + releaseInstance，不在导出 SVG/图片时释放。
 * - 字符编辑：除字符页 uuid 外，对当前字符树下所有字形 placement 的 component.uuid 也会 markEditing，避免多笔画时临时实例超过 LRU 上限被误删（见 character store）。
 * - 画布渲染（EditorCanvasRenderer）：字形组件通过 acquireTemporaryInstance 获取实例，不主动 release，由池子与 LRU 管理。
 * - 导出（ImportExportSvgService）：仅 getInstance / getOrCreateGlyphInstance，不释放。
 * - 轮廓转换（ContourConverter）/ 字体预览（GlyphRenderer）：使用临时实例，用完后立即 releaseTemporaryInstance，避免递归时超过池容量导致 LRU 误删仍在用的实例。
 *
 * 复杂字符：若单字符包含大量字形组件，池容量可能不足，可调用 setMaxPoolSize 增大（或接受部分实例被 LRU 回收后按需重建）。
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
   * 检查实例是否存在于实例池中（不创建实例）
   * 用于需要"只读取已有实例、不创建空实例"的场景，避免污染实例池
   */
  hasInstance(uuid: string): boolean {
    return this.instancePool.has(uuid)
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

    // 找到最久未使用的实例
    // 优先清理：不在编辑状态且不是临时实例的实例
    // 如果还不够，清理不在编辑状态的临时实例（最久未使用的）
    const nonTemporaryCandidates: Array<{ uuid: string; lastUsed: number }> = []
    const temporaryCandidates: Array<{ uuid: string; lastUsed: number }> = []
    
    for (const [uuid, instance] of this.instancePool.entries()) {
      // 跳过正在编辑的实例（无论是否为临时实例）
      if (this.isEditing(uuid)) {
        continue
      }
      
      if (this.isTemporary(uuid)) {
        // 临时实例候选（不在编辑状态）
        temporaryCandidates.push({
          uuid,
          lastUsed: instance.lastUsed,
        })
      } else {
        // 非临时实例候选
        nonTemporaryCandidates.push({
          uuid,
          lastUsed: instance.lastUsed,
        })
      }
    }

    // 按最后使用时间排序
    nonTemporaryCandidates.sort((a, b) => a.lastUsed - b.lastUsed)
    temporaryCandidates.sort((a, b) => a.lastUsed - b.lastUsed)

    // 计算需要移除的数量
    const toRemove = this.instancePool.size - this.maxPoolSize
    
    // 优先移除非临时实例
    let removed = 0
    for (let i = 0; i < toRemove && i < nonTemporaryCandidates.length; i++) {
      this.releaseInstance(nonTemporaryCandidates[i].uuid)
      removed++
    }
    
    // 如果还不够，移除临时实例（最久未使用的）
    if (removed < toRemove) {
      for (let i = 0; i < (toRemove - removed) && i < temporaryCandidates.length; i++) {
        // 释放临时实例（会从 temporaryInstances 集合中移除）
        this.releaseTemporaryInstance(temporaryCandidates[i].uuid)
      }
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
