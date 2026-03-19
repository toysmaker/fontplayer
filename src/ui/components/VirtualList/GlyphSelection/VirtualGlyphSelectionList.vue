<template>
  <div ref="containerRef" class="virtual-glyph-selection-list" @scroll="handleScroll">
    <div class="virtual-list-spacer" :style="{ height: `${totalHeight}px` }" />
    <div class="virtual-list-content" :style="{ transform: `translateY(${offsetY}px)` }">
      <div
        v-for="item in visibleItems"
        :key="item.uuid"
        :ref="(el) => setItemRef(el, item.uuid)"
        class="glyph-item"
        @click="handleSelect(item)"
        @pointerup="handleSelect(item)"
      >
        <GlyphItem :glyph="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ICustomGlyph } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import GlyphItem from '@/ui/components/VirtualList/GlyphList/GlyphItem.vue'
import { throttle } from '@/utils/performance'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { CanvasManager } from '@/core/canvas/CanvasManager'

const projectStore = useProjectStore()

const props = defineProps<{
  glyphType: 'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'
  overscan?: number
  itemHeight?: number
  itemWidth?: number
  gap?: number
  padding?: number
  visible?: boolean
}>()

const emit = defineEmits<{
  select: [glyph: ICustomGlyph]
}>()

const overscan = props.overscan ?? 2
const itemHeight = props.itemHeight ?? 112
const itemWidth = props.itemWidth ?? 86
const gap = props.gap ?? 10
const padding = props.padding ?? 10

const containerRef = ref<HTMLElement>()
const itemRefs = new Map<string, HTMLElement>()

const scrollTop = ref(0)
const containerHeight = ref(0)
const containerWidth = ref(0)

const glyphList = computed<ICustomGlyph[]>(() => {
  const f: any = projectStore.selectedFile
  if (!f) return []
  return (f[props.glyphType] || []) as ICustomGlyph[]
})

const colsPerRow = computed(() => {
  if (containerWidth.value <= 0) return 1
  const availableWidth = containerWidth.value - padding * 2
  const theoreticalCols = Math.ceil(availableWidth / (itemWidth + gap))
  return Math.max(1, theoreticalCols - 1)
})

const rowHeight = computed(() => itemHeight + gap)
const totalRows = computed(() => (glyphList.value.length ? Math.ceil(glyphList.value.length / colsPerRow.value) : 0))
const totalHeight = computed(() => {
  if (totalRows.value === 0) return padding * 2
  return totalRows.value * rowHeight.value - gap + padding * 2
})

const visibleRange = computed(() => {
  if (containerHeight.value <= 0 || containerWidth.value <= 0) {
    return { start: 0, end: Math.min(overscan * colsPerRow.value, glyphList.value.length) }
  }
  const startRow = Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - overscan)
  const endRow = Math.min(totalRows.value, Math.ceil((scrollTop.value + containerHeight.value) / rowHeight.value) + overscan)
  const start = Math.max(0, startRow * colsPerRow.value)
  const end = Math.min(glyphList.value.length, endRow * colsPerRow.value)
  return { start, end }
})

const offsetY = computed(() => {
  const startRow = Math.floor(visibleRange.value.start / colsPerRow.value)
  return startRow * rowHeight.value + padding
})

const visibleItems = ref<ICustomGlyph[]>([])

function setItemRef(el: any, uuid: string) {
  if (el) {
    const element = el instanceof HTMLElement ? el : (el.$el || el)
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

async function renderVisiblePreviews() {
  if (props.visible === false) return
  const fontSettings = projectStore.selectedFile?.fontSettings
  for (const g of visibleItems.value) {
    const uuid = g.uuid
    const el = itemRefs.get(uuid)
    if (!el) continue
    const canvas = CanvasManager.getCanvasFromDOM(uuid)
    if (!canvas) continue
    CanvasManager.registerCanvas(uuid, canvas)
    const canSkip = CanvasManager.canSkipRender(canvas, uuid)
    if (canSkip) continue
    await GlyphRenderer.renderPreview(canvas, g, fontSettings)
  }
}

watch(
  () => [visibleRange.value.start, visibleRange.value.end, glyphList.value.length, props.visible] as const,
  async () => {
    const { start, end } = visibleRange.value
    visibleItems.value = glyphList.value.slice(start, end)
    // 渲染延后到 DOM refs 稳定后
    requestAnimationFrame(() => {
      void renderVisiblePreviews()
    })
  },
  { immediate: true },
)

const handleScroll = throttle((e: Event) => {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}, 16)

function updateContainerSize() {
  const el = containerRef.value
  if (!el) return
  containerHeight.value = el.clientHeight
  containerWidth.value = el.clientWidth
}

onMounted(() => {
  updateContainerSize()
  window.addEventListener('resize', updateContainerSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerSize)
})
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
</style>

