<template>
  <div
    class="state-node"
    :class="{ selected, preview: previewMode }"
    :style="{ left: state.position.x + 'px', top: state.position.y + 'px' }"
    @pointerdown.stop="onPointerDown"
    @click.stop="emit('select', state.id)"
    @dblclick.stop="startRename"
  >
    <div class="state-node-port port-in" @pointerdown.stop="onPortDown('in', $event)" title="连接入口" />
    <div class="state-node-body">
      <n-input
        v-if="renaming"
        size="tiny"
        class="state-node-rename"
        :value="state.name"
        @update:value="(v: string) => emit('rename', state.id, v)"
        @blur="renaming = false"
        @keyup.enter="renaming = false"
      />
      <template v-else>
        <div class="state-node-name">{{ state.name }}</div>
        <div class="state-node-segment">
          <font-awesome-icon :icon="['fas', 'film']" />
          {{ segmentName || '—' }}
        </div>
        <div v-if="state.loop" class="state-node-loop">
          <font-awesome-icon :icon="['fas', 'rotate']" />
        </div>
      </template>
    </div>
    <div class="state-node-port port-out" @pointerdown.stop="onPortDown('out', $event)" title="拖出创建转换" />
  </div>
</template>

<script setup lang="ts">
/**
 * 状态节点：显示名称/关联片段/循环标记，支持拖拽移动、双击重命名、端口连线。
 * 拖拽使用 Pointer Events（pointer capture），preview 模式下禁用。
 */
import { ref } from 'vue'
import { NInput } from 'naive-ui'
import type { IMicroInteractionState } from '@/core/types'

const props = defineProps<{
  state: IMicroInteractionState
  segmentName: string
  selected: boolean
  previewMode: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  move: [id: string, x: number, y: number]
  rename: [id: string, name: string]
  portDown: [stateId: string, port: 'in' | 'out', event: PointerEvent]
}>()

const renaming = ref(false)

function startRename() {
  if (props.previewMode) return
  renaming.value = true
}

function onPointerDown(e: PointerEvent) {
  if (props.previewMode) return
  const el = e.currentTarget as HTMLElement
  const startX = e.clientX
  const startY = e.clientY
  const originX = props.state.position.x
  const originY = props.state.position.y
  el.setPointerCapture(e.pointerId)
  const onMove = (ev: PointerEvent) => {
    emit('move', props.state.id, originX + ev.clientX - startX, originY + ev.clientY - startY)
  }
  const onUp = () => {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
  }
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
}

function onPortDown(port: 'in' | 'out', e: PointerEvent) {
  if (props.previewMode) return
  emit('portDown', props.state.id, port, e)
}
</script>

<style scoped>
.state-node {
  position: absolute;
  width: 150px;
  height: 64px;
  display: flex;
  align-items: center;
  background-color: #fff;
  border: 2px solid #d0d0d6;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
  z-index: 2;
}
.state-node.selected {
  border-color: var(--primary-3);
  box-shadow: 0 0 0 2px rgba(62, 102, 179, 0.25);
}
.state-node.preview {
  cursor: default;
  pointer-events: none;
}
.state-node-body {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  position: relative;
}
.state-node-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.state-node-segment {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--primary-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.state-node-loop {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--primary-3);
  font-size: 12px;
}
.state-node-rename {
  width: 100%;
}
.state-node-port {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  background-color: var(--primary-3);
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: crosshair;
  z-index: 3;
}
.state-node-port:hover {
  transform: scale(1.3);
}
.port-in {
  left: -7px;
}
.port-out {
  right: -7px;
}
</style>
