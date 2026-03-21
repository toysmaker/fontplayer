/**
 * 识别图片（Pic 模式）状态：对齐原版 font store 中 Pic 相关字段
 */

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { IComponent } from '@/core/types'
import { EditStatus } from '@/core/types'

export interface EditCharacterPicState {
  dataUrl: string
  img: HTMLImageElement | null
  thumbnailCanvas: HTMLCanvasElement | null
  thumbnailPixels: Uint8ClampedArray | null
  processPixels: Uint8ClampedArray | null
  width: number
  height: number
}

export interface BitmapState {
  data: Uint8ClampedArray
  width: number
  height: number
}

export const usePictureImportStore = defineStore('pictureImport', () => {
  const prevEditStatus = ref<EditStatus | null>(null)

  const editCharacterPic = shallowRef<EditCharacterPicState | null>(null)

  const bitmap = shallowRef<BitmapState | null>(null)

  const contoursComponents = ref<IComponent[]>([])
  const curvesComponents = ref<IComponent[]>([])

  const step = ref(0)
  const previewStatus = ref(0)
  const listWidth = ref(600)

  const rThreshold = ref(128)
  const gThreshold = ref(128)
  const bThreshold = ref(128)

  const localRThreshold = ref(128)
  const localGThreshold = ref(128)
  const localBThreshold = ref(128)
  const localBrushSize = ref(8)
  const localBrushX = ref(0)
  const localBrushY = ref(0)
  const enableLocalBrush = ref(false)

  const maxError = ref(10)
  const dropThreshold = ref(4)

  /** 导入时轮廓映射目标：缩略图像素 (picW×picH) → 字符 em (importEmWidth×importEmHeight) */
  const importEmWidth = ref(1000)
  const importEmHeight = ref(1000)

  function setPrevEditStatus(s: EditStatus | null) {
    prevEditStatus.value = s
  }

  function setEditCharacterPic(payload: EditCharacterPicState | null) {
    editCharacterPic.value = payload
  }

  function setBitMap(payload: BitmapState | null) {
    bitmap.value = payload
  }

  function clearContoursComponent() {
    contoursComponents.value = []
  }

  function clearCurvesComponent() {
    curvesComponents.value = []
  }

  function setContoursComponents(list: IComponent[]) {
    contoursComponents.value = list
  }

  function setCurvesComponents(list: IComponent[]) {
    curvesComponents.value = list
  }

  function resetEditPic() {
    prevEditStatus.value = null
    editCharacterPic.value = null
    bitmap.value = null
    contoursComponents.value = []
    curvesComponents.value = []
    step.value = 0
    previewStatus.value = 0
    enableLocalBrush.value = false
    importEmWidth.value = 1000
    importEmHeight.value = 1000
  }

  return {
    prevEditStatus,
    editCharacterPic,
    bitmap,
    contoursComponents,
    curvesComponents,
    step,
    previewStatus,
    listWidth,
    rThreshold,
    gThreshold,
    bThreshold,
    localRThreshold,
    localGThreshold,
    localBThreshold,
    localBrushSize,
    localBrushX,
    localBrushY,
    enableLocalBrush,
    maxError,
    dropThreshold,
    importEmWidth,
    importEmHeight,
    setPrevEditStatus,
    setEditCharacterPic,
    setBitMap,
    clearContoursComponent,
    clearCurvesComponent,
    setContoursComponents,
    setCurvesComponents,
    resetEditPic,
  }
})
