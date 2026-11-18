<template>
  <div
    ref="containerRef"
    class="state-canvas"
    :class="{ preview: previewMode }"
    @dragover.prevent
    @drop="onDropFromSegmentList"
    @pointerdown.self="store.clearSelection()"
  >
    <!-- 连线层（SVG） -->
    <svg class="state-canvas-svg">
      <defs>
        <marker
          id="micro-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9a9a9a" />
        </marker>
      </defs>
      <TransitionEdge
        v-for="tr in transitions"
        :key="tr.id"
        :transition="tr"
        :x1="portX(tr.from, 'out')"
        :y1="portY(tr.from)"
        :x2="portX(tr.to, 'in')"
        :y2="portY(tr.to)"
        :selected="selectedTransitionId === tr.id"
        :summary="conditionSummary(tr)"
        @select="(id: string) => store.select({ kind: 'transition', id })"
      />
      <!-- 拖线预览 -->
      <path v-if="linkLine" class="link-preview" :d="linkLine" />
    </svg>

    <!-- 节点层 -->
    <StateNode
      v-for="state in states"
      :key="state.id"
      :state="state"
      :segment-name="segmentNameOf(state.segmentId)"
      :selected="selectedStateId === state.id"
      :preview-mode="previewMode"
      @select="(id: string) => store.select({ kind: 'state', id })"
      @move="(id, x, y) => store.updateState(id, { position: { x, y } })"
      @rename="(id, name) => store.updateState(id, { name })"
      @port-down="onPortDown"
    />

    <div v-if="states.length === 0 && !previewMode" class="state-canvas-hint">
      {{ t('dialogs.microInteraction.dragHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 状态画布：渲染状态节点与转换连线。
 * - 从左侧片段列表拖入 → 在释放点创建状态节点
 * - 从节点 out 端口拖出连线到另一节点 → 创建转换（空条件，右侧面板编辑）
 * - 节点可拖拽移动；连线随端口坐标实时更新
 */
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IMicroInteractionTransition } from '@/core/types'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { useAnimationStore } from '@/stores/animation'
import StateNode from './StateNode.vue'
import TransitionEdge from './TransitionEdge.vue'

const NODE_W = 150
const NODE_H = 64

const { t } = useI18n()
const store = useMicroInteractionStore()
const animationStore = useAnimationStore()

const containerRef = ref<HTMLElement | null>(null)
const linkLine = ref<string | null>(null)

const states = computed(() => store.draft?.states ?? [])
const transitions = computed(() => store.draft?.transitions ?? [])
const previewMode = computed(() => store.previewMode)
const selectedStateId = computed(() => (store.selected?.kind === 'state' ? store.selected.id : null))
const selectedTransitionId = computed(() => (store.selected?.kind === 'transition' ? store.selected.id : null))

function stateOf(id: string) {
  return states.value.find((s) => s.id === id) ?? null
}

function portX(stateId: string, port: 'in' | 'out'): number {
  const st = stateOf(stateId)
  if (!st) return 0
  return port === 'out' ? st.position.x + NODE_W : st.position.x
}
function portY(stateId: string): number {
  const st = stateOf(stateId)
  if (!st) return 0
  return st.position.y + NODE_H / 2
}

function segmentNameOf(segmentId: string): string {
  if (store.segments.length > 0) {
    return store.segments.find((s) => s.id === segmentId)?.name ?? ''
  }
  return animationStore.clips.find((c) => c.id === segmentId)?.name ?? ''
}

function conditionSummary(tr: IMicroInteractionTransition): string {
  if (tr.conditions.length === 0) return ''
  const inputName = (id: string) => store.draft?.inputs.find((i) => i.id === id)?.name ?? id
  return tr.conditions.map((c) => `${inputName(c.inputId)}${opSymbol(c.operator)}${c.value}`).join(' & ')
}

function opSymbol(op: string): string {
  switch (op) {
    case 'eq':
      return '='
    case 'neq':
      return '≠'
    case 'gt':
      return '>'
    case 'lt':
      return '<'
    default:
      return '?'
  }
}

// ---------------- 拖入片段创建状态 ----------------

function onDropFromSegmentList(e: DragEvent) {
  if (previewMode.value) return
  const segmentId = e.dataTransfer?.getData('application/x-fontplayer-segment')
  if (!segmentId) return
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  const x = e.clientX - rect.left - NODE_W / 2
  const y = e.clientY - rect.top - NODE_H / 2
  const seg =
    store.segments.length > 0
      ? store.segments.find((s) => s.id === segmentId)
      : animationStore.clips.find((c) => c.id === segmentId)
  if (!seg) return
  store.addState(seg.name, seg.id, { x: Math.max(0, x), y: Math.max(0, y) })
}

// ---------------- 端口拖线创建转换 ----------------

let linkSource: { stateId: string; port: 'in' | 'out' } | null = null
let linkCleanup: (() => void) | null = null

function onPortDown(stateId: string, port: 'in' | 'out', e: PointerEvent) {
  if (previewMode.value) return
  if (port !== 'out') {
    // 允许从 in 端口拖出反向连线
  }
  linkSource = { stateId, port: 'out' }
  const startX = portX(stateId, 'out')
  const startY = portY(stateId)
  const container = containerRef.value
  if (!container) return

  const onMove = (ev: PointerEvent) => {
    const rect = container.getBoundingClientRect()
    linkLine.value = `M ${startX} ${startY} C ${startX + 40} ${startY}, ${ev.clientX - rect.left - 40} ${ev.clientY - rect.top}, ${ev.clientX - rect.left} ${ev.clientY - rect.top}`
  }
  const onUp = (ev: PointerEvent) => {
    linkLine.value = null
    cleanup()
    const rect = container.getBoundingClientRect()
    const px = ev.clientX - rect.left
    const py = ev.clientY - rect.top
    const target = states.value.find((s) => {
      return (
        px >= s.position.x &&
        px <= s.position.x + NODE_W &&
        py >= s.position.y &&
        py <= s.position.y + NODE_H
      )
    })
    if (target && target.id !== stateId) {
      store.addTransition(stateId, target.id)
    }
    linkSource = null
  }
  const cleanup = () => {
    if (linkCleanup) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      linkCleanup = null
    }
  }
  linkCleanup = cleanup
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

onUnmounted(() => {
  linkCleanup?.()
})
</script>

<style scoped>
.state-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #f7f7fa;
  background-image: radial-gradient(circle, #d8d8e0 1px, transparent 1px);
  background-size: 18px 18px;
}
.state-canvas-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.state-canvas-svg :deep(.transition-edge) {
  pointer-events: auto;
}
.state-canvas-svg :deep(.link-preview) {
  fill: none;
  stroke: var(--primary-3);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}
.state-canvas-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 13px;
  pointer-events: none;
}
</style>
