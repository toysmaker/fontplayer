<template>
  <g class="transition-edge" :class="{ selected }" @click.stop="emit('select', transition.id)">
    <path class="edge-hit" :d="pathD" />
    <path class="edge-line" :d="pathD" />
    <text class="edge-label" :x="midX" :y="midY">{{ summary || '∅' }}</text>
  </g>
</template>

<script setup lang="ts">
/**
 * 转换连线：三次贝塞尔路径 + 箭头 + 条件摘要。
 * 路径计算：从源节点右端口到目标节点左端口，控制点水平外扩 40px，
 * 使连线在节点间形成平滑的横向 S 曲线。
 */
import { computed } from 'vue'
import type { IMicroInteractionTransition } from '@/core/types'

const props = defineProps<{
  transition: IMicroInteractionTransition
  x1: number
  y1: number
  x2: number
  y2: number
  selected: boolean
  summary: string
}>()

const emit = defineEmits<{ select: [id: string] }>()

const pathD = computed(() => {
  const c1x = props.x1 + 40
  const c2x = props.x2 - 40
  return `M ${props.x1} ${props.y1} C ${c1x} ${props.y1}, ${c2x} ${props.y2}, ${props.x2} ${props.y2}`
})

const midX = computed(() => (props.x1 + props.x2) / 2)
const midY = computed(() => (props.y1 + props.y2) / 2)
</script>

<style scoped>
.edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 14;
  cursor: pointer;
}
.edge-line {
  fill: none;
  stroke: #9a9a9a;
  stroke-width: 2;
  marker-end: url(#micro-arrow);
}
.transition-edge.selected .edge-line {
  stroke: var(--primary-3);
  stroke-width: 3;
}
.edge-label {
  font-size: 11px;
  fill: #444;
  stroke: #fff;
  stroke-width: 3px;
  paint-order: stroke;
  pointer-events: none;
  text-anchor: middle;
}
</style>
