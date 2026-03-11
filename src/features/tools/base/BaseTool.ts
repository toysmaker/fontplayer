/**
 * 工具基类
 * 所有工具都继承此类，提供统一的生命周期和事件处理接口
 */

import type { IToolConfig, ToolRenderFunction } from './types'

/**
 * 抽象工具基类
 * 使用单例模式，子类需要实现getInstance方法
 */
export abstract class BaseTool {
  protected canvas: HTMLCanvasElement
  protected config: IToolConfig
  protected isActive: boolean = false
  protected renderFunction: ToolRenderFunction | null = null

  constructor(canvas: HTMLCanvasElement, config: IToolConfig) {
    this.canvas = canvas
    this.config = config
  }

  /**
   * 工具名称
   */
  abstract get name(): string

  /**
   * 初始化工具
   * 在工具首次创建时调用
   */
  abstract init(): Promise<void> | void

  /**
   * 激活工具
   * 绑定事件监听器等
   */
  abstract activate(): void

  /**
   * 停用工具
   * 解绑事件监听器等
   */
  abstract deactivate(): void

  /**
   * 清理工具
   * 释放所有资源
   */
  abstract cleanup(): void

  /**
   * 获取渲染函数
   * 返回null表示不需要额外渲染
   */
  getRenderFunction(): ToolRenderFunction | null {
    return this.renderFunction
  }

  /**
   * 设置渲染函数
   */
  protected setRenderFunction(fn: ToolRenderFunction | null): void {
    this.renderFunction = fn
  }

  /**
   * 获取坐标转换函数
   */
  protected getCoord(coord: number): number {
    if (this.config.getCoord) {
      return this.config.getCoord(coord)
    }
    return coord
  }

  /**
   * 触发重新渲染
   */
  protected triggerRender(): void {
    if (this.config.onRender) {
      this.config.onRender()
    }
  }

  /**
   * 检查工具是否激活
   */
  isToolActive(): boolean {
    return this.isActive
  }
}
