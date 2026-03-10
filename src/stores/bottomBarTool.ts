/**
 * BottomBar 工具状态 Store
 * 管理 BottomBar 功能的状态（与 toolbar 工具系统分离）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bottomBarToolManager, type BottomBarTool } from '@/features/bottomBar/BottomBarToolManager'

export const useBottomBarToolStore = defineStore('bottomBarTool', () => {
  // 当前激活的 BottomBar 工具
  // 使用 ref 而不是 computed，这样 setCurrentTool 可以工作
  // Editor 组件会监听这个值的变化并调用管理器的方法
  const currentTool = ref<BottomBarTool>(null)

  /**
   * 获取当前工具
   */
  function getCurrentTool(): BottomBarTool {
    return currentTool.value
  }

  /**
   * 设置当前工具
   * 这个值会被 Editor 组件监听，然后调用管理器的相应方法
   */
  function setCurrentTool(tool: BottomBarTool): void {
    currentTool.value = tool
  }

  /**
   * 同步管理器状态到 store
   */
  function syncFromManager(): void {
    currentTool.value = bottomBarToolManager.getCurrentTool()
  }

  return {
    // State
    currentTool,
    
    // Actions
    getCurrentTool,
    setCurrentTool,
    syncFromManager,
  }
})
