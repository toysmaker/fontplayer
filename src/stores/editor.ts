/**
 * 编辑器状态 Store
 * 管理编辑器的整体状态（编辑模式、视图等）
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { EditStatus } from '@/core/types'

/** setEditStatus 可选参数 */
export type SetEditStatusOptions = {
  /**
   * 允许离开「识别图片」模式。
   * 须由 PictureImportEditor 的确认/删除等显式操作传入，防止工具栏等误切回列表。
   */
  allowLeavePic?: boolean
}

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
  
  // 组件列表过滤器（支持 all、font 以及 layer 名称）
  const editPanelCompFilter = ref<string>('all')
  const glyphPanelCompFilter = ref<string>('all')

  // 关键点和辅助线显示状态
  const checkJoints = ref<boolean>(true)
  const checkRefLines = ref<boolean>(true)

  // 可变参数预览模式（仅在字形编辑界面有效）
  const variablePreviewEnabled = ref<boolean>(false)

  // 用于跨组件触发 canvas 重绘的计数器（GlyphEditPanel 修改后递增，Editor watch 它）
  const componentRenderTick = ref(0)

  // Actions
  /**
   * 设置编辑状态
   */
  function setEditStatus(status: EditStatus, options?: SetEditStatusOptions) {
    if (
      editStatus.value === EditStatus.Pic &&
      status !== EditStatus.Pic &&
      !options?.allowLeavePic
    ) {
      return
    }

    // 如果从列表模式进入编辑模式，保存当前的列表状态到 prevStatus
    const isListStatus = editStatus.value === EditStatus.CharacterList || 
                         editStatus.value === EditStatus.StrokeGlyphList || 
                         editStatus.value === EditStatus.RadicalGlyphList || 
                         editStatus.value === EditStatus.CompGlyphList || 
                         editStatus.value === EditStatus.GlyphList
    const isEditStatus = status === EditStatus.Edit || status === EditStatus.Glyph
    const enteringAdvanced = status === EditStatus.AdvancedEdit

    if (isListStatus && (isEditStatus || enteringAdvanced)) {
      // 保存当前的列表状态到 prevStatus（进入字符/字形编辑或高级编辑）
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
        showLeftPanel.value = true
        showRightPanel.value = true
        showToolbar.value = true
        showBottomBar.value = true
        break
      case EditStatus.Pic:
        showLeftPanel.value = true
        showRightPanel.value = true
        showToolbar.value = false
        showBottomBar.value = false
        break
      case EditStatus.AdvancedEdit:
        showLeftPanel.value = false
        showRightPanel.value = false
        showToolbar.value = false
        showBottomBar.value = false
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
  function setEditPanelCompFilter(filter: string) {
    editPanelCompFilter.value = filter
  }

  /**
   * 设置字形面板组件过滤器
   */
  function setGlyphPanelCompFilter(filter: string) {
    glyphPanelCompFilter.value = filter
  }

  /**
   * 设置可变参数预览模式
   */
  function setVariablePreviewEnabled(enabled: boolean) {
    variablePreviewEnabled.value = enabled
  }

  function bumpComponentRenderTick() {
    componentRenderTick.value++
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
    variablePreviewEnabled,
    componentRenderTick,

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
    setVariablePreviewEnabled,
    bumpComponentRenderTick,
  }
})
