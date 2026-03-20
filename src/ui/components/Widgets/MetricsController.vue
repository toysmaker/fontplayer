<script setup lang="ts">
/**
 * 度量可视化：两条竖线拖拽 lsb / advanceWidth，rsb 由草稿 store 自动算
 */
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { useCharacterMetricsDraftStore } from '@/stores/characterMetricsDraft'

const projectStore = useProjectStore()
const draft = useCharacterMetricsDraftStore()
const { advanceWidth, lsb, rsb, xMin, xMax } = storeToRefs(draft)

const LOGICAL_WIDTH = 500

function mapCanvasWidth(coord: number): number {
  const file = projectStore.selectedFile
  const upem = file?.fontSettings?.unitsPerEm ?? 1000
  return coord * (upem / LOGICAL_WIDTH)
}

function unmapCanvasWidth(coord: number): number {
  const file = projectStore.selectedFile
  const upem = file?.fontSettings?.unitsPerEm ?? 1000
  return coord / (upem / LOGICAL_WIDTH)
}

let lastX = 0
let mousedown = false

const onAdvanceWidthMoverMouseDown = (e: MouseEvent) => {
  mousedown = true
  lastX = e.clientX
  document.addEventListener('mousemove', onAdvanceWidthMoverMouseMove)
  document.addEventListener('mouseup', onAdvanceWidthMoverMouseUp)
}

const onAdvanceWidthMoverMouseMove = (e: MouseEvent) => {
  if (!mousedown) return
  draft.onDraftDragAdvanceWidth(mapCanvasWidth(e.clientX - lastX))
  lastX = e.clientX
}

const onAdvanceWidthMoverMouseUp = () => {
  mousedown = false
  lastX = 0
  document.removeEventListener('mousemove', onAdvanceWidthMoverMouseMove)
  document.removeEventListener('mouseup', onAdvanceWidthMoverMouseUp)
}

const onLsbMoverMouseDown = (e: MouseEvent) => {
  mousedown = true
  lastX = e.clientX
  document.addEventListener('mousemove', onLsbMoverMouseMove)
  document.addEventListener('mouseup', onLsbMoverMouseUp)
}

const onLsbMoverMouseMove = (e: MouseEvent) => {
  if (!mousedown) return
  draft.onDraftDragLsb(mapCanvasWidth(e.clientX - lastX))
  lastX = e.clientX
}

const onLsbMoverMouseUp = () => {
  mousedown = false
  lastX = 0
  document.removeEventListener('mousemove', onLsbMoverMouseMove)
  document.removeEventListener('mouseup', onLsbMoverMouseUp)
}
</script>

<template>
  <div class="widget metrics-controller">
    <div class="canvas">
      <div
        class="advance-width-controller"
        :style="{
          width: `${unmapCanvasWidth(advanceWidth)}px`,
          left: `${unmapCanvasWidth(xMin - lsb)}px`,
        }"
      >
        <div class="label">advanceWidth</div>
        <div class="advance-width-mover mover" @mousedown="onAdvanceWidthMoverMouseDown" />
      </div>
      <div
        class="lsb-controller"
        :style="{
          width: `${unmapCanvasWidth(lsb)}px`,
          left: `${unmapCanvasWidth(xMin - lsb)}px`,
        }"
      >
        <div class="label">lsb</div>
        <div class="lsb-mover mover" @mousedown="onLsbMoverMouseDown" />
      </div>
      <div
        class="rsb-controller"
        :style="{
          width: `${unmapCanvasWidth(rsb)}px`,
          left: `${unmapCanvasWidth(xMax)}px`,
        }"
      >
        <div class="label">rsb</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metrics-controller {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.metrics-controller .canvas {
  position: relative;
  width: 500px;
  height: 500px;
  z-index: 999;
}
.metrics-controller .mover {
  border-right: 2px solid var(--primary-0);
  cursor: col-resize;
  position: absolute;
  top: 0;
  bottom: 0;
  height: 100%;
}
.metrics-controller .lsb-mover {
  left: 0;
  z-index: 999;
  border-color: red;
}
.metrics-controller .advance-width-mover {
  right: 0;
  z-index: 999;
  border-color: red;
}
.metrics-controller .advance-width-controller,
.metrics-controller .lsb-controller,
.metrics-controller .rsb-controller {
  position: absolute;
  text-align: center;
  height: 100%;
  background-color: rgba(255, 0, 0, 0.2);
  color: red;
}
</style>
