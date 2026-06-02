<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { ICharacterFileLite } from '@/core/types'
import { useAdvancedEditStore } from '@/stores/advancedEdit'

const props = defineProps<{
  characters: ICharacterFileLite[]
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [index: number]
  close: []
}>()

const advancedEdit = useAdvancedEditStore()
const canvasRef = ref<HTMLCanvasElement>()

const currentChar = computed(() => props.characters[props.modelValue] ?? null)

function render() {
  const canvas = canvasRef.value
  const char = currentChar.value
  if (!canvas || !char) return
  advancedEdit.renderZoomedCharacterPreview(char, canvas)
}

function goToPrev() {
  const len = props.characters.length
  if (len === 0) return
  emit('update:modelValue', (props.modelValue - 1 + len) % len)
}

function goToNext() {
  const len = props.characters.length
  if (len === 0) return
  emit('update:modelValue', (props.modelValue + 1) % len)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goToPrev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    goToNext()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

watch(currentChar, () => {
  requestAnimationFrame(() => {
    render()
  })
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  requestAnimationFrame(() => {
    render()
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  // v-if 切换会重建缩略图 canvas，需要重新绘制
  nextTick(() => {
    requestAnimationFrame(() => {
      advancedEdit.updateCharactersAndPreview()
    })
  })
})
</script>

<template>
  <div class="zoom-preview-container">
    <div class="zoom-nav-btn zoom-nav-left" @click="goToPrev">
      <font-awesome-icon :icon="['fas', 'chevron-left']" />
    </div>
    <div class="zoom-canvas-area">
      <div class="zoom-char-label">{{ currentChar?.character?.text || '' }}</div>
      <canvas
        ref="canvasRef"
        width="2000"
        height="2000"
        class="zoom-canvas"
      />
      <div class="zoom-close-btn" @click="emit('close')">
        <font-awesome-icon :icon="['fas', 'xmark']" />
      </div>
    </div>
    <div class="zoom-nav-btn zoom-nav-right" @click="goToNext">
      <font-awesome-icon :icon="['fas', 'chevron-right']" />
    </div>
  </div>
</template>

<style scoped>
.zoom-preview-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--dark-3);
  position: relative;
}

.zoom-nav-btn {
  flex: 0 0 48px;
  width: 48px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--light-0);
  font-size: 24px;
  user-select: none;
  transition: background-color 0.15s;
}

.zoom-nav-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.zoom-nav-btn:active {
  background-color: rgba(255, 255, 255, 0.14);
}

.zoom-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  position: relative;
}

.zoom-char-label {
  color: var(--light-0);
  font-size: 18px;
  margin-bottom: 8px;
  user-select: none;
}

.zoom-canvas {
  width: 500px;
  height: 500px;
  display: block;
  border: 1px solid var(--light-5);
  background: white;
}

.zoom-close-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--light-0);
  font-size: 18px;
  opacity: 0.6;
  transition: opacity 0.15s;
  user-select: none;
}

.zoom-close-btn:hover {
  opacity: 1;
}
</style>
