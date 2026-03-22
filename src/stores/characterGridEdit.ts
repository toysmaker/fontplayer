/**
 * 九宫格布局编辑：区分正在改 initialGrid 还是 currentGrid（影响 computeCoords 是否跳过预览变形）
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type GridEditTarget = 'currentGrid' | 'initialGrid'

export const useCharacterGridEditStore = defineStore('characterGridEdit', () => {
  const gridEditTarget = ref<GridEditTarget>('currentGrid')
  /** 与旧版 gridChanged 一致：画布/右栏改过布局预览后允许「应用布局变换」 */
  const layoutGridDirty = ref(false)
  /** CharacterEditor 监听以强制同步重绘主 canvas */
  const mainCanvasRerenderNonce = ref(0)

  function setGridEditTarget(t: GridEditTarget) {
    gridEditTarget.value = t
  }

  function resetToCurrent() {
    gridEditTarget.value = 'currentGrid'
  }

  function markLayoutGridDirty() {
    layoutGridDirty.value = true
  }

  function clearLayoutGridDirty() {
    layoutGridDirty.value = false
  }

  function bumpMainCanvasRerender() {
    mainCanvasRerenderNonce.value += 1
  }

  return {
    gridEditTarget,
    setGridEditTarget,
    resetToCurrent,
    layoutGridDirty,
    markLayoutGridDirty,
    clearLayoutGridDirty,
    mainCanvasRerenderNonce,
    bumpMainCanvasRerender,
  }
})
