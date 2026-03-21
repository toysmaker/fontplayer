<script setup lang="ts">
/**
 * 识别图片左侧五阶段缩略列表（对齐原 ViewList.vue：点击切换 previewStatus）
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import * as R from 'ramda'
import { usePictureImportStore } from '@/stores/pictureImport'
import { useProjectStore } from '@/stores/project'
import type { IComponent, IPenComponent, IPolygonComponent } from '@/core/types'
import { renderCanvas } from '@/core/canvas/EditorCanvasRenderer'
import { mapCanvasWidth, mapCanvasHeight, mapCanvasX, mapCanvasY } from '@/utils/canvas'

const { t } = useI18n()
const pictureStore = usePictureImportStore()
const projectStore = useProjectStore()

const { editCharacterPic, bitmap, contoursComponents, curvesComponents, previewStatus } =
  storeToRefs(pictureStore)

const thumbnailCanvas = ref<HTMLCanvasElement | null>(null)
const bitmapCanvas = ref<HTMLCanvasElement | null>(null)
const contoursCanvas = ref<HTMLCanvasElement | null>(null)
const curvesCanvas = ref<HTMLCanvasElement | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

function clearCanvasEl(c: HTMLCanvasElement | null) {
  if (!c) return
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (ctx) ctx.clearRect(0, 0, c.width, c.height)
}

function updateStyle() {
  const pic = editCharacterPic.value
  if (!pic) return
  const picWidth = pic.width
  const picHeight = pic.height
  let picCanvasWidth = 68
  let picCanvasHeight = (picCanvasWidth * picHeight) / picWidth
  if (picCanvasHeight > 68) {
    picCanvasHeight = 68
    picCanvasWidth = (picCanvasHeight * picWidth) / picHeight
  }
  const tc = thumbnailCanvas.value
  const bc = bitmapCanvas.value
  if (tc) {
    tc.width = mapCanvasWidth(picWidth)
    tc.height = mapCanvasHeight(picHeight)
    tc.style.width = `${picCanvasWidth}px`
    tc.style.height = `${picCanvasHeight}px`
  }
  if (bc) {
    bc.width = mapCanvasWidth(picWidth)
    bc.height = mapCanvasHeight(picHeight)
    bc.style.width = `${picCanvasWidth}px`
    bc.style.height = `${picCanvasHeight}px`
  }
}

function renderThumbnailCanvas() {
  const ctx = thumbnailCanvas.value?.getContext('2d', { willReadFrequently: true })
  const pic = editCharacterPic.value
  if (!ctx || !pic?.img) return
  const image = pic.img
  ctx.clearRect(0, 0, thumbnailCanvas.value!.width, thumbnailCanvas.value!.height)
  ctx.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    0,
    0,
    mapCanvasWidth(pic.width),
    mapCanvasHeight(pic.height),
  )
}

function renderBitMapCanvas() {
  const canvas = bitmapCanvas.value
  const bm = bitmap.value
  if (!canvas || !bm?.data) return
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const { data, width, height } = bm
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const index = (j * width + i) * 4
      const color = `rgba(${data[index]}, ${data[index + 1]}, ${data[index + 2]}, ${data[index + 3]})`
      ctx.fillStyle = color
      ctx.fillRect(mapCanvasX(i), mapCanvasY(j), mapCanvasWidth(1), mapCanvasHeight(1))
    }
  }
}

async function renderContoursCanvas() {
  const canvas = contoursCanvas.value
  if (!canvas) return
  const components = contoursComponents.value.map((contourComponent: IComponent) => {
    const _c = R.clone(contourComponent)
    ;(_c.value as IPolygonComponent).fillColor = ''
    return _c
  })
  clearCanvasEl(canvas)
  await renderCanvas(components, canvas)
}

async function renderCurvesCanvas() {
  const canvas = curvesCanvas.value
  if (!canvas) return
  const components = curvesComponents.value.map((curveComponent: IComponent) => {
    const _c = R.clone(curveComponent)
    ;(_c.value as IPenComponent).fillColor = ''
    return _c
  })
  clearCanvasEl(canvas)
  await renderCanvas(components, canvas)
}

async function renderPreviewCanvas() {
  const canvas = previewCanvas.value
  if (!canvas) return
  clearCanvasEl(canvas)
  await renderCanvas(curvesComponents.value, canvas, {
    fill: true,
    offset: { x: 0, y: 0 },
    scale: 1,
    forceUpdate: false,
  })
}

async function render() {
  await renderPreviewCanvas()
  renderThumbnailCanvas()
  renderBitMapCanvas()
  await renderContoursCanvas()
  await renderCurvesCanvas()
}

function setPreview(i: number) {
  previewStatus.value = i
}

onMounted(() => {
  updateStyle()
  window.addEventListener('resize', updateStyle)
  void nextTick(() => void render())
})

watch(
  [editCharacterPic, bitmap, contoursComponents, curvesComponents],
  () => {
    nextTick(() => {
      updateStyle()
      void render()
    })
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateStyle)
})
</script>

<template>
  <div v-if="editCharacterPic && projectStore.selectedFile" class="picture-import-view-list">
    <div
      class="view-item-wrapper"
      :class="{ 'is-active': previewStatus === 0 }"
      @pointerdown="setPreview(0)"
    >
      <span class="view-thumbnail">
        <canvas ref="thumbnailCanvas" class="view-canvas" />
      </span>
      <span class="view-info">
        <span class="view-title">{{ t('panels.viewList.thumbnail.title') }}</span>
        <span class="view-description">{{ t('panels.viewList.thumbnail.description') }}</span>
      </span>
    </div>
    <div
      class="view-item-wrapper"
      :class="{ 'is-active': previewStatus === 1 }"
      @pointerdown="setPreview(1)"
    >
      <span class="view-thumbnail">
        <canvas ref="bitmapCanvas" class="view-canvas" />
      </span>
      <span class="view-info">
        <span class="view-title">{{ t('panels.viewList.bitmap.title') }}</span>
        <span class="view-description">{{ t('panels.viewList.bitmap.description') }}</span>
      </span>
    </div>
    <div
      class="view-item-wrapper"
      :class="{ 'is-active': previewStatus === 2 }"
      @pointerdown="setPreview(2)"
    >
      <span class="view-thumbnail">
        <canvas
          ref="contoursCanvas"
          class="view-canvas"
          :width="mapCanvasWidth(projectStore.selectedFile.width)"
          :height="mapCanvasHeight(projectStore.selectedFile.height)"
        />
      </span>
      <span class="view-info">
        <span class="view-title">{{ t('panels.viewList.contours.title') }}</span>
        <span class="view-description">{{ t('panels.viewList.contours.description') }}</span>
      </span>
    </div>
    <div
      class="view-item-wrapper"
      :class="{ 'is-active': previewStatus === 3 }"
      @pointerdown="setPreview(3)"
    >
      <span class="view-thumbnail">
        <canvas
          ref="curvesCanvas"
          class="view-canvas"
          :width="mapCanvasWidth(projectStore.selectedFile.width)"
          :height="mapCanvasHeight(projectStore.selectedFile.height)"
        />
      </span>
      <span class="view-info">
        <span class="view-title">{{ t('panels.viewList.curves.title') }}</span>
        <span class="view-description">{{ t('panels.viewList.curves.description') }}</span>
      </span>
    </div>
    <div
      class="view-item-wrapper"
      :class="{ 'is-active': previewStatus === 4 }"
      @pointerdown="setPreview(4)"
    >
      <span class="view-thumbnail">
        <canvas
          ref="previewCanvas"
          class="view-canvas"
          :width="mapCanvasWidth(projectStore.selectedFile.width)"
          :height="mapCanvasHeight(projectStore.selectedFile.height)"
        />
      </span>
      <span class="view-info">
        <span class="view-title">{{ t('panels.viewList.preview.title') }}</span>
        <span class="view-description">{{ t('panels.viewList.preview.description') }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.picture-import-view-list {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  background: var(--n-color);
}
.view-item-wrapper {
  height: 80px;
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid var(--n-divider-color);
  cursor: pointer;
  color: var(--n-text-color);
}
.view-item-wrapper:hover {
  background-color: var(--n-color-hover);
}
.view-item-wrapper.is-active {
  background-color: var(--n-color-pressed);
}
.view-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 68px;
  width: 68px;
  flex: 0 0 68px;
  background-color: #fff;
  margin: 5px;
  box-sizing: border-box;
  overflow: hidden;
}
.view-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 8px 0 0;
  gap: 2px;
}
.view-description {
  font-size: 11px;
  color: var(--n-text-color-3);
  line-height: 1.25;
}
.view-title {
  font-weight: 600;
  font-size: 12px;
}
.view-canvas {
  display: block;
  margin: auto;
  max-width: 68px;
  max-height: 68px;
}
</style>
