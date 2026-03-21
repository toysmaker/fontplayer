<script setup lang="ts">
/**
 * 识别图片主区：多画布预览与顶栏操作（对齐 ThumbnailEditPanel）
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { NButton, NButtonGroup, useMessage } from 'naive-ui'
import * as R from 'ramda'
import { useI18n } from 'vue-i18n'
import { usePictureImportStore } from '@/stores/pictureImport'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { EditStatus, type IComponent, type IPenComponent, type IPolygonComponent } from '@/core/types'
import { PictureImportPipelineService } from '@/features/editor/services/PictureImportPipelineService'
import { renderCanvas } from '@/core/canvas/EditorCanvasRenderer'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { toBlackWhiteBitMap } from '@/features/image-import/binarize'
import { PIC_PREVIEW_SLIDE_COUNT, PIC_CAROUSEL_PANEL_COUNT } from '@/features/image-import/pictureImportConstants'

const { t, locale } = useI18n()
const message = useMessage()

const pictureStore = usePictureImportStore()
const editorStore = useEditorStore()
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const glyphStore = useGlyphStore()

const {
  editCharacterPic,
  bitmap,
  contoursComponents,
  curvesComponents,
  previewStatus,
  listWidth,
  enableLocalBrush,
  step,
  localBrushSize,
  localBrushX,
  localBrushY,
  localRThreshold,
  localGThreshold,
  localBThreshold,
} = storeToRefs(pictureStore)

const file = computed(() => projectStore.selectedFile)

const previewCanvas1 = ref<HTMLCanvasElement | null>(null)
const thumbnailCanvasRef = ref<HTMLCanvasElement | null>(null)
const bitmapCanvasRef = ref<HTMLCanvasElement | null>(null)
const contoursCanvasRef = ref<HTMLCanvasElement | null>(null)
const curvesCanvasRef = ref<HTMLCanvasElement | null>(null)
const previewCanvas2 = ref<HTMLCanvasElement | null>(null)

const outerWrapperRef = ref<HTMLElement | null>(null)

const carouselStripStyle = computed(() => ({
  left: `${(-previewStatus.value * listWidth.value) / 2}px`,
  width: `${(PIC_CAROUSEL_PANEL_COUNT * listWidth.value) / 2}px`,
}))

function clearCanvasEl(c: HTMLCanvasElement | null) {
  if (!c) return
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (ctx) ctx.clearRect(0, 0, c.width, c.height)
}

function measureListWidth() {
  const el = outerWrapperRef.value
  listWidth.value = el?.offsetWidth || 600
}

async function renderThumbnailCanvas() {
  const canvas = thumbnailCanvasRef.value
  const pic = editCharacterPic.value
  if (!canvas || !pic?.img) return
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const image = pic.img
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
  if (enableLocalBrush.value && step.value === 1) {
    ctx.strokeStyle = 'black'
    ctx.strokeRect(
      mapCanvasX(pictureStore.localBrushX),
      mapCanvasY(pictureStore.localBrushY),
      mapCanvasWidth(pictureStore.localBrushSize),
      mapCanvasHeight(pictureStore.localBrushSize),
    )
  }
}

function renderBitMapCanvas() {
  const canvas = bitmapCanvasRef.value
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
  const canvas = contoursCanvasRef.value
  if (!canvas) return
  const components = contoursComponents.value.map((contourComponent: IComponent) => {
    const _c = R.clone(contourComponent)
    // 勿用 rgba(,,,0)：effectivePrimitiveFillColor 会把它当作描边色，导致轮廓不可见
    ;(_c.value as IPolygonComponent).fillColor = ''
    return _c
  })
  clearCanvasEl(canvas)
  await renderCanvas(components, canvas)
}

async function renderCurvesCanvas() {
  const canvas = curvesCanvasRef.value
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
  const c1 = previewCanvas1.value
  const c2 = previewCanvas2.value
  if (!c1 || !c2) return
  clearCanvasEl(c1)
  clearCanvasEl(c2)
  await renderCanvas(curvesComponents.value, c1)
  await renderCanvas(curvesComponents.value, c2, {
    fill: true,
    offset: { x: 0, y: 0 },
    scale: 1,
    forceUpdate: false,
  })
}

async function renderAll() {
  await renderPreviewCanvas()
  await renderThumbnailCanvas()
  renderBitMapCanvas()
  await renderContoursCanvas()
  await renderCurvesCanvas()
}

function moveLeft() {
  if (step.value === 1 && enableLocalBrush.value) {
    message.info(locale.value === 'zh' ? '编辑中，请确认后再查看' : 'In editing, try it later.')
    return
  }
  previewStatus.value =
    previewStatus.value <= 0 ? PIC_PREVIEW_SLIDE_COUNT - 1 : previewStatus.value - 1
}

function moveRight() {
  if (step.value === 1 && enableLocalBrush.value) {
    message.info(locale.value === 'zh' ? '编辑中，请确认后再查看' : 'In editing, try it later.')
    return
  }
  previewStatus.value =
    previewStatus.value >= PIC_PREVIEW_SLIDE_COUNT - 1 ? 0 : previewStatus.value + 1
}

function removePic() {
  const prev = pictureStore.prevEditStatus
  pictureStore.resetEditPic()
  editorStore.setEditStatus(prev ?? EditStatus.Edit)
}

function resetPic() {
  PictureImportPipelineService.reloadThumbnailDefaults(pictureStore)
}

async function confirmPic() {
  const prev = pictureStore.prevEditStatus
  const components = curvesComponents.value
  if (prev === EditStatus.Edit) {
    for (const c of components) {
      characterStore.addComponent(R.clone(c) as IComponent)
    }
    if (projectStore.selectedFile) projectStore.markFileUnsaved(projectStore.selectedFile.uuid)
    characterStore.characterListVersion++
  } else if (prev === EditStatus.Glyph) {
    for (const c of components) {
      glyphStore.addComponent(R.clone(c) as IComponent)
    }
    if (projectStore.selectedFile) projectStore.markFileUnsaved(projectStore.selectedFile.uuid)
    glyphStore.glyphListVersion++
  }
  editorStore.setEditStatus(prev ?? EditStatus.Edit)
  await nextTick()
  pictureStore.resetEditPic()
}

let brushDown = false

function applyBrushPatch() {
  const pic = editCharacterPic.value
  if (!pic?.thumbnailPixels || !pic.processPixels) return
  const w = pic.width
  const h = pic.height
  const lx = pictureStore.localBrushX
  const ly = pictureStore.localBrushY
  const sz = pictureStore.localBrushSize
  const pixels = toBlackWhiteBitMap(
    pic.thumbnailPixels,
    {
      r: pictureStore.localRThreshold,
      g: pictureStore.localGThreshold,
      b: pictureStore.localBThreshold,
    },
    { x: lx, y: ly, size: sz, width: w, height: h },
  )
  const proc = pic.processPixels
  for (let i = lx; i < lx + sz; i++) {
    for (let j = ly; j < ly + sz; j++) {
      if (i < 0 || j < 0 || i >= w || j >= h) continue
      const index = (j * w + i) * 4
      proc[index] = pixels[index]
      proc[index + 1] = pixels[index + 1]
      proc[index + 2] = pixels[index + 2]
      proc[index + 3] = pixels[index + 3]
    }
  }
  const procCopy = new Uint8ClampedArray(proc)
  pictureStore.setEditCharacterPic({ ...pic, processPixels: procCopy })
  pictureStore.setBitMap({ data: new Uint8ClampedArray(procCopy), width: w, height: h })
  PictureImportPipelineService.rebuildContoursAndCurves(pictureStore)
}

let docBrushMove: ((e: MouseEvent) => void) | null = null

function updateBrushFromEvent(e: MouseEvent) {
  if (!enableLocalBrush.value || step.value !== 1) return
  const canvas = thumbnailCanvasRef.value
  const pic = editCharacterPic.value
  if (!canvas || !pic) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
  pictureStore.localBrushX = Math.round((x * pic.width) / rect.width)
  pictureStore.localBrushY = Math.round((y * pic.height) / rect.height)
  if (brushDown) applyBrushPatch()
  void renderThumbnailCanvas()
}

function syncDocumentBrushListeners() {
  const arm = enableLocalBrush.value && step.value === 1
  if (arm) {
    if (!docBrushMove) {
      docBrushMove = (e: MouseEvent) => updateBrushFromEvent(e)
      document.addEventListener('mousemove', docBrushMove)
    }
  } else if (docBrushMove) {
    document.removeEventListener('mousemove', docBrushMove)
    docBrushMove = null
  }
}

function onThumbMouseDown() {
  if (!enableLocalBrush.value || step.value !== 1) return
  brushDown = true
  applyBrushPatch()
  window.addEventListener('mouseup', onBrushMouseUp)
}

function onBrushMouseUp() {
  brushDown = false
  window.removeEventListener('mouseup', onBrushMouseUp)
}

function updateCanvasLayout() {
  measureListWidth()
  const pic = editCharacterPic.value
  const f = file.value
  if (!pic || !f) return

  const wrapper = outerWrapperRef.value
  const listWrapperWidth = wrapper?.offsetWidth ?? 600
  const listWrapperHeight = wrapper?.offsetHeight ?? 400

  const charW = f.width
  const charH = f.height
  const picW = pic.width
  const picH = pic.height

  let charCanvasWidth = listWrapperWidth / 2 > charW ? charW : listWrapperWidth / 2
  let charCanvasHeight = (charCanvasWidth * charH) / charW
  if (charCanvasHeight > listWrapperHeight) {
    charCanvasHeight = listWrapperHeight
    charCanvasWidth = (charCanvasHeight * charW) / charH
  }

  let picCanvasWidth = listWrapperWidth / 2 > charW ? charW : listWrapperWidth / 2
  let picCanvasHeight = (picCanvasWidth * picH) / picW
  if (picCanvasHeight > listWrapperHeight) {
    picCanvasHeight = listWrapperHeight
    picCanvasWidth = (picCanvasHeight * picW) / picH
  }

  const setCharStyle = (el: HTMLCanvasElement | null) => {
    if (!el) return
    el.style.width = `${charCanvasWidth}px`
    el.style.height = `${charCanvasHeight}px`
  }
  setCharStyle(previewCanvas1.value)
  setCharStyle(previewCanvas2.value)
  setCharStyle(contoursCanvasRef.value)
  setCharStyle(curvesCanvasRef.value)

  const tc = thumbnailCanvasRef.value
  const bc = bitmapCanvasRef.value
  if (tc) {
    tc.width = mapCanvasWidth(picW)
    tc.height = mapCanvasHeight(picH)
    tc.style.width = `${picCanvasWidth}px`
    tc.style.height = `${picCanvasHeight}px`
  }
  if (bc) {
    bc.width = mapCanvasWidth(picW)
    bc.height = mapCanvasHeight(picH)
    bc.style.width = `${picCanvasWidth}px`
    bc.style.height = `${picCanvasHeight}px`
  }

  outerWrapperRef.value?.querySelectorAll('.canvas-wrapper').forEach((w) => {
    ;(w as HTMLElement).style.flex = `0 0 ${listWrapperWidth / 2}px`
    ;(w as HTMLElement).style.width = `${listWrapperWidth / 2}px`
  })
}

watch([enableLocalBrush, step], () => {
  syncDocumentBrushListeners()
})

onMounted(() => {
  measureListWidth()
  window.addEventListener('resize', onResize)
  syncDocumentBrushListeners()
  nextTick(() => {
    updateCanvasLayout()
    void renderAll()
  })
})

function onResize() {
  updateCanvasLayout()
  void renderAll()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mouseup', onBrushMouseUp)
  if (docBrushMove) {
    document.removeEventListener('mousemove', docBrushMove)
    docBrushMove = null
  }
})

watch(
  [editCharacterPic, bitmap, contoursComponents, curvesComponents],
  () => {
    nextTick(() => {
      updateCanvasLayout()
      void renderAll()
    })
  },
  { deep: true },
)

watch(
  [
    localBrushSize,
    localBrushX,
    localBrushY,
    localRThreshold,
    localGThreshold,
    localBThreshold,
  ],
  () => {
    void nextTick(() => void renderThumbnailCanvas())
  },
)
</script>

<template>
  <div v-if="editCharacterPic && file" class="picture-import-editor">
    <header class="top-bar">
      <n-button-group size="small" class="top-actions">
        <n-button @click="removePic">{{ t('panels.picEditPanel.remove') }}</n-button>
        <n-button @click="resetPic">{{ t('panels.picEditPanel.reset') }}</n-button>
        <n-button type="primary" @click="confirmPic">{{ t('panels.picEditPanel.confirm') }}</n-button>
      </n-button-group>
    </header>
    <main class="main">
      <div class="left-mover" @pointerdown="moveLeft">
        <font-awesome-icon :icon="['fas', 'chevron-left']" />
      </div>
      <div ref="outerWrapperRef" class="canvas-list-outer-wrapper">
        <div class="canvas-list-wrapper" :style="carouselStripStyle">
          <div class="canvas-wrapper">
            <canvas
              ref="previewCanvas1"
              class="preview canvas"
              :width="mapCanvasWidth(file.width)"
              :height="mapCanvasHeight(file.height)"
            />
          </div>
          <div class="canvas-wrapper">
            <canvas
              ref="thumbnailCanvasRef"
              class="thumbnail canvas"
              :width="mapCanvasWidth(editCharacterPic.width)"
              :height="mapCanvasHeight(editCharacterPic.height)"
              @mousedown="onThumbMouseDown"
            />
          </div>
          <div class="canvas-wrapper">
            <canvas
              ref="bitmapCanvasRef"
              class="bitmap canvas"
              :width="mapCanvasWidth(editCharacterPic.width)"
              :height="mapCanvasHeight(editCharacterPic.height)"
            />
          </div>
          <div class="canvas-wrapper">
            <canvas
              ref="contoursCanvasRef"
              class="contours canvas"
              :width="mapCanvasWidth(file.width)"
              :height="mapCanvasHeight(file.height)"
            />
          </div>
          <div class="canvas-wrapper">
            <canvas
              ref="curvesCanvasRef"
              class="curves canvas"
              :width="mapCanvasWidth(file.width)"
              :height="mapCanvasHeight(file.height)"
            />
          </div>
          <div class="canvas-wrapper">
            <canvas
              ref="previewCanvas2"
              class="preview canvas"
              :width="mapCanvasWidth(file.width)"
              :height="mapCanvasHeight(file.height)"
            />
          </div>
        </div>
      </div>
      <div class="right-mover" @pointerdown="moveRight">
        <font-awesome-icon :icon="['fas', 'chevron-right']" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.picture-import-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--n-color);
}
.top-bar {
  flex: 0 0 32px;
  position: relative;
  border-bottom: 1px solid var(--n-divider-color);
  background: var(--n-color);
  box-sizing: border-box;
}
.top-actions {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
}
.main {
  flex: 1;
  display: flex;
  min-height: 0;
  align-items: stretch;
}
.left-mover,
.right-mover {
  flex: 0 0 32px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  color: var(--n-text-color);
  background: #fff;
  border-right: 1px solid var(--n-divider-color);
}
.left-mover:hover,
.right-mover:hover {
  background: var(--n-color-hover);
}
.right-mover {
  border-right: none;
  border-left: 1px solid var(--n-divider-color);
}
.canvas-list-outer-wrapper {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  border-left: 1px solid var(--n-divider-color);
  border-right: 1px solid var(--n-divider-color);
  box-sizing: border-box;
}
.canvas-list-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  position: absolute;
  top: 0;
  height: 100%;
  transition: left 0.2s ease;
}
.canvas-wrapper {
  flex: 0 0 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-left: 1px solid var(--n-divider-color);
}
.canvas-wrapper:first-child {
  border-left: none;
}
.canvas {
  display: block;
  flex-shrink: 0;
  align-self: center;
  max-width: 100%;
  max-height: 100%;
  margin: auto;
}
</style>
