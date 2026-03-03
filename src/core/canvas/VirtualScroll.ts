/**
 * 虚拟滚动管理器
 * 管理虚拟列表的滚动和可见项渲染
 */

export interface IVirtualScrollOptions {
  itemHeight: number
  overscan?: number
  containerHeight: number
  totalItems: number
}

export interface IVisibleRange {
  start: number
  end: number
}

/**
 * 虚拟滚动管理器类
 */
export class VirtualScroll {
  private itemHeight: number
  private overscan: number
  private containerHeight: number
  private totalItems: number

  constructor(options: IVirtualScrollOptions) {
    this.itemHeight = options.itemHeight
    this.overscan = options.overscan || 5
    this.containerHeight = options.containerHeight
    this.totalItems = options.totalItems
  }

  /**
   * 计算可见范围
   */
  calculateVisibleRange(scrollTop: number): IVisibleRange {
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan)
    const end = Math.min(
      this.totalItems,
      Math.ceil((scrollTop + this.containerHeight) / this.itemHeight) + this.overscan
    )
    return { start, end }
  }

  /**
   * 计算总高度
   */
  calculateTotalHeight(): number {
    return this.totalItems * this.itemHeight
  }

  /**
   * 计算偏移量
   */
  calculateOffset(start: number): number {
    return start * this.itemHeight
  }

  /**
   * 更新容器高度
   */
  updateContainerHeight(height: number): void {
    this.containerHeight = height
  }

  /**
   * 更新总项目数
   */
  updateTotalItems(count: number): void {
    this.totalItems = count
  }
}
