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
  const prevStatus = ref<EditStatus>(EditStatus.CharacterList) // 记录之前的状态，用于返回
  const showLeftPanel = ref(false)
  const showRightPanel = ref(false)
  const showToolbar = ref(false)
  const showBottomBar = ref(false)
  
  // 搜索相关状态
  const isCharacterSearching = ref(false)
  const characterSearchKeyword = ref('')
  
  // 组件列表过滤器
  const editPanelCompFilter = ref<'all' | 'font'>('all')
  const glyphPanelCompFilter = ref<'all' | 'font'>('all')

  // 关键点和辅助线显示状态
  const checkJoints = ref<boolean>(true)
  const checkRefLines = ref<boolean>(true)

  // Actions
  /**
   * 设置编辑状态
   */
  function setEditStatus(status: EditStatus) {
    // 如果从列表模式进入编辑模式，保存当前的列表状态到 prevStatus
    const isListStatus = editStatus.value === EditStatus.CharacterList || 
                         editStatus.value === EditStatus.StrokeGlyphList || 
                         editStatus.value === EditStatus.RadicalGlyphList || 
                         editStatus.value === EditStatus.CompGlyphList || 
                         editStatus.value === EditStatus.GlyphList
    const isEditStatus = status === EditStatus.Edit || status === EditStatus.Glyph
    
    if (isListStatus && isEditStatus) {
      // 保存当前的列表状态到 prevStatus
      prevStatus.value = editStatus.value
      if (import.meta.env.DEV) {
        console.log(`[EditorStore] Saving prevStatus: ${prevStatus.value} -> entering ${status}`)
      }
    }
    
    editStatus.value = status
    
    if (import.meta.env.DEV) {
      console.log(`[EditorStore] setEditStatus: ${status}, prevStatus: ${prevStatus.value}`)
    }
    
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

  /**
   * 设置编辑面板组件过滤器
   */
  function setEditPanelCompFilter(filter: 'all' | 'font') {
    editPanelCompFilter.value = filter
  }

  /**
   * 设置字形面板组件过滤器
   */
  function setGlyphPanelCompFilter(filter: 'all' | 'font') {
    glyphPanelCompFilter.value = filter
  }

  return {
    // State
    editStatus,
    prevStatus,
    showLeftPanel,
    showRightPanel,
    showToolbar,
    showBottomBar,
    isCharacterSearching,
    characterSearchKeyword,
    editPanelCompFilter,
    glyphPanelCompFilter,
    checkJoints,
    checkRefLines,
    
    // Actions
    setEditStatus,
    toggleLeftPanel,
    toggleRightPanel,
    toggleToolbar,
    toggleBottomBar,
    setCharacterSearchKeyword,
    setIsCharacterSearching,
    setEditPanelCompFilter,
    setGlyphPanelCompFilter,
  }
})
