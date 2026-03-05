/**
 * 编辑器状态 Store
 * 管理编辑器的整体状态（编辑模式、视图等）
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { EditStatus } from '@/core/types'

export const useEditorStore = defineStore('editor', () => {
  // 状态
  const editStatus = ref<EditStatus>(EditStatus.CharacterList)
  const showLeftPanel = ref(false)
  const showRightPanel = ref(false)
  const showToolbar = ref(false)
  const showBottomBar = ref(false)
  
  // 搜索相关状态
  const isCharacterSearching = ref(false)
  const characterSearchKeyword = ref('')

  // Actions
  /**
   * 设置编辑状态
   */
  function setEditStatus(status: EditStatus) {
    editStatus.value = status
    
    // 根据编辑状态自动调整面板显示
    switch (status) {
      case EditStatus.Edit:
      case EditStatus.Glyph:
      case EditStatus.Pic:
        showLeftPanel.value = true
        showRightPanel.value = true
        showToolbar.value = true
        showBottomBar.value = true
        break
      default:
        showLeftPanel.value = false
        showRightPanel.value = false
        showToolbar.value = false
        showBottomBar.value = false
        break
    }
  }

  /**
   * 切换左侧面板
   */
  function toggleLeftPanel() {
    showLeftPanel.value = !showLeftPanel.value
  }

  /**
   * 切换右侧面板
   */
  function toggleRightPanel() {
    showRightPanel.value = !showRightPanel.value
  }

  /**
   * 切换工具栏
   */
  function toggleToolbar() {
    showToolbar.value = !showToolbar.value
  }

  /**
   * 切换底边栏
   */
  function toggleBottomBar() {
    showBottomBar.value = !showBottomBar.value
  }

  /**
   * 设置字符搜索关键词
   */
  function setCharacterSearchKeyword(keyword: string) {
    characterSearchKeyword.value = keyword
  }

  /**
   * 设置是否正在搜索字符
   */
  function setIsCharacterSearching(isSearching: boolean) {
    isCharacterSearching.value = isSearching
    if (!isSearching) {
      characterSearchKeyword.value = ''
    }
  }

  return {
    // State
    editStatus,
    showLeftPanel,
    showRightPanel,
    showToolbar,
    showBottomBar,
    isCharacterSearching,
    characterSearchKeyword,
    
    // Actions
    setEditStatus,
    toggleLeftPanel,
    toggleRightPanel,
    toggleToolbar,
    toggleBottomBar,
    setCharacterSearchKeyword,
    setIsCharacterSearching,
  }
})
