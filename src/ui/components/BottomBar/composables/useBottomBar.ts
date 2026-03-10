/**
 * BottomBar composable
 * 统一字符和字形编辑的底部栏逻辑
 */

import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useToolStore } from '@/stores/tool'
import { useBottomBarToolStore } from '@/stores/bottomBarTool'
import { bottomBarToolManager } from '@/features/bottomBar/BottomBarToolManager'
import { EditStatus } from '@/core/types'
import { createDebouncedHandler } from '@/utils/debounce-click'

export function useBottomBar() {
  const editorStore = useEditorStore()
  const characterStore = useCharacterStore()
  const glyphStore = useGlyphStore()
  const toolStore = useToolStore()
  const bottomBarToolStore = useBottomBarToolStore()

  const editStatus = computed(() => editorStore.editStatus)
  // 使用 bottomBarTool store 替代 tool store
  const bottomBarTool = computed(() => bottomBarToolStore.currentTool)
  const coordsText = computed(() => toolStore.coordsText)

  // 根据 editStatus 获取当前编辑项
  const currentEditItem = computed(() => {
    if (editStatus.value === EditStatus.Edit) {
      return characterStore.editingCharacter
    } else if (editStatus.value === EditStatus.Glyph) {
      return glyphStore.editingGlyph
    }
    return null
  })

  // 移动画布时，显示的移动坐标（translate 功能暂时注释）
  // const translateText = ref('')

  // 每次缩放时的单位缩放百分比步长
  const zoomScale = 10

  // 监听 view 变化，更新 translateText（translate 功能暂时注释）
  // watch(
  //   () => currentEditItem.value?.view,
  //   (view) => {
  //     if (!view) return
  //     translateText.value = `${view.translateX},${view.translateY}`
  //   },
  //   { deep: true, immediate: true }
  // )

  // 当前缩放值
  const zoom = computed(() => {
    return currentEditItem.value?.view?.zoom || 100
  })

  // 重置 translateText（translate 功能暂时注释）
  // const _resetTranslate = () => {
  //   if (!currentEditItem.value?.view) return
  //   currentEditItem.value.view.translateX = 0
  //   currentEditItem.value.view.translateY = 0
  // }
  // const resetTranslate = createDebouncedHandler(_resetTranslate, 'BottomBar.resetTranslate')

  // 缩小
  const _zoomEditOut = () => {
    if (!currentEditItem.value?.view) return
    const newZoom = zoom.value - zoomScale >= 0 ? zoom.value - zoomScale : 0
    currentEditItem.value.view.zoom = newZoom
    // Zoom 更新会通过 watch 自动触发 canvas 尺寸更新（在 Editor 组件中处理）
  }
  const zoomEditOut = createDebouncedHandler(_zoomEditOut, 'BottomBar.zoomEditOut')

  // 放大
  const _zoomEditIn = () => {
    if (!currentEditItem.value?.view) return
    const newZoom = zoom.value + zoomScale <= 200 ? zoom.value + zoomScale : 200
    currentEditItem.value.view.zoom = newZoom
    // Zoom 更新会通过 watch 自动触发 canvas 尺寸更新（在 Editor 组件中处理）
  }
  const zoomEditIn = createDebouncedHandler(_zoomEditIn, 'BottomBar.zoomEditIn')

  // 缩放值改变
  const onZoomChange = (value: string | number) => {
    if (!currentEditItem.value?.view) return
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numValue)) return
    const _value = numValue <= 200 ? (numValue >= 0 ? numValue : 0) : 200
    currentEditItem.value.view.zoom = _value
    // Zoom 更新会通过 watch 自动触发 canvas 尺寸更新（在 Editor 组件中处理）
  }

  // 切换至移动画布工具（translate 功能暂时注释）
  // const _onTranslate = () => {
  //   // 不再使用 toolStore.setTool，改用 bottomBarToolManager
  //   // bottomBarToolManager.activateTranslate(canvas)
  // }
  // const onTranslate = createDebouncedHandler(_onTranslate, 'BottomBar.onTranslate')

  // 切换至选择工具（translate 功能暂时注释）
  // const _offTranslate = () => {
  //   // bottomBarToolManager.deactivateTranslate()
  // }
  // const offTranslate = createDebouncedHandler(_offTranslate, 'BottomBar.offTranslate')

  // 切换至坐标查看工具
  // 注意：这里只切换状态，实际的 canvas 注册在 Editor 组件中完成
  const _onCoordsViewer = () => {
    // 不再使用 toolStore.setTool，改用 bottomBarToolManager
    // 实际的激活需要在 Editor 组件中调用，因为需要 canvas 引用
    // 这里只是标记需要激活，实际的激活逻辑在 Editor 组件中
    bottomBarToolStore.setCurrentTool('coordsViewer')
  }
  const onCoordsViewer = createDebouncedHandler(_onCoordsViewer, 'BottomBar.onCoordsViewer')

  // 切换至关闭坐标查看工具
  const _offCoordsViewer = () => {
    bottomBarToolManager.deactivateCoordsViewer()
    bottomBarToolStore.setCurrentTool(null)
  }
  const offCoordsViewer = createDebouncedHandler(_offCoordsViewer, 'BottomBar.offCoordsViewer')

  return {
    editStatus,
    bottomBarTool,
    coordsText,
    // translateText, // translate 功能暂时注释
    zoom,
    // resetTranslate, // translate 功能暂时注释
    zoomEditOut,
    zoomEditIn,
    onZoomChange,
    // onTranslate, // translate 功能暂时注释
    // offTranslate, // translate 功能暂时注释
    onCoordsViewer,
    offCoordsViewer,
  }
}
