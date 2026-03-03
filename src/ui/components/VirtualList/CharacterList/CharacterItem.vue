<template>
  <div class="character-item-wrapper">
    <canvas
      ref="canvasRef"
      :data-uuid="character.uuid"
      :width="canvasWidth"
      :height="canvasHeight"
      class="character-preview-canvas"
    />
    <div class="character-info">
      <span class="character-text">{{ character.character.text }}</span>
      <span class="character-unicode">{{ character.character.unicode }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { ICharacterFileLite } from '@/core/types'
import { CharacterRenderer } from '@/core/font/CharacterRenderer'
import { useProjectStore } from '@/stores/project'
import { CanvasManager } from '@/core/canvas/CanvasManager'

// 标记是否已初始化（避免重复渲染）
const isInitialized = ref(false)

const props = defineProps<{
  character: ICharacterFileLite
}>()

const canvasRef = ref<HTMLCanvasElement>()
const canvasWidth = 100
const canvasHeight = 100
const projectStore = useProjectStore()

// 渲染字符预览
const renderPreview = async (force: boolean = false) => {
  if (!canvasRef.value) return

  const canvas = canvasRef.value
  const uuid = props.character.uuid

  // 如果不强制渲染，先检查是否可以跳过
  if (!force && CanvasManager.canSkipRender(canvas, uuid)) {
    // 缓存存在且Canvas已有内容，直接返回
    return
  }

  // 先尝试从内存缓存恢复（同步，快速）
  if (CanvasManager.restoreFromCache(canvas, uuid)) {
    return
  }

  // 尝试从 IndexedDB 异步加载缓存
  const restored = await CanvasManager.restoreFromCacheAsync(canvas, uuid)
  if (restored) {
    // 成功从 IndexedDB 恢复，不需要渲染
    return
  }

  // 缓存都没有，使用渲染引擎渲染
  const fontSettings = projectStore.selectedFile?.fontSettings
  await CharacterRenderer.renderPreview(
    props.character,
    canvas,
    fontSettings
  )
}

onMounted(() => {
  nextTick(() => {
    if (!canvasRef.value) return
    
    const canvas = canvasRef.value
    const uuid = props.character.uuid
    
    // 注册Canvas到管理器（用于复用）
    // 注意：registerCanvas 会清除旧的 UUID 映射（如果 Canvas 被复用）
    CanvasManager.registerCanvas(uuid, canvas)
    
    // 先尝试从内存缓存恢复（同步，快速）
    // 内存缓存意味着之前已经渲染过，可以安全地恢复和标记
    if (CanvasManager.restoreFromCache(canvas, uuid)) {
      isInitialized.value = true
      return
    }
    
    // 尝试从 IndexedDB 异步加载缓存
    // 注意：从 IndexedDB 恢复时，只有在 Canvas 没有被复用的情况下才标记
    CanvasManager.restoreFromCacheAsync(canvas, uuid).then(restored => {
      if (restored) {
        isInitialized.value = true
        return
      }
      
      // 缓存都没有，让 VirtualCharacterList 的渲染队列统一处理
      // 避免重复渲染和标记冲突
      // 如果 VirtualCharacterList 没有处理，再自己渲染
      if (!isInitialized.value) {
        // 延迟一下，让 VirtualCharacterList 有机会先处理
        setTimeout(() => {
          if (!isInitialized.value && canvasRef.value) {
            // 再次检查是否可以跳过（可能 VirtualCharacterList 已经渲染了）
            if (!CanvasManager.canSkipRender(canvasRef.value, uuid)) {
              renderPreview()
            }
            isInitialized.value = true
          }
        }, 300)
      }
    })
  })
})

watch(() => props.character, (newChar, oldChar) => {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const uuid = newChar.uuid
  
  // 如果Canvas已有内容且缓存存在，且内容未变化，直接跳过
  if (oldChar && newChar.uuid === oldChar.uuid) {
    // UUID相同，检查内容是否变化
    const contentChanged = 
      newChar.character?.text !== oldChar.character?.text ||
      newChar.character?.unicode !== oldChar.character?.unicode ||
      (newChar.components?.length || 0) !== (oldChar.components?.length || 0)
    
    if (!contentChanged) {
      // 内容未变化，尝试从缓存恢复（如果Canvas被清空了）
      if (!CanvasManager.hasContent(canvas)) {
        CanvasManager.restoreFromCache(canvas, uuid)
      }
      return
    }
    
    // 内容变化，清除缓存，强制重新渲染
    CanvasManager.clearRenderCache(uuid)
    nextTick(() => {
      renderPreview(true) // 强制渲染
    })
  } else {
    // 新字符（UUID不同），检查是否可以跳过
    if (CanvasManager.canSkipRender(canvas, uuid)) {
      return
    }
    
    // 尝试从缓存恢复
    if (CanvasManager.restoreFromCache(canvas, uuid)) {
      return
    }
    
    // 需要渲染
  nextTick(() => {
    renderPreview()
  })
  }
}, { deep: false }) // 改为shallow watch，只在引用变化时触发，内容变化通过上面的逻辑判断

onUnmounted(() => {
  // 释放Canvas缓存（但保留DOM元素，因为虚拟滚动可能会复用）
  // 注意：这里不删除，因为VirtualCharacterList会统一管理清理
})
</script>

<style scoped>
.character-item-wrapper {
  display: flex;
  align-items: center;
  padding: 8px;
  gap: 12px;
}

.character-preview-canvas {
  border: 1px solid var(--n-border-color);
  background: white;
}

.character-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.character-text {
  font-size: 16px;
  font-weight: 500;
}

.character-unicode {
  font-size: 12px;
  color: var(--n-text-color-2);
}
</style>
