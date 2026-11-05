<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="tm('dialogs.randomStrokeDialog.title')"
    class="random-stroke-dialog"
    :style="{ width: '460px' }"
  >
    <n-form :model="formData" label-placement="left" label-width="100">
      <n-form-item :label="tm('dialogs.randomStrokeDialog.styleName')">
        <n-input
          v-model:value="formData.styleName"
          :maxlength="50"
          :placeholder="tm('dialogs.randomStrokeDialog.styleNamePlaceholder')"
          :disabled="generating"
        />
      </n-form-item>
    </n-form>
    <div class="canvas-wrapper">
      <canvas
        ref="canvasRef"
        class="pentagon-canvas"
        :width="CANVAS_SIZE * dpr"
        :height="CANVAS_SIZE * dpr"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
    </div>
    <div class="tip">{{ t('dialogs.randomStrokeDialog.weightsTip') }}</div>
    <div v-if="generating" class="progress-row">
      <template v-if="phase === 'inference'">
        <n-spin size="small" />
        <span class="progress-text wide">{{ t('dialogs.randomStrokeDialog.runningModel') }}</span>
      </template>
      <template v-else>
        <n-progress type="line" :percentage="progress" :height="10" />
        <span class="progress-text">{{ progress }}%</span>
      </template>
    </div>
    <template #action>
      <div class="dialog-footer">
        <n-button :disabled="generating" @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.randomStrokeDialog.cancel') }}
        </n-button>
        <n-button type="primary" :disabled="generating" @click="handleConfirm" @pointerup="handleConfirm">
          {{ generating ? t('dialogs.randomStrokeDialog.generating') : t('dialogs.randomStrokeDialog.generate') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NProgress, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { getCSSVariable } from '@/utils/theme'
import { generateStrokeGlyphs } from '@/features/aiGeneration/strokeGeneration'

const { t, tm } = useI18n()
const message = useMessage()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const formData = ref({
  styleName: '',
})

const generating = ref(false)
const progress = ref(0)
const phase = ref<'inference' | 'processing'>('inference')

// ── 五边形画布 ────────────────────────────────────────
// 五角顺序与模型 STYLE_ORDER 一致: 黑/宋/楷/仿/隶, 从顶部起顺时针
const STYLE_LABELS = ['黑', '宋', '楷', '仿', '隶']
const CANVAS_SIZE = 340
const dpr = Math.max(1, window.devicePixelRatio || 1)

/** 权重 [0,1]: 0=随机按钮边缘 (不采用该风格), 1=角 (完全采用) */
const weights = ref<number[]>([0.2, 0.2, 0.2, 0.2, 0.2])
const randomMode = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let dragging: number | null = null

const CORNER_R = CANVAS_SIZE / 2 - 62
const BTN_R = 24

function cornerPos(i: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
  const cx = CANVAS_SIZE / 2
  const cy = CANVAS_SIZE / 2
  return { x: cx + CORNER_R * Math.cos(angle), y: cy + CORNER_R * Math.sin(angle) }
}

/** 权重值 → 圆点位置: 0=按钮边缘, 1=角 (仅 [0,1]) */
function dotPos(i: number, v: number): { x: number; y: number } {
  const p = cornerPos(i)
  const cx = CANVAS_SIZE / 2
  const cy = CANVAS_SIZE / 2
  const dist = BTN_R + Math.max(0, Math.min(1, v)) * (CORNER_R - BTN_R)
  const dx = (p.x - cx) / CORNER_R
  const dy = (p.y - cy) / CORNER_R
  return { x: cx + dx * dist, y: cy + dy * dist }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  const cx = CANVAS_SIZE / 2
  const cy = CANVAS_SIZE / 2

  // 连线 (角 → 中心)
  ctx.strokeStyle = '#c0c4cc'
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const p = cornerPos(i)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  // 五边形边框
  ctx.strokeStyle = '#dcdfe6'
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const p = cornerPos(i)
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.stroke()

  // 角标签 黑/宋/楷/仿/隶
  ctx.fillStyle = '#606266'
  ctx.font = '16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < 5; i++) {
    const p = cornerPos(i)
    const lx = cx + (p.x - cx) * 1.28
    const ly = cy + (p.y - cy) * 1.28
    ctx.fillText(STYLE_LABELS[i], lx, ly)
  }

  // 中心圆形按钮 "随机"
  ctx.fillStyle = randomMode.value ? '#2080f0' : '#ffffff'
  ctx.strokeStyle = randomMode.value ? '#2080f0' : '#dcdfe6'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, BTN_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = randomMode.value ? '#ffffff' : '#606266'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t('dialogs.randomStrokeDialog.random'), cx, cy)

  // 权重圆点 (随机模式下隐藏; 绘制在按钮之后, 避免被遮挡)
  if (!randomMode.value) {
    for (let i = 0; i < 5; i++) {
      const v = weights.value[i] ?? 0
      const { x, y } = dotPos(i, v)
      ctx.fillStyle = getCSSVariable('--primary-0', '#153063')
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
      // 数值
      ctx.fillStyle = '#909399'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(v.toFixed(2), x + 10, y - 6)
    }
  }
}

function eventPos(e: PointerEvent): { x: number; y: number } {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDown(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.setPointerCapture(e.pointerId)
  const { x, y } = eventPos(e)
  const cx = CANVAS_SIZE / 2
  const cy = CANVAS_SIZE / 2

  // 优先命中权重圆点 (圆点绘制在按钮之上)
  if (!randomMode.value) {
    for (let i = 0; i < 5; i++) {
      const v = weights.value[i] ?? 0
      const { x: dxv, y: dyv } = dotPos(i, v)
      if (Math.hypot(x - dxv, y - dyv) <= 12) {
        dragging = i
        draw()
        return
      }
    }
  }

  // 中心按钮: 切换随机模式
  if (Math.hypot(x - cx, y - cy) <= BTN_R + 4) {
    randomMode.value = !randomMode.value
    draw()
    return
  }
}

function onPointerMove(e: PointerEvent) {
  if (dragging === null) return
  const { x, y } = eventPos(e)
  const cx = CANVAS_SIZE / 2
  const cy = CANVAS_SIZE / 2
  const p = cornerPos(dragging)
  const dx = p.x - cx
  const dy = p.y - cy
  // 点在 中心→角 方向上的投影距离 → 反解权重 (0=按钮边缘, 1=角)
  const proj = ((x - cx) * dx + (y - cy) * dy) / Math.hypot(dx, dy)
  const v = (proj - BTN_R) / (CORNER_R - BTN_R)
  weights.value[dragging] = Math.round(Math.max(0, Math.min(1, v)) * 100) / 100
  draw()
}

function onPointerUp() {
  if (dragging !== null) {
    dragging = null
    draw()
  }
}

watch([weights, randomMode], () => {
  draw()
})

// n-modal 懒渲染: 打开时 canvas 才挂载, 需要重绘
watch(visible, (v) => {
  if (v) {
    nextTick(() => {
      draw()
    })
  }
})

onMounted(() => {
  draw()
})

// ── 生成 ──────────────────────────────────────────────

const resetForm = () => {
  formData.value.styleName = ''
  randomMode.value = false
  weights.value = [0.2, 0.2, 0.2, 0.2, 0.2]
  progress.value = 0
  phase.value = 'inference'
}

const _handleConfirm = async () => {
  if (generating.value) return
  if (!randomMode.value && weights.value.every((w) => Math.abs(w) < 1e-6)) {
    message.warning(t('dialogs.randomStrokeDialog.allZeroTip'))
    return
  }
  generating.value = true
  progress.value = 0
  phase.value = 'inference'
  try {
    const count = await generateStrokeGlyphs({
      styleName: formData.value.styleName,
      weights: [...weights.value],
      randomMode: randomMode.value,
      onProgress: (done, total) => {
        progress.value = Math.round((done / total) * 100)
      },
      onPhase: (p) => {
        phase.value = p
      },
    })
    message.success(t('dialogs.randomStrokeDialog.success', { count }))
    resetForm()
    visible.value = false
  } catch (e: any) {
    if (import.meta.env.DEV) {
      console.error('[aiGeneration] 笔画生成失败:', e)
    }
    const detail = e?.message ? `：${e.message}` : ''
    message.error(t('dialogs.randomStrokeDialog.failed') + detail)
  } finally {
    generating.value = false
  }
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'RandomStrokeDialog.confirm')

const _handleCancel = () => {
  resetForm()
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'RandomStrokeDialog.cancel')
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
}

.pentagon-canvas {
  display: block;
  width: 340px;
  height: 340px;
  cursor: pointer;
}

.tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 6px;
  text-align: center;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.progress-row :deep(.n-progress) {
  flex: 1;
}

.progress-text {
  font-size: 12px;
  color: #606266;
  min-width: 36px;
  text-align: right;
}

.progress-text.wide {
  min-width: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
