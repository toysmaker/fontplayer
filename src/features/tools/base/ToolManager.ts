/**
 * 工具管理器
 * 单例模式，统一管理所有工具的激活/停用
 */

import type { BaseTool } from './BaseTool'
import type { ToolType, ToolRenderFunction } from './types'
import { useToolStore } from '@/stores/tool'

/**
 * 工具管理器单例
 */
export class ToolManager {
  private static instance: ToolManager | null = null
  private currentTool: BaseTool | null = null
  private tools: Map<ToolType, BaseTool> = new Map()
  private renderFunctions: Map<ToolType, ToolRenderFunction | null> = new Map()

  /**
   * 获取单例实例
   */
  static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager()
    }
    return ToolManager.instance
  }

  /**
   * 注册工具
   */
  registerTool(toolType: ToolType, tool: BaseTool): void {
    this.tools.set(toolType, tool)
    this.renderFunctions.set(toolType, tool.getRenderFunction())
  }

  /**
   * 切换工具
   */
  async switchTool(toolType: ToolType): Promise<void> {
    if (import.meta.env.DEV) {
      console.log('[ToolManager.switchTool] Called with:', toolType)
    }
    
    // 停用当前工具
    if (this.currentTool) {
      this.currentTool.deactivate()
      this.currentTool = null
    }

    // 激活新工具
    const tool = this.tools.get(toolType)
    if (tool) {
      await tool.init()
      tool.activate()
      this.currentTool = tool
      // 更新渲染函数
      this.renderFunctions.set(toolType, tool.getRenderFunction())
      // 同步更新 toolStore，确保 ToolBar 显示正确的选中状态
      const toolStore = useToolStore()
      if (import.meta.env.DEV) {
        console.log('[ToolManager.switchTool] Setting toolStore.tool to:', toolType, 'current value:', toolStore.tool)
      }
      toolStore.setTool(toolType)
      if (import.meta.env.DEV) {
        console.log('[ToolManager.switchTool] toolStore.tool after setTool:', toolStore.tool)
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('[ToolManager.switchTool] Tool not found:', toolType)
      }
    }
  }

  /**
   * 获取当前工具
   */
  getCurrentTool(): BaseTool | null {
    return this.currentTool
  }

  /**
   * 获取当前工具类型
   */
  getCurrentToolType(): ToolType | null {
    for (const [type, tool] of this.tools.entries()) {
      if (tool === this.currentTool) {
        return type
      }
    }
    return null
  }

  /**
   * 获取指定类型的工具
   */
  getTool(toolType: ToolType): BaseTool | null {
    return this.tools.get(toolType) || null
  }

  /**
   * 获取工具的渲染函数
   */
  getToolRenderFunction(toolType: ToolType): ToolRenderFunction | null {
    return this.renderFunctions.get(toolType) || null
  }

  /**
   * 获取当前工具的渲染函数
   * 直接从工具实例获取，而不是从缓存的 Map 中获取，确保获取到最新的渲染函数
   */
  getCurrentToolRenderFunction(): ToolRenderFunction | null {
    if (!this.currentTool) return null
    // 直接从工具实例获取，确保获取到最新的渲染函数
    return this.currentTool.getRenderFunction()
  }

  /**
   * 清理所有工具
   */
  cleanupAll(): void {
    // 停用当前工具
    if (this.currentTool) {
      this.currentTool.deactivate()
      this.currentTool.cleanup()
      this.currentTool = null
    }

    // 清理所有工具
    for (const tool of this.tools.values()) {
      tool.cleanup()
    }

    this.tools.clear()
    this.renderFunctions.clear()
  }

  /**
   * 重置管理器（用于测试）
   */
  static reset(): void {
    if (ToolManager.instance) {
      ToolManager.instance.cleanupAll()
      ToolManager.instance = null
    }
  }
}

// 导出单例实例
export const toolManager = ToolManager.getInstance()
