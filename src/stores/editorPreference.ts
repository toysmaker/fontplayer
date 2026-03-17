/**
 * 编辑画布偏好：背景、网格
 * 供偏好设置对话框与 CharacterEditor / GlyphEditor 使用
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BackgroundType, GridType } from '@/core/canvas/types'
import type { IBackground, IGrid } from '@/core/canvas/types'

export const useEditorPreferenceStore = defineStore('editorPreference', () => {
  const backgroundType = ref<BackgroundType>(BackgroundType.Transparent)
  const backgroundColor = ref<string>('#FFFFFF')
  const gridType = ref<GridType>(GridType.None)
  const gridPrecision = ref<number>(20)

  const background = computed<IBackground>(() => ({
    type: backgroundType.value,
    color: backgroundColor.value,
  }))

  const grid = computed<IGrid>(() => ({
    type: gridType.value,
    precision: gridPrecision.value,
  }))

  function setBackgroundType(type: BackgroundType) {
    backgroundType.value = type
  }

  function setBackgroundColor(color: string) {
    backgroundColor.value = color
  }

  function setGridType(type: GridType) {
    gridType.value = type
  }

  function setGridPrecision(precision: number) {
    gridPrecision.value = precision
  }

  return {
    backgroundType,
    backgroundColor,
    gridType,
    gridPrecision,
    background,
    grid,
    setBackgroundType,
    setBackgroundColor,
    setGridType,
    setGridPrecision,
  }
})
