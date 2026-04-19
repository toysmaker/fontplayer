<template>
  <div ref="containerRef" class="virtual-glyph-selection-list" @scroll="handleScroll">
    <div class="virtual-list-spacer" :style="{ height: `${totalHeight}px` }" />
    <div
      ref="gridContentRef"
      class="virtual-list-content"
      :style="{ transform: `translateY(${offsetY}px)` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.uuid"
        :ref="(el) => setItemRef(el, item.uuid)"
        class="glyph-item"
        @click="handleSelect(item)"
        @pointerup="handleSelect(item)"
      >
        <GlyphItem :glyph="item" :defer-preview-to-parent="true" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import type { ICustomGlyph } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import GlyphItem from '@/ui/components/VirtualList/GlyphList/GlyphItem.vue'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { CanvasManager } from '@/core/canvas/CanvasManager'
import {
  columnsFromTrackInnerWidth,
  readGridTrackInnerWidth,
  fallbackTrackInnerWidthFromScrollContainer,
} from '@/ui/components/VirtualList/virtualGridLayout'
import { isTauri } from '@/utils/env'

const projectStore = useProjectStore()

const props = defineProps<{
  glyphType: 'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'
  overscan?: number
  itemHeight?: number
  itemWidth?: number
  /** 须与 .virtual-list-content 的 row-gap / column-gap 一致 */
  gridGap?: number
  /** 须与 .virtual-list-content 的 padding-top 一致 */
  padTop?: number
  /** 须与 .virtual-list-content 的 padding-bottom 一致 */
  padBottom?: number
  visible?: boolean
}>()

const emit = defineEmits<{
  select: [glyph: ICustomGlyph]
}>()

const overscan = props.overscan ?? 2
const itemHeight = props.itemHeight ?? 112
const itemWidth = props.itemWidth ?? 86
/** 与 scoped CSS 中 row-gap / column-gap 一致 */
const gridGap = props.gridGap ?? 8
const padTop = props.padTop ?? 8
const padBottom = props.padBottom ?? 8

const containerRef = ref<HTMLElement>()
const gridContentRef = ref<HTMLElement>()
const itemRefs = new Map<string, HTMLElement>()

const scrollTop = ref(0)
const containerHeight = ref(0)
const containerWidth = ref(0)
/** 实测网格 track 宽度，避免与 repeat(auto-fill) 列数不一致 */
const gridTrackInnerWidth = ref(0)

/** .virtual-list-content 左右 padding 12+12，与 scoped CSS 一致 */
const GRID_CONTENT_PAD_X = 24

/**
 * grid 未测到宽度（弹窗刚打开、v-show、Tauri 首帧）时若列数退化为 1，offsetY 会从第 32 项起整片错位
 */
const effectiveTrackWidth = computed(() => {
  let w = gridTrackInnerWidth.value
  if (w <= 0 && containerWidth.value > 0) {
    w = fallbackTrackInnerWidthFromScrollContainer(containerWidth.value, GRID_CONTENT_PAD_X)
  }
  if (w <= 0) return 320
  return w
})

const glyphList = computed<ICustomGlyph[]>(() => {
  const f: any = projectStore.selectedFile
  if (!f) return []
  return (f[props.glyphType] || []) as ICustomGlyph[]
})

const rowHeight = computed(() => itemHeight + gridGap)

const colsPerRow = computed(() =>
  columnsFromTrackInnerWidth(effectiveTrackWidth.value, itemWidth, gridGap)
)

const gridRowCount = computed(() => {
  const n = glyphList.value.length
  if (!n) return 0
  return Math.ceil(n / colsPerRow.value)
})

const totalHeight = computed(() => {
  const rows = gridRowCount.value
  if (!rows) return padTop + padBottom
  return rows * rowHeight.value - gridGap + padTop + padBottom
})

const visibleRange = computed(() => {
  if (containerHeight.value <= 0 || effectiveTrackWidth.value <= 0) {
    return { start: 0, end: Math.min(overscan * colsPerRow.value, glyphList.value.length) }
  }
  const startRow = Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - overscan)
  const endRow = Math.min(
    gridRowCount.value,
    Math.ceil((scrollTop.value + containerHeight.value) / rowHeight.value) + overscan
  )
  const start = Math.max(0, startRow * colsPerRow.value)
  const end = Math.min(glyphList.value.length, endRow * colsPerRow.value)
  return { start, end }
})

const offsetY = computed(() => {
  const startRow = Math.floor(visibleRange.value.start / colsPerRow.value)
  return startRow * rowHeight.value + padTop
})

const visibleItems = ref<ICustomGlyph[]>([])

function setItemRef(el: any, uuid: string) {
  if (el) {
    const element = el instanceof HTMLElement ? el : (el as any).$el
    if (element instanceof HTMLElement) itemRefs.set(uuid, element)
  } else {
    itemRefs.delete(uuid)
  }
}

const handleSelect = createDebouncedHandler(
  (g: ICustomGlyph) => emit('select', g),
  'VirtualGlyphSelectionList.select',
  (args) => args[0]?.uuid
)

function getCanvasInItemWrapper(uuid: string): HTMLCanvasElement | null {
  const wrap = itemRefs.get(uuid)
  if (!wrap) return null
  // 必须与 document 级 query 区分：侧栏 VirtualGlyphList 与弹窗内同 UUID 的 canvas 并存时，
  // getCanvasFromDOM 会命中第一个（常为侧栏），导致弹窗格子空白。
  const c = wrap.querySelector(`canvas[data-uuid="${uuid}"]`) as HTMLCanvasElement | null
  return c ?? (wrap.querySelector('canvas.preview-canvas') as HTMLCanvasElement | null)
}

/** 滚动/可见范围快速变化时取消过期的异步渲染，避免旧批次覆盖新可见格 */
let previewGeneration = 0

async function renderVisiblePreviews() {
  if (props.visible === false) return
  const gen = ++previewGeneration
  const fontSettings = projectStore.selectedFile?.fontSettings
  if (!projectStore.selectedFile) return

  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  if (gen !== previewGeneration) return

  for (const g of visibleItems.value) {
    if (gen !== previewGeneration) return
    const uuid = g.uuid
    const canvas = getCanvasInItemWrapper(uuid)
    if (!canvas) continue
    CanvasManager.registerCanvas(uuid, canvas)
    const hasPixels = CanvasManager.hasContent(canvas)
    const skip = CanvasManager.canSkipRender(canvas, uuid) && hasPixels
    if (skip) continue
    await GlyphRenderer.renderPreview(canvas, g, fontSettings)
  }

  // Tauri/WKWebView：偶发首帧 draw 未合成到缩略图，对仍空白的格强制重画一次
  if (isTauri() && gen === previewGeneration) {
    await new Promise<void>((r) => setTimeout(r, 50))
    if (gen !== previewGeneration) return
    const needRetry = visibleItems.value.filter((g) => {
      const c = getCanvasInItemWrapper(g.uuid)
      return c && !CanvasManager.hasContent(c)
    })
    if (needRetry.length === 0) return
    for (const g of needRetry) {
      if (gen !== previewGeneration) return
      const canvas = getCanvasInItemWrapper(g.uuid)
      if (!canvas) continue
      CanvasManager.invalidateCache(g.uuid)
      CanvasManager.clearCanvasMark(canvas)
      CanvasManager.registerCanvas(g.uuid, canvas)
      await GlyphRenderer.renderPreview(canvas, g, fontSettings)
    }
  }
}

function measureLayout() {
  const c = containerRef.value
  if (c) {
    containerHeight.value = c.clientHeight
    containerWidth.value = c.clientWidth
  }
  const g = gridContentRef.value
  if (g) {
    gridTrackInnerWidth.value = readGridTrackInnerWidth(g)
  }
}

watch(
  () => [visibleRange.value.start, visibleRange.value.end, glyphList.value.length, props.visible] as const,
  async () => {
    const { start, end } = visibleRange.value
    visibleItems.value = glyphList.value.slice(start, end)
    void renderVisiblePreviews()
  },
  { immediate: true },
)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      void nextTick(() => {
        measureLayout()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            measureLayout()
            void renderVisiblePreviews()
          })
        })
      })
    }
  },
)

let scrollRaf: number | null = null
const handleScroll = (e: Event) => {
  const t = e.target as HTMLElement
  if (scrollRaf != null) cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null
    scrollTop.value = t.scrollTop
  })
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('resize', measureLayout)

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureLayout())
    if (containerRef.value) resizeObserver.observe(containerRef.value)
  }

  void nextTick(() => {
    if (resizeObserver && gridContentRef.value) {
      resizeObserver.observe(gridContentRef.value)
    }
    measureLayout()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', measureLayout)
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => gridContentRef.value,
  (el) => {
    if (el && resizeObserver) {
      resizeObserver.observe(el)
      measureLayout()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.virtual-glyph-selection-list {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
}
.virtual-list-spacer {
  width: 100%;
}
.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, 86px);
  justify-content: flex-start;
  row-gap: 8px;
  column-gap: 8px;
  padding: 8px 12px 8px 12px;
  box-sizing: border-box;
}
.glyph-item {
  cursor: pointer;
}

/* WKWebView：父级 translateY 虚拟滚动时，子 canvas 偶发不合成；轻触发展开合成层减轻空白缩略图 */
:deep(.preview-canvas) {
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
}
</style>
