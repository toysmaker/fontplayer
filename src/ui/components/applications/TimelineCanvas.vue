<template>
  <div ref="scrollRef" class="timeline-scroll">
    <div class="timeline-inner" :style="{ width: `${innerWidth}px`, height: `${innerHeight}px` }">
      <!-- 左侧轨道标签（sticky，横向滚动时固定，纵向跟随） -->
      <div class="timeline-gutter" :style="{ width: `${GUTTER_W}px`, height: `${innerHeight}px` }">
        <div class="gutter-spacer" :style="{ height: `${RULER_H}px` }"></div>
        <div v-for="track in tracks" :key="track.id" class="gutter-track" :style="{ height: `${TRACK_H}px` }">
          <span class="gutter-label">{{ track.label }}</span>
        </div>
      </div>
      <canvas
        ref="canvasRef"
        class="timeline-canvas"
        :width="timeWidth"
        :height="canvasHeight"
        @pointerdown="handlePointerDown"
        @dblclick="handleDoubleClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import type { IAppVideoDocument } from '@/features/applications/types'
import { clipDurationSeconds, videoTotalDuration } from '@/features/applications/video/videoData'

const RULER_H = 28
const TRACK_H = 48
const GUTTER_W = 140
const PX_PER_SEC_BASE = 50
/** WKWebView canvas 面积上限以内留余量：大秒数时自动降低像素密度，避免画布创建失败导致内容消失 */
const MAX_CANVAS_PIXELS = 8_000_000

const pxPerSec = computed(() => {
  const h = canvasHeight.value || 1
  const maxWidth = Math.max(400, Math.floor(MAX_CANVAS_PIXELS / h))
  const needed = Math.max(1, duration.value + 3)
  if (needed * PX_PER_SEC_BASE + 160 <= maxWidth) return PX_PER_SEC_BASE
  return Math.max(2, Math.floor((maxWidth - 160) / needed))
})

const props = defineProps<{
  video: IAppVideoDocument
  currentTime: number
}>()

const emit = defineEmits<{
  seek: [time: number]
  selectClip: [clipId: string | null]
  /** 双击剪辑块：弹出设置输入框（编辑起始秒数） */
  editClip: [clipId: string]
}>()

const scrollRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scrollViewW = ref(800)
const scrollViewH = ref(400)

const tracks = computed(() => props.video.tracks)
const duration = ref(1)

const timeWidth = computed(() =>
  Math.max(Math.ceil(duration.value * pxPerSec.value) + 160, scrollViewW.value - GUTTER_W)
)
/** 内容高度与面板高度取较大者：轨道标签列（gutter）始终填满整个轨道面板 */
const contentHeight = computed(() => RULER_H + tracks.value.length * TRACK_H)
const canvasHeight = computed(() => Math.max(contentHeight.value, scrollViewH.value))
const innerWidth = computed(() => GUTTER_W + timeWidth.value)
const innerHeight = computed(() => Math.max(contentHeight.value, scrollViewH.value))

// ---- 绘制 ----

const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]

function pickTick(): number {
  for (const step of TICK_STEPS) {
    if (step * pxPerSec.value >= 60) return step
  }
  return 60
}

function clipName(clipId: string): string {
  const s = props.video.snapshots.find((snap) => snap.clipId === clipId)
  return s?.clip.name ?? clipId.slice(0, 8)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  // 尺寸直接在绘制时设置：首条轨道插入时 watcher 先于 :width/:height 属性补丁执行，
  // 若依赖属性绑定，画布仍是 0 轨时的 28px 高，轨道与剪辑块全部画在画布外。
  if (canvas.width !== timeWidth.value) canvas.width = timeWidth.value
  if (canvas.height !== canvasHeight.value) canvas.height = canvasHeight.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 时间标尺
  ctx.fillStyle = '#22262d'
  ctx.fillRect(0, 0, canvas.width, RULER_H)
  ctx.strokeStyle = '#3a3f49'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, RULER_H - 1)

  const tick = pickTick()
  ctx.fillStyle = '#9aa3b2'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let sec = 0; sec <= duration.value + tick; sec += tick) {
    const x = Math.round(sec * pxPerSec.value) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, RULER_H - 8)
    ctx.lineTo(x, RULER_H)
    ctx.strokeStyle = '#556'
    ctx.stroke()
    ctx.fillText(`${sec.toFixed(tick < 1 ? 1 : 0)}s`, x + 4, 4)
  }

  // 轨道泳道与剪辑块
  tracks.value.forEach((track, index) => {
    const laneY = RULER_H + index * TRACK_H
    ctx.fillStyle = index % 2 === 0 ? '#1a1d23' : '#171a20'
    ctx.fillRect(0, laneY, canvas.width, TRACK_H)
    ctx.strokeStyle = '#2c3038'
    ctx.beginPath()
    ctx.moveTo(0, laneY + 0.5)
    ctx.lineTo(canvas.width, laneY + 0.5)
    ctx.stroke()

    for (const placed of track.clips) {
      const snap = props.video.snapshots.find(
        (s) => s.charUuid === track.charUuid && s.clipId === placed.clipId
      )
      const dur = snap ? clipDurationSeconds(snap.clip) : 1
      const x = placed.startTime * pxPerSec.value
      const w = Math.max(dur * pxPerSec.value, 8)
      const y = laneY + 6
      const h = TRACK_H - 12
      ctx.fillStyle = selectedClipId.value === placed.id ? '#5b8dd9' : '#3d6db5'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#1c2f52'
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      ctx.fillStyle = '#fff'
      ctx.font = '11px sans-serif'
      ctx.textBaseline = 'top'
      const label = clipName(placed.clipId)
      const maxW = w - 10
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 5, y + 4, Math.max(maxW, 0), h - 8)
      ctx.clip()
      ctx.fillText(label, x + 6, y + 5)
      ctx.restore()
    }
  })

  // 播放头
  const px = Math.max(0, Math.min(props.currentTime, duration.value)) * pxPerSec.value
  ctx.strokeStyle = '#e05252'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px + 0.5, 0)
  ctx.lineTo(px + 0.5, canvas.height)
  ctx.stroke()
  ctx.fillStyle = '#e05252'
  ctx.beginPath()
  ctx.moveTo(px - 4, 0)
  ctx.lineTo(px + 5, 0)
  ctx.lineTo(px + 0.5, 8)
  ctx.closePath()
  ctx.fill()
}

const selectedClipId = ref<string | null>(null)

// watchEffect：显式读遍全部依赖（轨道/剪辑/快照/时长/播放头），
// 每次运行重新收集依赖，任何剪辑位置/时间变化都会触发重绘
watchEffect(() => {
  for (const track of props.video.tracks) {
    void track.charUuid
    void track.layoutPosition?.x
    void track.layoutPosition?.y
    void track.layoutPosition?.fontSize
    for (const placed of track.clips) {
      void placed.startTime
      void placed.clipId
    }
  }
  for (const snap of props.video.snapshots) {
    void snap.clipId
    void snap.charUuid
    void snap.clip?.keyframes?.length
  }
  void props.currentTime
  duration.value = videoTotalDuration(props.video)
  draw()
})

// ---- 兜底重绘：200ms 指纹轮询（修复个别场景下依赖收集失效导致的时间轴不刷新） ----
let pollTimer = 0
let lastFingerprint = ''

function fingerprint(): string {
  return JSON.stringify(
    props.video.tracks.map((t) => ({
      c: t.clips.map((c) => [c.id, c.startTime, c.clipId]),
    }))
  )
}

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(() => {
    const d = videoTotalDuration(props.video)
    if (d !== duration.value) duration.value = d
    const fp = fingerprint()
    if (fp !== lastFingerprint) {
      lastFingerprint = fp
      draw()
    }
  }, 200)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = 0
  }
}

// ---- 交互 ----

interface DragState {
  mode: 'clip' | 'seek'
  clipId?: string
  offsetSec: number
}

let drag: DragState | null = null

function eventToPos(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const canvas = canvasRef.value
  const rect = canvas?.getBoundingClientRect()
  if (!canvas || !rect) return { x: 0, y: 0 }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

function hitClip(x: number, y: number): { trackIndex: number; clipId: string } | null {
  const laneIndex = Math.floor((y - RULER_H) / TRACK_H)
  if (laneIndex < 0 || laneIndex >= tracks.value.length) return null
  const track = tracks.value[laneIndex]
  for (const placed of track.clips) {
    const snap = props.video.snapshots.find(
      (s) => s.charUuid === track.charUuid && s.clipId === placed.clipId
    )
    const dur = snap ? clipDurationSeconds(snap.clip) : 1
    const cx = placed.startTime * pxPerSec.value
    const cw = Math.max(dur * pxPerSec.value, 8)
    if (x >= cx && x <= cx + cw && y >= RULER_H + laneIndex * TRACK_H + 2 &&
        y <= RULER_H + (laneIndex + 1) * TRACK_H - 2) {
      return { trackIndex: laneIndex, clipId: placed.id }
    }
  }
  return null
}

function handlePointerDown(e: PointerEvent) {
  const pos = eventToPos(e)
  const time = Math.max(0, pos.x / pxPerSec.value)
  if (pos.y < RULER_H) {
    drag = { mode: 'seek', offsetSec: 0 }
    emit('seek', time)
    return
  }
  const hit = hitClip(pos.x, pos.y)
  if (hit) {
    selectedClipId.value = hit.clipId
    emit('selectClip', hit.clipId)
    const track = tracks.value[hit.trackIndex]
    const placed = track.clips.find((c) => c.id === hit.clipId)
    drag = {
      mode: 'clip',
      clipId: hit.clipId,
      offsetSec: time - (placed?.startTime ?? 0),
    }
  } else {
    selectedClipId.value = null
    emit('selectClip', null)
    drag = { mode: 'seek', offsetSec: 0 }
    emit('seek', time)
  }
  draw()
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function handlePointerMove(e: PointerEvent) {
  if (!drag) return
  const pos = eventToPos(e)
  const time = Math.max(0, pos.x / pxPerSec.value)
  if (drag.mode === 'seek') {
    emit('seek', time)
  } else if (drag.mode === 'clip' && drag.clipId) {
    const track = props.video.tracks.find((t) => t.clips.some((c) => c.id === drag!.clipId))
    const placed = track?.clips.find((c) => c.id === drag.clipId)
    if (placed) {
      placed.startTime = Math.max(0, Math.round((time - drag.offsetSec) * 10) / 10)
      draw()
    }
  }
}

function handlePointerUp() {
  drag = null
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}

function handleDoubleClick(e: MouseEvent) {
  const pos = eventToPos(e)
  const hit = hitClip(pos.x, pos.y)
  if (!hit) return
  selectedClipId.value = hit.clipId
  emit('selectClip', hit.clipId)
  emit('editClip', hit.clipId)
}

// 播放时保持播放头可见
let lastVisibleSec = -1
function keepPlayheadVisible() {
  const el = scrollRef.value
  if (!el) return
  const px = props.currentTime * pxPerSec.value
  const left = el.scrollLeft
  const right = left + el.clientWidth - GUTTER_W - 40
  if (px < left || px > right) {
    if (Math.abs(props.currentTime - lastVisibleSec) > 0.4) {
      el.scrollLeft = Math.max(0, px - 40)
      lastVisibleSec = props.currentTime
    }
  }
}
watch(() => props.currentTime, keepPlayheadVisible)

onMounted(() => {
  startPolling()
  const el = scrollRef.value
  if (el) {
    scrollViewW.value = el.clientWidth
    scrollViewH.value = el.clientHeight
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        scrollViewW.value = rect.width
        scrollViewH.value = rect.height
      }
    })
    observer.observe(el)
    ;(el as any).__tlResizeObserver = observer
  }
  draw()
})

onUnmounted(() => {
  stopPolling()
  const el = scrollRef.value
  if (el && (el as any).__tlResizeObserver) {
    ;(el as any).__tlResizeObserver.disconnect()
  }
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
})
</script>

<style scoped>
.timeline-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  background: #14161a;
}

.timeline-inner {
  display: flex;
  align-items: flex-start;
}

.timeline-gutter {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #1e2127;
  border-right: 1px solid #3a3f49;
  flex-shrink: 0;
}

.gutter-spacer {
  border-bottom: 1px solid #3a3f49;
}

.gutter-track {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-bottom: 1px solid #2c3038;
  box-sizing: border-box;
  overflow: hidden;
}

.gutter-label {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-canvas {
  display: block;
  flex-shrink: 0;
  cursor: crosshair;
}
</style>
