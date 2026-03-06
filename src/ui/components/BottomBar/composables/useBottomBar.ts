/**
 * BottomBar composable
 * 统一字符和字形编辑的底部栏逻辑
 */

import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useToolStore } from '@/stores/tool'
import { EditStatus } from '@/core/types'

export function useBottomBar() {
  const editorStore = useEditorStore()
  const characterStore = useCharacterStore()
  const glyphStore = useGlyphStore()
  const toolStore = useToolStore()

  const editStatus = computed(() => editorStore.editStatus)
  const tool = computed(() => toolStore.tool)
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

  // 移动画布时，显示的移动坐标
  const translateText = ref('')

  // 每次缩放时的单位缩放百分比步长
  const zoomScale = 10

  // 监听 view 变化，更新 translateText
  watch(
    () => currentEditItem.value?.view,
    (view) => {
      if (!view) return
      translateText.value = `${view.translateX},${view.translateY}`
    },
    { deep: true, immediate: true }
  )

  // 当前缩放值
  const zoom = computed(() => {
    return currentEditItem.value?.view?.zoom || 100
  })

  // 重置 translateText
  const resetTranslate = () => {
    if (!currentEditItem.value?.view) return
    currentEditItem.value.view.translateX = 0
    currentEditItem.value.view.translateY = 0
  }

  // 缩小
  const zoomEditOut = () => {
    if (!currentEditItem.value?.view) return
    const newZoom = zoom.value - zoomScale >= 0 ? zoom.value - zoomScale : 0
    currentEditItem.value.view.zoom = newZoom
    // TODO: 触发视图更新事件
    // emitter.emit(editStatus.value === EditStatus.Edit ? 'updateCharacterView' : 'updateGlyphView')
  }

  // 放大
  const zoomEditIn = () => {
    if (!currentEditItem.value?.view) return
    const newZoom = zoom.value + zoomScale <= 200 ? zoom.value + zoomScale : 200
    currentEditItem.value.view.zoom = newZoom
    // TODO: 触发视图更新事件
    // emitter.emit(editStatus.value === EditStatus.Edit ? 'updateCharacterView' : 'updateGlyphView')
  }

  // 缩放值改变
  const onZoomChange = (value: string | number) => {
    if (!currentEditItem.value?.view) return
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numValue)) return
    const _value = numValue <= 200 ? (numValue >= 0 ? numValue : 0) : 200
    currentEditItem.value.view.zoom = _value
    // TODO: 触发视图更新事件
    // emitter.emit(editStatus.value === EditStatus.Edit ? 'updateCharacterView' : 'updateGlyphView')
  }

  // 切换至移动画布工具
  const onTranslate = () => {
    toolStore.setTool('translateMover')
  }

  // 切换至选择工具
  const offTranslate = () => {
    toolStore.setTool('select')
  }

  // 切换至坐标查看工具
  const onCoordsViewer = () => {
    toolStore.setTool('coordsViewer')
  }

  // 切换至选择工具
  const offCoordsViewer = () => {
    toolStore.setTool('select')
  }

  return {
    editStatus,
    tool,
    coordsText,
    translateText,
    zoom,
    resetTranslate,
    zoomEditOut,
    zoomEditIn,
    onZoomChange,
    onTranslate,
    offTranslate,
    onCoordsViewer,
    offCoordsViewer,
  }
}
