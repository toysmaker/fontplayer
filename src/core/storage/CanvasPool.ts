/**
 * Canvas 对象池
 * 用于复用 Canvas 实例，减少内存占用
 */

export class CanvasPool {
  private static instance: CanvasPool
  private pool: HTMLCanvasElement[] = []
  private maxSize: number = 50
  private inUse: Set<HTMLCanvasElement> = new Set()
  private defaultWidth: number = 100
  private defaultHeight: number = 100

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): CanvasPool {
    if (!CanvasPool.instance) {
      CanvasPool.instance = new CanvasPool()
    }
    return CanvasPool.instance
  }

  /**
   * 获取 Canvas 实例
   */
  acquire(width: number = this.defaultWidth, height: number = this.defaultHeight): HTMLCanvasElement {
    let canvas = this.pool.pop()
    
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
    } else {
      // 如果尺寸不匹配，调整尺寸
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    }
    
    this.inUse.add(canvas)
    return canvas
  }

  /**
   * 释放 Canvas 实例
   */
  release(canvas: HTMLCanvasElement): void {
    if (!this.inUse.has(canvas)) {
      return
    }

    this.inUse.delete(canvas)
    
    // 清理 canvas 内容
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    // 如果池未满，放回池中
    if (this.pool.length < this.maxSize) {
      this.pool.push(canvas)
    }
  }

  /**
   * 清理不可见的 Canvas
   */
  cleanup(visibleUUIDs: Set<string>, characterCanvasMap: Map<string, HTMLCanvasElement>): void {
    const toRemove: string[] = []
    
    for (const [uuid, canvas] of characterCanvasMap.entries()) {
      if (!visibleUUIDs.has(uuid)) {
        this.release(canvas)
        toRemove.push(uuid)
      }
    }
    
    toRemove.forEach(uuid => characterCanvasMap.delete(uuid))
  }

  /**
   * 清空对象池
   */
  clear(): void {
    this.pool.forEach(canvas => {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    })
    this.pool = []
    this.inUse.clear()
  }

  /**
   * 获取池状态
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      inUseSize: this.inUse.size,
      maxSize: this.maxSize,
    }
  }
}

// 导出单例
export const canvasPool = CanvasPool.getInstance()
