/**
 * 字符「度量调整」会话：草稿值与 Hydrate / 应用 / 重置
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ContourConverter } from '@/core/font/converter'
import { PathType } from '@/core/font/types'
import type { IPath, IContours } from '@/core/font/types'
import type { IComponent } from '@/core/types'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'

function collectBBoxFromContours(contours: IContours): {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
} {
  const xCoords: number[] = []
  const yCoords: number[] = []
  for (let i = 0; i < contours.length; i += 1) {
    const contour = contours[i]
    for (let j = 0; j < contour.length; j += 1) {
      const seg = contour[j] as IPath
      xCoords.push(seg.start.x, seg.end.x)
      yCoords.push(seg.start.y, seg.end.y)
      if (seg.type === PathType.QUADRATIC_BEZIER) {
        xCoords.push(seg.control.x)
        yCoords.push(seg.control.y)
      } else if (seg.type === PathType.CUBIC_BEZIER) {
        xCoords.push(seg.control1.x, seg.control2.x)
        yCoords.push(seg.control1.y, seg.control2.y)
      }
    }
  }
  if (!xCoords.length) {
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 }
  }
  return {
    xMin: Math.min(...xCoords),
    xMax: Math.max(...xCoords),
    yMin: Math.min(...yCoords),
    yMax: Math.max(...yCoords),
  }
}

export const useCharacterMetricsDraftStore = defineStore('characterMetricsDraft', () => {
  const advanceWidth = ref(1000)
  const lsb = ref(0)
  const rsb = ref(0)
  const xMin = ref(0)
  const xMax = ref(1000)
  const yMin = ref(0)
  const yMax = ref(1000)

  function recomputeRsb() {
    rsb.value = advanceWidth.value - (lsb.value + xMax.value - xMin.value)
  }

  /** 从轮廓计算 bbox；无轮廓时退回全零 / unitsPerEm */
  function hydrateFromEditingCharacter() {
    const characterStore = useCharacterStore()
    const projectStore = useProjectStore()
    const ch = (characterStore as any).editingCharacter
    const file = projectStore.selectedFile
    if (!ch || !file) return

    const fs = file.fontSettings
    const unitsPerEm = fs?.unitsPerEm ?? 1000
    const descender = fs?.descender ?? -200

    const components: IComponent[] = (characterStore as any).orderedListWithItemsForCurrentCharacterFile ?? []
    let bx = { xMin: 0, xMax: unitsPerEm, yMin: 0, yMax: 0 }
    if (components.length > 0) {
      try {
        const contours = ContourConverter.componentsToContours(
          components,
          { unitsPerEm, descender, advanceWidth: unitsPerEm, preview: false },
          { x: 0, y: 0 },
        )
        bx = collectBBoxFromContours(contours)
      } catch {
        bx = { xMin: 0, xMax: unitsPerEm, yMin: 0, yMax: 0 }
      }
    }

    if (!isFinite(bx.xMin)) bx.xMin = 0
    if (!isFinite(bx.xMax)) bx.xMax = unitsPerEm
    if (!isFinite(bx.yMin)) bx.yMin = 0
    if (!isFinite(bx.yMax)) bx.yMax = 0

    xMin.value = bx.xMin
    xMax.value = bx.xMax
    yMin.value = bx.yMin
    yMax.value = bx.yMax

    const info = ch.info
    const _metrics = info?.metrics
    let advW = unitsPerEm
    let lsbV = 0
    let useDefault = true
    if (_metrics) {
      useDefault = _metrics.useDefaultValues !== false
      advW = _metrics.advanceWidth ?? unitsPerEm
      lsbV = _metrics.lsb ?? 0
    }
    if (useDefault) {
      advW = unitsPerEm
      lsbV = bx.xMin
    }
    advanceWidth.value = advW
    lsb.value = lsbV
    recomputeRsb()
  }

  function onDraftDragAdvanceWidth(deltaEm: number) {
    advanceWidth.value += deltaEm
    recomputeRsb()
  }

  function onDraftDragLsb(deltaEm: number) {
    lsb.value -= deltaEm
    recomputeRsb()
  }

  function applyToEditingCharacter() {
    const characterStore = useCharacterStore()
    const projectStore = useProjectStore()
    const ch = (characterStore as any).editingCharacter
    const file = projectStore.selectedFile
    if (!ch || !file) return false
    if (!ch.info) ch.info = {}
    ch.info.metrics = {
      lsb: lsb.value,
      advanceWidth: advanceWidth.value,
      useDefaultValues: false,
    }
    projectStore.markFileUnsaved(file.uuid)
    return true
  }

  function resetToDefaultOnCharacter() {
    const characterStore = useCharacterStore()
    const projectStore = useProjectStore()
    const ch = (characterStore as any).editingCharacter
    const file = projectStore.selectedFile
    if (!ch || !file) return false
    const unitsPerEm = file.fontSettings?.unitsPerEm ?? 1000
    if (!ch.info) ch.info = {}
    ch.info.metrics = {
      advanceWidth: unitsPerEm,
      lsb: 0,
      useDefaultValues: true,
    }
    projectStore.markFileUnsaved(file.uuid)
    hydrateFromEditingCharacter()
    return true
  }

  return {
    advanceWidth,
    lsb,
    rsb,
    xMin,
    xMax,
    yMin,
    yMax,
    recomputeRsb,
    hydrateFromEditingCharacter,
    onDraftDragAdvanceWidth,
    onDraftDragLsb,
    applyToEditingCharacter,
    resetToDefaultOnCharacter,
  }
})
