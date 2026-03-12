/**
 * EditFilesBar composable
 * 统一字符和字形编辑的 FilesBar 逻辑
 */

import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { fontRenderStyle } from '@/core/script/globals'
import { EditStatus } from '@/core/types'

export function useEditFilesBar() {
  const editorStore = useEditorStore()
  const characterStore = useCharacterStore()
  const glyphStore = useGlyphStore()

  const editStatus = computed(() => editorStore.editStatus)

  // 当前编辑项的名称
  const currentName = computed(() => {
    if (editStatus.value === EditStatus.Edit) {
      return characterStore.editingCharacter?.character?.text || ''
    } else if (editStatus.value === EditStatus.Glyph) {
      return glyphStore.editingGlyph?.name || ''
    }
    return ''
  })

  // 渲染样式选项
  const renderStyleOptions = computed(() => {
    if (editStatus.value === EditStatus.Edit) {
      // 字符编辑模式：3个选项
      return [
        { label: '轮廓', value: 'contour' },
        { label: '黑色', value: 'black' },
        { label: '彩色', value: 'color' },
      ]
    } else if (editStatus.value === EditStatus.Glyph) {
      // 字形编辑模式：2个选项
      return [
        { label: '轮廓', value: 'contour' },
        { label: '黑色', value: 'black' },
      ]
    }
    return []
  })

  // 当前渲染样式
  const currentRenderStyle = computed({
    get: () => fontRenderStyle.value,
    set: (value: string) => {
      // 类型断言，确保值符合类型要求
      if (value === 'color' || value === 'contour' || value === 'black') {
        fontRenderStyle.value = value
        // TODO: 触发重新渲染
        // emitter.emit('renderPreviewCanvas')
      }
    },
  })

  return {
    editStatus,
    currentName,
    renderStyleOptions,
    currentRenderStyle,
  }
}
