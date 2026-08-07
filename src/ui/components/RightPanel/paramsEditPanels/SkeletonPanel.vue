<template>
  <div class="skeleton-panel">
    <div class="panel-header">
      <span class="panel-title">{{ t('panels.skeletonPanel.title') }}</span>
    </div>

    <n-space vertical size="medium">
      <!-- 提取骨架按钮 -->
      <n-button
        type="primary"
        :loading="extracting"
        @click="handleExtract"
        @pointerup="handleExtract"
        block>
        <template #icon>
          <font-awesome-icon :icon="['fas', 'cubes']" />
        </template>
        {{ extracting ? t('panels.skeletonPanel.extracting') : t('panels.skeletonPanel.extract') }}
      </n-button>

      <n-alert v-if="errorMsg" type="error" :title="errorMsg" closable @close="errorMsg = ''" />

      <!-- 返回正常视图（调试模式下显示） -->
      <n-button v-if="debugViewMode" size="small" secondary @click="exitDebugView" @pointerup="exitDebugView">
        返回正常视图
      </n-button>

      <!-- 显示骨架开关 -->
      <n-space align="center" justify="space-between">
        <span>{{ t('panels.skeletonPanel.showSkeleton') }}</span>
        <n-switch v-model:value="showSkeleton" />
      </n-space>

      <n-divider style="margin: 4px 0" />

      <!-- ====== 调试按钮（日后删除） ====== -->
      <n-space vertical size="small">
        <n-button size="small" @click="handleDebugBitmap" @pointerup="handleDebugBitmap">
          显示骨架位图
        </n-button>
        <n-button size="small" @click="handleDebugTrace" @pointerup="handleDebugTrace">
          显示Tracing折线
        </n-button>
        <n-button size="small" @click="handleDebugMerged" @pointerup="handleDebugMerged">
          显示笔画合并
        </n-button>
      </n-space>
      <n-divider style="margin: 4px 0" />
      <!-- ====== 调试按钮结束 ====== -->

      <!-- 生成笔画组件 -->
      <n-space vertical size="small">
        <n-button size="small" type="primary" @click="handleGenerateComponents" @pointerup="handleGenerateComponents" :disabled="!skeleton?.strokes?.length">
          生成笔画组件
        </n-button>
        <n-button size="small" @click="handleRenderCharacter" @pointerup="handleRenderCharacter">
          渲染字符
        </n-button>
      </n-space>
      <n-divider style="margin: 4px 0" />

      <!-- 列表区域 -->
      <!-- 调试模式：折线/笔画列表 -->
      <div v-if="debugViewMode && debugList.length > 0" class="strokes-section">
        <div class="section-header">
          {{ debugViewMode === 'tracing' ? 'Tracing折线' : '合并笔画' }} ({{ debugList.length }})
        </div>
        <div
          v-for="(item, index) in debugList"
          :key="index"
          class="stroke-item"
          :class="{ selected: highlightIndex === index }"
          @click="selectDebugItem(index)">
          <span class="stroke-index">{{ index + 1 }}.</span>
          <span class="stroke-name">{{ item.label }}</span>
        </div>
      </div>

      <!-- 正常模式：笔画列表 -->
      <div v-else-if="skeleton && skeleton.strokes.length > 0" class="strokes-section">
        <div class="section-header">
          {{ t('panels.skeletonPanel.strokes') }} ({{ skeleton.strokes.length }})
        </div>
        <div
          v-for="(stroke, index) in skeleton.strokes"
          :key="index"
          class="stroke-item"
          :class="{ selected: selectedIndex === index }"
          @click="selectStroke(index)">
          <span class="stroke-index">{{ index + 1 }}.</span>
          <span class="stroke-name">{{ stroke.name }}</span>
        </div>
      </div>

      <n-empty v-else :description="t('panels.skeletonPanel.emptyHint')" size="small" />
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NButton, NSwitch, NAlert, NEmpty, NDivider } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import { extractSkeletonFromImageFile, getLastDebugData, type SkeletonDebugData } from '@/features/skeletonExtraction'
import { generateAndAddGlyphComponents } from '@/features/skeletonExtraction/generateComponents'
import { getEditorCanvas } from '@/features/editor/editCanvas'

const { t } = useI18n()
const characterStore = useCharacterStore()

const extracting = ref(false)
const errorMsg = ref('')
const _selRaw = localStorage.getItem('skeletonPanel.selectedIndex')
const selectedIndex = ref<number | null>(_selRaw != null ? parseInt(_selRaw) : null)
function selectStroke(index: number) {
  selectedIndex.value = index
  localStorage.setItem('skeletonPanel.selectedIndex', String(index))
  window.dispatchEvent(new CustomEvent('editor-skeleton-render'))
}
const debugData = ref<SkeletonDebugData | null>(null)

// 调试视图模式
const debugViewMode = ref<'bitmap' | 'tracing' | 'merged' | null>(null)
const highlightIndex = ref<number | null>(null)

// 调试列表项
interface DebugListItem { label: string }
const debugList = computed<DebugListItem[]>(() => {
  const data = getLastDebugData()
  if (!data) return []

  if (debugViewMode.value === 'tracing' && data.polylines) {
    return data.polylines.map((p, i) => ({
      label: `#${i} len=${p.length} (${p[0]?.[0] ?? 0},${p[0]?.[1] ?? 0})→(${p[p.length-1]?.[0] ?? 0},${p[p.length-1]?.[1] ?? 0})`,
    }))
  }
  if (debugViewMode.value === 'merged' && data.mergedPolylines) {
    return data.mergedPolylines.map((p, i) => ({
      label: `笔画${i + 1} len=${p.length} (${p[0]?.[0] ?? 0},${p[0]?.[1] ?? 0})→(${p[p.length-1]?.[0] ?? 0},${p[p.length-1]?.[1] ?? 0})`,
    }))
  }
  return []
})

const showSkeleton = ref(localStorage.getItem('skeletonPanel.showOverlay') === 'true')
watch(showSkeleton, (val) => {
  localStorage.setItem('skeletonPanel.showOverlay', String(val))
  window.dispatchEvent(new CustomEvent('editor-skeleton-render'))
})

const skeleton = computed(() => characterStore.editingCharacter?.skeleton || null)

const handleExtract = async () => {
  extracting.value = true
  errorMsg.value = ''
  debugViewMode.value = null

  try {
    const result = await extractSkeletonFromImageFile()
    debugData.value = getLastDebugData()

    if (!result || result.strokes.length === 0) {
      errorMsg.value = t('panels.skeletonPanel.noStrokesFound')
      return
    }

    if (characterStore.editingCharacter) {
      characterStore.editingCharacter.skeleton = result
      characterStore.editingCharacter = { ...characterStore.editingCharacter }
      window.dispatchEvent(new CustomEvent('editor-skeleton-render'))
    }

    if (import.meta.env.DEV) {
      console.log('[SkeletonPanel] ====== Skeleton Extraction Result ======')
      console.log('[SkeletonPanel] Total strokes:', result.strokes.length)
      result.strokes.forEach((s, i) => {
        console.log(`[SkeletonPanel] Stroke ${i + 1}: name="${s.name}" params=`, s.params, 'joints=', s.joints)
      })
      console.log('[SkeletonPanel] ====== End Skeleton Data ======')
    }
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
  } finally {
    extracting.value = false
  }
}

// ====== 生成组件 ======
function handleGenerateComponents() {
  generateAndAddGlyphComponents()
}
function handleRenderCharacter() {
  window.dispatchEvent(new CustomEvent('editor-skeleton-render'))
}

// ====== 调试视图 ======
function exitDebugView() {
  debugViewMode.value = null
  highlightIndex.value = null
  window.dispatchEvent(new CustomEvent('editor-skeleton-render'))
}

function selectDebugItem(index: number) {
  highlightIndex.value = index
  refreshDebugView()
}

function refreshDebugView() {
  const data = getLastDebugData()
  const canvas = getEditorCanvas()
  if (!canvas || !data) return

  if (debugViewMode.value === 'bitmap') {
    renderDebugBitmap(canvas, data)
  } else if (debugViewMode.value === 'tracing') {
    renderDebugPolylines(canvas, data.polylines, data.width, data.height, highlightIndex.value)
  } else if (debugViewMode.value === 'merged') {
    renderDebugPolylines(canvas, data.mergedPolylines || [], data.width, data.height, highlightIndex.value)
  }
}

function handleDebugBitmap() {
  const data = getLastDebugData()
  if (!data?.bitmap?.length) { errorMsg.value = '暂无骨架位图数据'; return }
  const canvas = getEditorCanvas()
  if (!canvas) { errorMsg.value = '无法获取编辑器Canvas'; return }
  errorMsg.value = ''
  debugViewMode.value = 'bitmap'
  highlightIndex.value = null
  renderDebugBitmap(canvas, data)
}

function handleDebugTrace() {
  const data = getLastDebugData()
  if (!data?.polylines?.length) { errorMsg.value = '暂无Tracing折线数据'; return }
  const canvas = getEditorCanvas()
  if (!canvas) { errorMsg.value = '无法获取编辑器Canvas'; return }
  errorMsg.value = ''
  debugViewMode.value = 'tracing'
  highlightIndex.value = null
  renderDebugPolylines(canvas, data.polylines, data.width, data.height, null)
}

function handleDebugMerged() {
  const data = getLastDebugData()
  if (!data?.mergedPolylines?.length) { errorMsg.value = '暂无笔画合并数据'; return }
  const canvas = getEditorCanvas()
  if (!canvas) { errorMsg.value = '无法获取编辑器Canvas'; return }
  errorMsg.value = ''
  debugViewMode.value = 'merged'
  highlightIndex.value = null
  renderDebugPolylines(canvas, data.mergedPolylines, data.width, data.height, null)
}

// ====== 渲染函数 ======
function renderDebugBitmap(canvas: HTMLCanvasElement, data: SkeletonDebugData) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const { bitmap, width, height } = data
  const scale = Math.min(canvas.width / width, canvas.height / height)

  const imageData = ctx.createImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    const val = bitmap[i] === 1 ? 0 : 255
    const off = i * 4
    imageData.data[off] = val; imageData.data[off + 1] = val
    imageData.data[off + 2] = val; imageData.data[off + 3] = 255
  }
  const offscreen = document.createElement('canvas')
  offscreen.width = width; offscreen.height = height
  offscreen.getContext('2d')!.putImageData(imageData, 0, 0)
  ctx.drawImage(offscreen, 0, 0, width * scale, height * scale)
}

function renderDebugPolylines(
  canvas: HTMLCanvasElement,
  polylines: Array<Array<[number, number]>>,
  srcW: number, srcH: number,
  highlightIdx: number | null,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const scale = Math.min(canvas.width / srcW, canvas.height / srcH)

  const colors = ['#FF0000','#00AA00','#0000FF','#FF8800','#8800FF',
    '#00AAAA','#FF00FF','#888800','#008888','#AA4444',
    '#FF4444','#44AA44','#4444FF','#FFAA00','#AA00FF']

  for (let p = 0; p < polylines.length; p++) {
    const poly = polylines[p]
    if (poly.length < 2) continue

    const isHighlight = highlightIdx !== null && highlightIdx === p
    ctx.strokeStyle = isHighlight ? '#FF0000' : colors[p % colors.length]
    ctx.lineWidth = isHighlight ? 3 : 1.5

    ctx.beginPath()
    ctx.moveTo(poly[0][0] * scale, poly[0][1] * scale)
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i][0] * scale, poly[i][1] * scale)
    }
    ctx.stroke()
  }
}

defineExpose({ showSkeleton })
</script>

<style scoped>
.skeleton-panel { padding: 12px; height: 100%; overflow-y: auto; }
.panel-header { margin-bottom: 12px; }
.panel-title { font-size: 14px; font-weight: 600; color: var(--primary-0); }
.strokes-section { margin-top: 8px; }
.section-header { font-size: 12px; color: var(--dark-4); margin-bottom: 6px; }
.stroke-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.stroke-item:hover { background: var(--primary-5); }
.stroke-item.selected { background: var(--primary-4); color: var(--primary-0); }
.stroke-index { color: var(--dark-4); min-width: 24px; flex-shrink: 0; }
.stroke-name { font-weight: 500; word-break: break-all; }
</style>
