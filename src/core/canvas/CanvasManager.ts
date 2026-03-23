/**
 * Canvas管理器
 * 管理Canvas实例的创建、复用和销毁
 */

import { indexedDBManager, IndexedDBManager } from '../storage/IndexedDBManager'

/**
 * 缓存的 ImageData 包装
 */
interface CachedImageData {
  imageData: ImageData
  lastUsed: number // 最后使用时间戳
}

/**
 * Canvas管理器类
 */
export class CanvasManager {
  // UUID 到 Canvas 的映射
  private static canvasMap = new Map<string, HTMLCanvasElement>()
  
  // Canvas 访问时间（用于 LRU 清理）
  private static canvasAccessTime = new Map<string, number>()
  
  // 渲染结果缓存（ImageData）- LRU 内存缓存
  private static renderCache = new Map<string, CachedImageData>()
  
  // 内容版本号（用于判断是否需要重新渲染）
  private static contentVersions = new Map<string, number>()
  
  // LRU 缓存配置
  private static readonly MAX_MEMORY_CACHE_SIZE = 20 // 内存中最多保留20个（减少内存占用）
  private static readonly MAX_CANVAS_MAP_SIZE = 50 // Canvas 映射最多保留50个（防止内存泄漏）
  private static readonly CACHE_PREFIX = 'canvas_preview_'

  /**
   * 获取或创建Canvas元素
   * @param uuid 唯一标识符
   * @param width Canvas宽度
   * @param height Canvas高度
   * @param createIfNotExists 如果DOM中不存在，是否创建新的（默认false，只查找不创建）
   */
  static getOrCreateCanvas(
    uuid: string,
    width: number = 100,
    height: number = 100,
    createIfNotExists: boolean = false
  ): HTMLCanvasElement | null {
    // 先从映射中获取
    const cached = this.canvasMap.get(uuid)
    if (cached) {
      return cached
    }

    // 从DOM中查找（支持ID和data-uuid属性）
    const existing = this.getCanvasFromDOM(uuid)
    if (existing) {
      return existing
    }

    // 如果需要创建新的Canvas（通常用于离屏渲染）
    if (createIfNotExists) {
      const canvas = document.createElement('canvas')
      canvas.id = `preview-canvas-${uuid}`
      canvas.setAttribute('data-uuid', uuid)
      canvas.width = width
      canvas.height = height
      this.canvasMap.set(uuid, canvas)
      this.canvasAccessTime.set(uuid, Date.now())
      
      // 延迟清理：如果 canvasMap 过大，延迟清理（避免清理刚创建的 Canvas）
      if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
        setTimeout(() => {
          if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
            this.evictCanvasLRU(true) // 只清理不在 DOM 中的
          }
        }, 100)
      }
      
      return canvas
    }

    return null
  }
  
  /**
   * 注册Canvas到管理器（当Canvas已存在于DOM中时调用）
   * 
   * 注意：如果 Canvas 之前被标记为渲染过其他 UUID，需要清除标记
   * 因为 Vue 的虚拟 DOM 可能会复用 Canvas 元素
   */
  static registerCanvas(uuid: string, canvas: HTMLCanvasElement): void {
    // 检查 Canvas 是否之前被标记为渲染过其他 UUID
    const previousUUID = this.canvasUUIDMap.get(canvas)
    if (previousUUID && previousUUID !== uuid) {
      // Canvas 被复用了，清除之前的标记
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] registerCanvas: Canvas reused, clear previous mark. previous=${previousUUID}, current=${uuid}`)
      }
      this.canvasUUIDMap.delete(canvas)
      // 同时清空 Canvas 内容，避免显示错误的内容
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    } else if (previousUUID === uuid) {
      // Canvas 已经注册过这个 UUID，不需要重复注册
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] registerCanvas: Canvas already registered for ${uuid}`)
      }
    } else {
      // 新 Canvas，正常注册
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] registerCanvas: New canvas registered for ${uuid}`)
      }
    }
    
    // 更新访问时间
    this.canvasAccessTime.set(uuid, Date.now())
    
    // 先添加到映射中
    this.canvasMap.set(uuid, canvas)
    
    // 延迟清理：如果 canvasMap 过大，延迟清理（避免清理刚注册的 Canvas）
    if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
      // 使用 setTimeout 延迟清理，确保当前注册的 Canvas 不会被立即清理
      setTimeout(() => {
        if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
          this.evictCanvasLRU()
        }
      }, 100)
    }
  }
  
  /**
   * 清理不可见的Canvas缓存
   */
  static cleanupInvisible(visibleUUIDs: Set<string>): void {
    const toRemove: string[] = []
    for (const uuid of this.canvasMap.keys()) {
      if (!visibleUUIDs.has(uuid)) {
        // 额外检查：如果 Canvas 还在 DOM 中，说明它可能是可见的，只是 visibleItems 还没更新
        // 这种情况下不清理，避免清空可见的 Canvas
        const canvas = this.canvasMap.get(uuid)
        if (canvas && canvas.isConnected) {
          // Canvas 还在 DOM 中，可能是可见的，跳过清理
          continue
        }
        toRemove.push(uuid)
      }
    }
    
    if (toRemove.length > 0 && import.meta.env.DEV) {
      console.log(`[CanvasManager] Cleaning up ${toRemove.length} invisible canvases`)
    }
    
    toRemove.forEach(uuid => {
      const canvas = this.canvasMap.get(uuid)
      if (canvas) {
        // 再次确认 Canvas 不在 DOM 中
        if (!canvas.isConnected) {
          // 清空 Canvas 内容，释放像素数据内存
          // 这是关键：Canvas 的像素数据（width * height * 4 bytes）会占用大量内存
          // 清空内容可以让浏览器释放这些内存
          this.clearCanvasContent(canvas)
        }
        // 清除 Canvas 的渲染标记
        this.clearCanvasMark(canvas)
      }
      this.canvasMap.delete(uuid)
      this.canvasAccessTime.delete(uuid)
    })
    
    // 如果 canvasMap 仍然过大，使用 LRU 策略清理（但只清理不在 DOM 中的）
    if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
      const beforeSize = this.canvasMap.size
      // 只清理不在 DOM 中的 Canvas
      this.evictCanvasLRU(true)
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] Canvas map too large, evicted. Before: ${beforeSize}, After: ${this.canvasMap.size}`)
      }
    }
    
    // 同时清理渲染缓存
    this.cleanupRenderCache(visibleUUIDs)
  }
  
  /**
   * 清空 Canvas 内容，释放像素数据内存
   */
  private static clearCanvasContent(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // 清空画布内容
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // 重置 Canvas 尺寸可以强制释放像素数据（但会影响后续使用）
      // 所以只清空内容，不重置尺寸
    }
  }
  
  /**
   * 移除最久未使用的 Canvas（LRU 策略）
   * @param onlyDisconnected 如果为 true，只清理不在 DOM 中的 Canvas
   */
  private static evictCanvasLRU(onlyDisconnected: boolean = false): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, time] of this.canvasAccessTime.entries()) {
      if (onlyDisconnected) {
        // 只考虑不在 DOM 中的 Canvas
        const canvas = this.canvasMap.get(key)
        if (canvas && canvas.isConnected) {
          continue // 跳过在 DOM 中的 Canvas
        }
      }
      
      if (time < oldestTime) {
        oldestTime = time
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      const canvas = this.canvasMap.get(oldestKey)
      if (canvas) {
        // 只清空不在 DOM 中的 Canvas 内容
        if (!canvas.isConnected) {
          this.clearCanvasContent(canvas)
        }
        // 清除标记
        this.clearCanvasMark(canvas)
        // 如果是离屏 Canvas（不在 DOM 中），可以考虑移除
        // 但为了安全，我们只清空内容，不删除元素
      }
      this.canvasMap.delete(oldestKey)
      this.canvasAccessTime.delete(oldestKey)
    }
  }

  /**
   * 从DOM中获取Canvas元素（支持data-uuid属性）
   */
  static getCanvasFromDOM(uuid: string): HTMLCanvasElement | null {
    // 先尝试通过ID查找
    const byId = document.getElementById(
      `preview-canvas-${uuid}`
    ) as HTMLCanvasElement | null
    if (byId) return byId
    
    // 再尝试通过data-uuid属性查找
    const byDataAttr = document.querySelector(
      `canvas[data-uuid="${uuid}"]`
    ) as HTMLCanvasElement | null
    if (byDataAttr) {
      // 缓存到映射中
      this.canvasMap.set(uuid, byDataAttr)
      this.canvasAccessTime.set(uuid, Date.now())
      
      // 延迟清理：如果 canvasMap 过大，延迟清理
      if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
        setTimeout(() => {
          if (this.canvasMap.size > this.MAX_CANVAS_MAP_SIZE) {
            this.evictCanvasLRU(true) // 只清理不在 DOM 中的
          }
        }, 100)
      }
      
      return byDataAttr
    }
    
    return null
  }

  /**
   * 释放Canvas（从映射中移除，但不删除DOM元素）
   */
  static releaseCanvas(uuid: string): void {
    this.canvasMap.delete(uuid)
  }

  /**
   * 清理所有Canvas（包括缓存）
   */
  static async clearAll(): Promise<void> {
    this.canvasMap.clear()
    await this.clearAllCaches()
  }
  
  /**
   * 将 ImageData 转换为 ArrayBuffer（用于存储到 IndexedDB）
   */
  private static imageDataToArrayBuffer(imageData: ImageData): ArrayBuffer {
    const { width, height, data } = imageData
    // 存储格式：4字节width + 4字节height + data
    const buffer = new ArrayBuffer(8 + data.length)
    const view = new DataView(buffer)
    view.setUint32(0, width, true)
    view.setUint32(4, height, true)
    new Uint8ClampedArray(buffer, 8).set(data)
    return buffer
  }
  
  /**
   * 从 ArrayBuffer 恢复 ImageData
   */
  private static arrayBufferToImageData(buffer: ArrayBuffer): ImageData | null {
    try {
      const view = new DataView(buffer)
      const width = view.getUint32(0, true)
      const height = view.getUint32(4, true)
      const data = new Uint8ClampedArray(buffer, 8)
      const imageData = new ImageData(data, width, height)
      
      // 注意：ArrayBuffer 会被 ImageData 引用，但 view 和 data 是临时对象
      // 它们会在函数返回后被 GC，但 ArrayBuffer 会一直存在直到 ImageData 被释放
      // 这是正常的，因为 ImageData 需要这些数据
      
      return imageData
    } catch (error) {
      console.error('Failed to restore ImageData from ArrayBuffer:', error)
      return null
    }
  }
  
  /**
   * 获取渲染缓存（优先从内存，其次从 IndexedDB）
   */
  static async getRenderCache(uuid: string): Promise<ImageData | null> {
    // 先从内存缓存获取
    const cached = this.renderCache.get(uuid)
    if (cached) {
      // 更新最后使用时间
      cached.lastUsed = Date.now()
      return cached.imageData
    }
    
    // 从 IndexedDB 加载
    try {
      const key = `${this.CACHE_PREFIX}${uuid}`
      const buffer = await indexedDBManager.get<ArrayBuffer>(key)
      if (buffer) {
        const imageData = this.arrayBufferToImageData(buffer)
        if (imageData) {
          // 加载到内存缓存（如果还有空间）
          this.addToMemoryCache(uuid, imageData)
          return imageData
        }
      }
    } catch (error) {
      console.error(`Failed to load cache from IndexedDB for ${uuid}:`, error)
    }
    
    return null
  }
  
  /**
   * 设置渲染缓存（同时存储到内存和 IndexedDB）
   */
  static async setRenderCache(uuid: string, imageData: ImageData): Promise<void> {
    // 添加到内存缓存
    this.addToMemoryCache(uuid, imageData)
    
    // 异步存储到 IndexedDB（不阻塞主线程）
    this.saveToIndexedDB(uuid, imageData).catch(error => {
      console.error(`Failed to save cache to IndexedDB for ${uuid}:`, error)
    })
  }
  
  /**
   * 添加到内存缓存（LRU 策略）
   */
  private static addToMemoryCache(uuid: string, imageData: ImageData): void {
    // 如果超过最大缓存数，移除最久未使用的
    if (this.renderCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      this.evictLRU()
    }
    
    this.renderCache.set(uuid, {
      imageData,
      lastUsed: Date.now()
    })
  }
  
  /**
   * 移除最久未使用的缓存（LRU 策略）
   */
  private static evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, cached] of this.renderCache.entries()) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.renderCache.delete(oldestKey)
    }
  }
  
  /**
   * 保存到 IndexedDB
   */
  private static async saveToIndexedDB(uuid: string, imageData: ImageData): Promise<void> {
    const buffer = this.imageDataToArrayBuffer(imageData)
    const key = `${this.CACHE_PREFIX}${uuid}`
    await indexedDBManager.set(key, buffer)
  }
  
  /**
   * 清除渲染缓存（内存和 IndexedDB）
   */
  static async clearRenderCache(uuid: string): Promise<void> {
    // 从内存缓存移除
    this.renderCache.delete(uuid)
    
    // 从 IndexedDB 移除
    try {
      const key = `${this.CACHE_PREFIX}${uuid}`
      await indexedDBManager.remove(key)
    } catch (error) {
      console.error(`Failed to remove cache from IndexedDB for ${uuid}:`, error)
    }
  }
  
  /**
   * 检查内容版本，判断是否需要重新渲染
   */
  static needsRerender(uuid: string, contentVersion: number): boolean {
    const cachedVersion = this.contentVersions.get(uuid)
    if (cachedVersion === undefined || cachedVersion !== contentVersion) {
      this.contentVersions.set(uuid, contentVersion)
      return true
    }
    return false
  }
  
  /**
   * 清理不可见的渲染缓存（只清理内存缓存，保留 IndexedDB）
   */
  static cleanupRenderCache(visibleUUIDs: Set<string>): void {
    const toRemove: string[] = []
    for (const uuid of this.renderCache.keys()) {
      if (!visibleUUIDs.has(uuid)) {
        toRemove.push(uuid)
      }
    }
    toRemove.forEach(uuid => {
      // 清理 ImageData（释放内存）
      const cached = this.renderCache.get(uuid)
      if (cached && cached.imageData) {
        // ImageData 会被垃圾回收，但显式删除可以加速回收
        cached.imageData = null as any
      }
      this.renderCache.delete(uuid)
      this.contentVersions.delete(uuid)
      // 注意：不删除 IndexedDB 中的缓存，以便后续快速加载
    })
    
    // 如果缓存仍然超过限制，使用 LRU 策略清理
    if (this.renderCache.size > this.MAX_MEMORY_CACHE_SIZE) {
      const excess = this.renderCache.size - this.MAX_MEMORY_CACHE_SIZE
      for (let i = 0; i < excess; i++) {
        this.evictLRU()
      }
    }
  }
  
  /**
   * 获取当前缓存大小
   */
  static getCacheSize(): number {
    return this.renderCache.size
  }
  
  /**
   * 强制清理所有缓存（用于内存压力大时）
   */
  static forceCleanupAllCache(): void {
    // 清理所有 ImageData
    for (const cached of this.renderCache.values()) {
      if (cached && cached.imageData) {
        cached.imageData = null as any
      }
    }
    this.renderCache.clear()
    this.contentVersions.clear()
    
    // 清空所有 Canvas 内容（释放像素数据）
    for (const canvas of this.canvasMap.values()) {
      this.clearCanvasContent(canvas)
    }
    
    // 清理 Canvas 映射（但保留 DOM 中的 Canvas 元素）
    // 注意：不清空 canvasMap，因为 Canvas 元素还在 DOM 中，下次访问时会重新注册
    // 但清空访问时间，让它们可以被 LRU 清理
    this.canvasAccessTime.clear()
  }
  
  /**
   * 获取 Canvas 映射大小
   */
  static getCanvasMapSize(): number {
    return this.canvasMap.size
  }
  
  /**
   * 从缓存恢复Canvas内容（同步版本，只检查内存缓存）
   * 
   * 注意：从内存缓存恢复时，可以标记 Canvas 已渲染
   * 因为内存缓存意味着之前已经渲染过
   */
  static restoreFromCache(canvas: HTMLCanvasElement, uuid: string): boolean {
    const cached = this.renderCache.get(uuid)
    if (!cached) return false
    
    // 检查 Canvas 是否已经被标记为渲染过这个 UUID
    const previousUUID = this.canvasUUIDMap.get(canvas)
    
    // 如果 Canvas 之前渲染过其他 UUID，说明 Canvas 被复用了
    // 这种情况下，不应该从缓存恢复，应该重新渲染
    if (previousUUID && previousUUID !== uuid) {
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] restoreFromCache: Canvas reused, skip restore. previous=${previousUUID}, current=${uuid}`)
      }
      return false
    }
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    
    // 更新最后使用时间
    cached.lastUsed = Date.now()
    ctx.putImageData(cached.imageData, 0, 0)
    
    // 标记 Canvas 已渲染（用于检测 Canvas 复用）
    // 内存缓存意味着之前已经渲染过，所以可以标记
    this.markCanvasRendered(canvas, uuid)
    
    return true
  }
  
  /**
   * 从缓存恢复Canvas内容（异步版本，会从 IndexedDB 加载）
   * 
   * 重要：从 IndexedDB 恢复缓存时，不应该标记 Canvas 已渲染
   * 因为这是第一次加载，Canvas 还没有真正渲染过
   * 只有在实际渲染后（CharacterRenderer.renderPreview），才应该标记
   * 
   * 这样做的原因是：
   * 1. IndexedDB 中的缓存可能是之前会话保存的，不是当前会话渲染的
   * 2. 如果标记了，会导致 canSkipRender 返回 true，但实际上 Canvas 还没有渲染过
   * 3. 应该让 VirtualCharacterList 的渲染队列统一处理，确保渲染逻辑正确
   */
  static async restoreFromCacheAsync(canvas: HTMLCanvasElement, uuid: string): Promise<boolean> {
    const imageData = await this.getRenderCache(uuid)
    if (!imageData) return false
    
    // 检查 Canvas 是否已经被标记为渲染过这个 UUID
    const previousUUID = this.canvasUUIDMap.get(canvas)
    
    // 如果 Canvas 之前渲染过其他 UUID，说明 Canvas 被复用了
    // 这种情况下，不应该从缓存恢复，应该重新渲染
    if (previousUUID && previousUUID !== uuid) {
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] restoreFromCacheAsync: Canvas reused, skip restore. previous=${previousUUID}, current=${uuid}`)
      }
      return false
    }
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    
    ctx.putImageData(imageData, 0, 0)
    
    // 重要：从 IndexedDB 恢复缓存时，不标记 Canvas 已渲染
    // 因为这是第一次加载，Canvas 还没有真正渲染过
    // 只有在实际渲染后（CharacterRenderer.renderPreview），才应该标记
    // 这样 canSkipRender 才能正确判断是否需要渲染
    
    if (import.meta.env.DEV) {
      console.log(`[CanvasManager] restoreFromCacheAsync: Restored from IndexedDB for ${uuid}, but NOT marked as rendered`, {
        previousUUID: previousUUID || 'none',
        uuid,
        reason: 'IndexedDB cache is from previous session, not current render'
      })
    }
    
    return true
  }
  
  // 记录每个 Canvas 元素当前渲染的 UUID（用于检测 Canvas 复用）
  private static canvasUUIDMap = new Map<HTMLCanvasElement, string>()
  
  /**
   * 检查Canvas是否已经有内容（非空白）
   * 使用轻量级检查，避免频繁读取像素数据
   * 
   * 注意：这个方法只检查 Canvas 上是否有像素数据，不检查是否渲染过特定 UUID
   * 应该结合 canvasUUIDMap 来判断 Canvas 是否渲染过特定字符
   */
  static hasContent(canvas: HTMLCanvasElement | null | undefined): boolean {
    // 如果 canvas 为 null 或 undefined，返回 false
    if (!canvas) {
      return false
    }
    
    // 如果Canvas尺寸为0，肯定没有内容
    if (canvas.width === 0 || canvas.height === 0) {
      return false
    }
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    
    // 多点采样：仅采中心时，细笔画/未铺底前透明像素会误判为「无内容」，
    // 与父级白底叠看后像「有预览却有红叉」。
    try {
      const w = canvas.width
      const h = canvas.height
      const xs = new Set([
        Math.floor(w / 2),
        0,
        w - 1,
        Math.floor(w / 4),
        Math.floor((3 * w) / 4),
      ])
      const ys = new Set([
        Math.floor(h / 2),
        0,
        h - 1,
        Math.floor(h / 4),
        Math.floor((3 * h) / 4),
      ])
      for (const x of xs) {
        for (const y of ys) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          const d = ctx.getImageData(x, y, 1, 1).data
          if (d[3] > 0) return true
        }
      }
      return false
    } catch {
      // 如果读取失败（可能Canvas被清空或未初始化），返回false
      return false
    }
  }
  
  /**
   * 检查是否有缓存且Canvas已有内容（避免重复渲染）
   * 重要：需要检查 Canvas 是否被复用了（虚拟滚动时可能发生）
   * 
   * 逻辑：
   * 1. 如果 Canvas 之前渲染过其他 UUID，需要重新渲染
   * 2. 如果 Canvas 之前没有渲染过这个 UUID，不能跳过（即使是第一次加载）
   * 3. 只有 Canvas 之前渲染过这个 UUID，且缓存存在，且Canvas有内容时，才能跳过
   * 
   * 注意：内存缓存存在不代表 Canvas 已经渲染过，可能是从 IndexedDB 加载的
   * 所以必须检查 canvasUUIDMap 来确认 Canvas 是否真的渲染过
   */
  static canSkipRender(canvas: HTMLCanvasElement, uuid: string): boolean {
    // 检查 Canvas 是否被复用了（之前渲染的是其他字符）
    const previousUUID = this.canvasUUIDMap.get(canvas)
    
    if (previousUUID && previousUUID !== uuid) {
      // Canvas 被复用了，需要重新渲染
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] canSkipRender: Canvas reused, need render. previous=${previousUUID}, current=${uuid}`)
      }
      return false
    }
    
    // 关键：如果 Canvas 之前没有渲染过这个 UUID，不能跳过
    // 即使内存缓存存在（可能是从 IndexedDB 加载的），也要确保 Canvas 确实渲染过这个 UUID
    if (!previousUUID || previousUUID !== uuid) {
      if (import.meta.env.DEV) {
        console.log(`[CanvasManager] canSkipRender for ${uuid}: Canvas not rendered for this UUID yet`, {
          previousUUID: previousUUID || 'none',
          currentUUID: uuid,
          hasCache: this.renderCache.has(uuid),
          hasContent: this.hasContent(canvas),
          result: false
        })
      }
      return false
    }
    
    // Canvas 之前渲染过这个 UUID，检查缓存和内容
    const hasCache = this.renderCache.has(uuid)
    const hasContent = this.hasContent(canvas)
    
    const canSkip = hasCache && hasContent
    
    if (import.meta.env.DEV) {
      console.log(`[CanvasManager] canSkipRender for ${uuid}:`, {
        hasCache,
        hasContent,
        previousUUID,
        canSkip
      })
    }
    
    // 只有缓存存在且Canvas有内容，且Canvas确实渲染过这个UUID时，才能跳过
    return canSkip
  }
  
  /**
   * 标记 Canvas 已渲染某个 UUID（用于检测复用）
   */
  static markCanvasRendered(canvas: HTMLCanvasElement, uuid: string): void {
    this.canvasUUIDMap.set(canvas, uuid)
  }
  
  /**
   * 清除 Canvas 的渲染标记（当 Canvas 被清理时）
   */
  static clearCanvasMark(canvas: HTMLCanvasElement): void {
    this.canvasUUIDMap.delete(canvas)
  }

  /**
   * 使指定 UUID 的缓存失效，强制下次渲染时重新绘制
   * 用于单个字符/字形被修改后刷新其预览
   */
  static invalidateCache(uuid: string): void {
    this.renderCache.delete(uuid)
  }
  
  /**
   * 检查是否有缓存（包括 IndexedDB）
   */
  static async hasCache(uuid: string): Promise<boolean> {
    // 检查内存缓存
    if (this.renderCache.has(uuid)) {
      return true
    }
    
    // 检查 IndexedDB
    try {
      const key = `${this.CACHE_PREFIX}${uuid}`
      return await indexedDBManager.has(key)
    } catch {
      return false
    }
  }
  
  /**
   * 清理所有缓存（内存和 IndexedDB）
   */
  static async clearAllCaches(): Promise<void> {
    // 清理内存缓存
    this.renderCache.clear()
    this.contentVersions.clear()
    
    // 清理 IndexedDB 中的预览缓存
    try {
      const keys = await indexedDBManager.keys()
      const previewKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX))
      await indexedDBManager.removeBatch(previewKeys)
    } catch (error) {
      console.error('Failed to clear IndexedDB caches:', error)
    }
  }
}
