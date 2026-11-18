<template>
  <div
    ref="containerRef"
    class="stage-container"
    @pointerdown="handlePointerDown"
    @dblclick="handleDoubleClick"
  >
    <!-- 画布与覆盖层统一基准：wrap 与画布同尺寸（居中），变换框/光标/输入框都相对画布定位 -->
    <div v-if="data && library" class="stage-wrap" :style="wrapStyle">
      <canvas
        ref="canvasRef"
        class="stage-canvas"
        :width="data.canvas.width"
        :height="data.canvas.height"
      />

      <!-- 选中框与缩放把手 -->
      <template v-if="selected && scale > 0">
        <div class="selection-box" :style="selectionBoxStyle">
          <div
            v-for="handle in HANDLES"
            :key="handle"
            class="resize-handle"
            :class="`handle-${handle}`"
            @pointerdown.stop="handleResizeStart($event, handle)"
          ></div>
        </div>
      </template>

      <!-- 文字编辑光标（插入符） -->
      <div v-if="caretStyle" class="text-caret" :style="caretStyle"></div>

      <!-- 隐形输入框：canvas 内直接输入文字（PS 式交互，IME 兼容） -->
      <input
        v-if="editing"
        ref="textInputRef"
        v-model="editValue"
        class="text-edit-input"
        :style="inputStyle"
        @input="handleTextInput"
        @keydown="handleTextKeydown"
        @compositionstart="composing = true"
        @compositionend="handleCompositionEnd"
        @blur="handleInputBlur"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { IAppComponent, ICardAppData } from '@/features/applications/types'
import type { ResizeHandle, useAppCanvasEditor } from '@/features/applications/canvas/useAppCanvasEditor'
import {
  findFreeTextCharIndexAt,
  findGridCellIndexAt,
  freeTextCaretRect,
  gridCellRect,
  renderAppCanvas,
} from '@/features/applications/canvas/AppCanvasRenderer'

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const props = defineProps<{
  data: ICardAppData
  library: FontLibrary | null
  editor: ReturnType<typeof useAppCanvasEditor>
  /** 字库重建版本号（保存后强制重渲染） */
  libraryVersion?: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })

let resizeObserver: ResizeObserver | null = null
let renderToken = 0

const selected = computed(() => props.editor.selected.value)

const scale = computed(() => {
  const w = containerSize.value.width
  const h = containerSize.value.height
  if (!w || !h || !props.data.canvas.width || !props.data.canvas.height) return 0
  return Math.min(w / props.data.canvas.width, h / props.data.canvas.height)
})

/** wrap 与画布 CSS 尺寸一致（容器内居中） */
const wrapStyle = computed(() => {
  const s = scale.value
  return {
    width: `${props.data.canvas.width * s}px`,
    height: `${props.data.canvas.height * s}px`,
  }
})

const selectionBoxStyle = computed(() => {
  const c = selected.value
  const s = scale.value
  if (!c || !s) return {}
  return {
    left: `${c.x * s}px`,
    top: `${c.y * s}px`,
    width: `${c.width * s}px`,
    height: `${c.height * s}px`,
  }
})

async function reRender() {
  const token = ++renderToken
  const canvas = canvasRef.value
  if (!canvas || !props.library) return
  try {
    await renderAppCanvas(canvas, props.data, props.library)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AppCanvasStage] render failed:', err)
    }
  }
  if (token !== renderToken) {
    // 渲染期间又发生了变化，直接重画一次，保证最终一致
    void reRender()
  }
}

watch(
  () => [
    props.data.components,
    props.data.canvas,
    props.library?.family,
    props.libraryVersion,
  ] as const,
  () => {
    void reRender()
  },
  { deep: true }
)

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect) {
      containerSize.value = { width: rect.width, height: rect.height }
    }
  })
  resizeObserver.observe(el)
  void reRender()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
})

// ---- 指针交互（拖拽/缩放） ----

interface DragState {
  mode: 'move' | 'resize'
  id: string
  handle?: ResizeHandle
  lastX: number
  lastY: number
}

let drag: DragState | null = null

function clientToDesign(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const canvas = canvasRef.value
  const rect = canvas?.getBoundingClientRect()
  const s = scale.value
  if (!canvas || !rect || !s) return { x: 0, y: 0 }
  return {
    x: (e.clientX - rect.left) / s,
    y: (e.clientY - rect.top) / s,
  }
}

function handlePointerDown(e: PointerEvent) {
  // 正在编辑文字时点击画布：提交并退出编辑
  if (editing.value) {
    commitPending()
    endEditing()
  }
  if (!props.data || !props.library) return
  const pt = clientToDesign(e)
  const hit = props.editor.hitTest(pt.x, pt.y)
  props.editor.select(hit?.id ?? null)
  if (!hit) return
  drag = { mode: 'move', id: hit.id, lastX: pt.x, lastY: pt.y }
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function handleResizeStart(e: PointerEvent, handle: ResizeHandle) {
  const c = selected.value
  if (!c) return
  const pt = clientToDesign(e)
  drag = { mode: 'resize', id: c.id, handle, lastX: pt.x, lastY: pt.y }
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function handlePointerMove(e: PointerEvent) {
  if (!drag) return
  const pt = clientToDesign(e)
  const dx = pt.x - drag.lastX
  const dy = pt.y - drag.lastY
  drag.lastX = pt.x
  drag.lastY = pt.y
  if (drag.mode === 'move') {
    props.editor.moveComponent(drag.id, dx, dy)
  } else if (drag.mode === 'resize' && drag.handle) {
    props.editor.resizeComponent(drag.id, drag.handle, dx, dy)
  }
}

function handlePointerUp() {
  drag = null
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}

// ---- canvas 内文字编辑（PS 式：双击进入编辑，直接打字） ----

type TextEditing =
  | { kind: 'freeText'; id: string; caret: number }
  | { kind: 'charGrid'; id: string; cell: number }

const editing = ref<TextEditing | null>(null)
const editValue = ref('')
const composing = ref(false)
/** 已提交到组件的输入长度（用于计算增量） */
let committedLength = 0

function editingComponent(): IAppComponent | null {
  if (!editing.value) return null
  return props.data.components.find((c) => c.id === editing.value!.id) ?? null
}

function getCtx(): CanvasRenderingContext2D | null {
  const canvas = canvasRef.value
  return canvas?.getContext('2d') ?? null
}

/** 自由排版：插入/删除后文本与光标 */
function insertFreeText(text: string) {
  const ed = editing.value
  const comp = editingComponent()
  if (!ed || ed.kind !== 'freeText' || !comp || comp.kind !== 'freeText' || !text) return
  comp.text = comp.text.slice(0, ed.caret) + text + comp.text.slice(ed.caret)
  ed.caret += text.length
}

function deleteFreeText(offset: -1 | 1) {
  const ed = editing.value
  const comp = editingComponent()
  if (!ed || ed.kind !== 'freeText' || !comp || comp.kind !== 'freeText') return
  if (offset < 0 && ed.caret > 0) {
    comp.text = comp.text.slice(0, ed.caret - 1) + comp.text.slice(ed.caret)
    ed.caret--
  } else if (offset > 0 && ed.caret < comp.text.length) {
    comp.text = comp.text.slice(0, ed.caret) + comp.text.slice(ed.caret + 1)
  }
}

/** 字符网格：把输入提交到单元格（替换原字符，可多字；目标格超出内容时用空格补齐中间格） */
function commitGridText(text: string) {
  const ed = editing.value
  const comp = editingComponent()
  if (!ed || ed.kind !== 'charGrid' || !comp || comp.kind !== 'charGrid') return
  const { cols, rows } = comp
  const maxCell = Math.max(0, cols * rows - 1)
  const cell = Math.min(ed.cell, maxCell)
  if (cell > comp.content.length) {
    comp.content = comp.content + ' '.repeat(cell - comp.content.length)
  }
  comp.content = comp.content.slice(0, cell) + text + comp.content.slice(cell + 1)
  ed.cell = Math.min(cell + text.length, maxCell)
}

function clearGridCell() {
  const ed = editing.value
  const comp = editingComponent()
  if (!ed || ed.kind !== 'charGrid' || !comp || comp.kind !== 'charGrid') return
  const cell = ed.cell
  comp.content = comp.content.slice(0, cell) + comp.content.slice(cell + 1)
}

/** 提交输入框中的增量文本 */
function commitPending() {
  if (!editing.value) return
  const delta = editValue.value.slice(committedLength)
  if (delta) {
    if (editing.value.kind === 'freeText') insertFreeText(delta)
    else commitGridText(delta)
  }
  editValue.value = ''
  committedLength = 0
}

function endEditing() {
  editing.value = null
  editValue.value = ''
  committedLength = 0
  composing.value = false
}

function handleDoubleClick(e: MouseEvent) {
  if (!props.data || !props.library) return
  const pt = clientToDesign(e)
  const hit = props.editor.hitTest(pt.x, pt.y)
  if (!hit) return

  if (hit.kind === 'freeText') {
    const ctx = getCtx()
    if (!ctx) return
    const caret = findFreeTextCharIndexAt(hit, pt.x, pt.y, ctx, props.library.family)
    editing.value = { kind: 'freeText', id: hit.id, caret }
  } else if (hit.kind === 'charGrid') {
    const cell = findGridCellIndexAt(hit, pt.x, pt.y)
    editing.value = { kind: 'charGrid', id: hit.id, cell }
  } else {
    return
  }
  editValue.value = ''
  committedLength = 0
  void nextTick(() => {
    textInputRef.value?.focus()
  })
}

function handleTextInput() {
  // 输入法组合期间不提交，等 compositionend 一次性提交
  if (composing.value) return
  commitPending()
}

function handleCompositionEnd() {
  composing.value = false
  commitPending()
}

function handleTextKeydown(e: KeyboardEvent) {
  if (!editing.value) return
  const ed = editing.value
  if (e.key === 'Escape') {
    e.preventDefault()
    endEditing()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    commitPending()
    endEditing()
    return
  }
  if (composing.value) return

  if (ed.kind === 'freeText') {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (editValue.value.length === 0) ed.caret = Math.max(0, ed.caret - 1)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const comp = editingComponent()
      if (editValue.value.length === 0 && comp?.kind === 'freeText') {
        ed.caret = Math.min(comp.text.length, ed.caret + 1)
      }
      return
    }
    if (e.key === 'Backspace') {
      if (editValue.value.length === 0) {
        e.preventDefault()
        deleteFreeText(-1)
      }
      return
    }
    if (e.key === 'Delete') {
      e.preventDefault()
      if (editValue.value.length > 0) {
        // 删除输入框内待提交文本
        const caretPos = textInputRef.value?.selectionStart ?? editValue.value.length
        editValue.value = editValue.value.slice(0, caretPos) + editValue.value.slice(caretPos + 1)
      } else {
        deleteFreeText(1)
      }
      return
    }
    return
  }

  // charGrid
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    ed.cell = Math.max(0, ed.cell - 1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    const comp = editingComponent()
    if (comp?.kind === 'charGrid') {
      ed.cell = Math.min(Math.max(0, comp.cols * comp.rows - 1), ed.cell + 1)
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const comp = editingComponent()
    if (comp?.kind === 'charGrid') ed.cell = Math.max(0, ed.cell - comp.cols)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const comp = editingComponent()
    if (comp?.kind === 'charGrid') {
      ed.cell = Math.min(Math.max(0, comp.cols * comp.rows - 1), ed.cell + comp.cols)
    }
  } else if (e.key === 'Backspace') {
    if (editValue.value.length === 0) {
      e.preventDefault()
      clearGridCell()
    }
  } else if (e.key === 'Delete') {
    e.preventDefault()
    if (editValue.value.length > 0) {
      const caretPos = textInputRef.value?.selectionStart ?? editValue.value.length
      editValue.value = editValue.value.slice(0, caretPos) + editValue.value.slice(caretPos + 1)
    } else {
      clearGridCell()
    }
  }
}

function handleInputBlur() {
  // 点击画布已在 pointerdown 中退出编辑；这里兜底（如点击面板）
  if (editing.value) {
    commitPending()
    endEditing()
  }
}

// ---- 光标/输入框定位（设计坐标 → 覆盖层坐标） ----

const caretStyle = computed(() => {
  const ed = editing.value
  const s = scale.value
  if (!ed || !s || !props.library) return null
  const comp = editingComponent()
  if (!comp) return null
  let rect: { x: number; y: number; height: number } | null = null
  if (ed.kind === 'freeText' && comp.kind === 'freeText') {
    const ctx = getCtx()
    if (ctx) rect = freeTextCaretRect(comp, ed.caret, ctx, props.library.family)
  } else if (ed.kind === 'charGrid' && comp.kind === 'charGrid') {
    rect = gridCellRect(comp, ed.cell)
  }
  if (!rect) return null
  return {
    left: `${rect.x * s}px`,
    top: `${rect.y * s}px`,
    height: `${Math.max(8, rect.height * s)}px`,
  }
})

const inputStyle = computed(() => {
  const style = caretStyle.value
  if (!style) return {}
  return {
    left: style.left,
    top: style.top,
    height: style.height,
  }
})
</script>

<style scoped>
.stage-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.stage-wrap {
  position: relative;
  flex-shrink: 0;
}

.stage-canvas {
  width: 100%;
  height: 100%;
  display: block;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.selection-box {
  position: absolute;
  border: 1.5px solid #4a90e2;
  pointer-events: none;
  box-sizing: border-box;
}

.resize-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #4a90e2;
  border: 1px solid #fff;
  border-radius: 1px;
  pointer-events: auto;
  cursor: pointer;
}

.handle-nw { left: -5px; top: -5px; cursor: nwse-resize; }
.handle-n { left: 50%; top: -5px; transform: translateX(-50%); cursor: ns-resize; }
.handle-ne { right: -5px; top: -5px; cursor: nesw-resize; }
.handle-e { right: -5px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.handle-se { right: -5px; bottom: -5px; cursor: nwse-resize; }
.handle-s { left: 50%; bottom: -5px; transform: translateX(-50%); cursor: ns-resize; }
.handle-sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
.handle-w { left: -5px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }

.text-caret {
  position: absolute;
  width: 2px;
  background: #4a90e2;
  pointer-events: none;
  animation: caret-blink 1s step-end infinite;
}

@keyframes caret-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.text-edit-input {
  position: absolute;
  width: 2px;
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  margin: 0;
  opacity: 0.01;
  caret-color: transparent;
}
</style>
