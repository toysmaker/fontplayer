/**
 * 工具状态 Store
 * 管理当前选中的工具和坐标文本
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToolStore = defineStore('tool', () => {
  // 当前选中的工具
  const tool = ref<string>('')
  
  // 坐标查看工具显示的文本
  const coordsText = ref<string>('')

  /**
   * 设置当前工具
   */
  function setTool(newTool: string) {
    tool.value = newTool
  }

  /**
   * 设置坐标文本
   */
  function setCoordsText(text: string) {
    coordsText.value = text
  }

  return {
    // State
    tool,
    coordsText,
    
    // Actions
    setTool,
    setCoordsText,
  }
})
