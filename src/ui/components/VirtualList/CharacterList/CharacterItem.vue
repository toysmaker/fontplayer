<template>
  <div class="character" :class="`character-${character.uuid}`">
    <span class="preview">
      <div v-if="showEmptyLines" class="empty-line-1"></div>
      <div v-if="showEmptyLines" class="empty-line-2"></div>
      <canvas
        ref="canvasRef"
        :data-uuid="character.uuid"
        :width="canvasWidth"
        :height="canvasHeight"
        class="preview-canvas"
      />
    </span>
    <span class="info">
      <span class="text">{{ character.character.text }}</span>
      <span v-if="character.type === 'text'" class="unicode">
        {{ formatUnicode(character.character.unicode) }}
      </span>
    </span>
    <span class="icon-group">
      <span class="copy-icon" @click.stop="handleCopy">
        <font-awesome-icon :icon="['fas', 'copy']" />
      </span>
      <span class="edit-icon" @click.stop="handleEdit">
        <font-awesome-icon icon="fa-solid fa-pen-nib" />
      </span>
      <span class="delete-icon" @click.stop="handleDelete">
        <font-awesome-icon :icon="['fas', 'trash']" />
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { ICharacterFileLite } from '@/core/types'
import { CharacterRenderer } from '@/core/font/CharacterRenderer'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { CanvasManager } from '@/core/canvas/CanvasManager'

// 标记是否已初始化（避免重复渲染）
const isInitialized = ref(false)
// 标记是否已渲染（用于控制红线显示）
const hasRendered = ref(false)

const props = defineProps<{
  character: ICharacterFileLite
}>()

const canvasRef = ref<HTMLCanvasElement>()
const canvasWidth = 100
const canvasHeight = 100
const projectStore = useProjectStore()
const characterStore = useCharacterStore()

// 检查是否应该显示空字符红线
const showEmptyLines = computed(() => {
  // 如果字符没有组件数据，显示红线
  const hasComponents = props.character.components && props.character.components.length > 0
  if (!hasComponents) {
    return true
  }
  
  // 如果字符有组件数据，检查 canvas 是否有内容
  const canvas = canvasRef.value
  if (!canvas) {
    // Canvas 还没创建，暂时不显示（等待创建）
    return false
  }
  
  // 使用 try-catch 包裹，避免在虚拟滚动时 canvas 被销毁导致的错误
  try {
    const hasContent = CanvasManager.hasContent(canvas)
    
    // 如果 canvas 有内容，不显示红线
    if (hasContent) {
      return false
    }
    
    // 如果 canvas 没有内容，需要判断是还没渲染还是渲染后确实没有内容
    // 只有当已经初始化且已经尝试过渲染时，才显示红线
    // 这表示字符虽然有组件，但渲染后没有内容（可能是空字符）
    if (isInitialized.value && hasRendered.value) {
      // 已经初始化且已尝试渲染，但 canvas 没有内容，显示红线
      return true
    }
    
    // 还没初始化或还在渲染中，暂时不显示红线（等待渲染完成）
    return false
  } catch (error) {
    // 如果检查失败（可能 canvas 已被销毁），不显示红线
    console.warn('Failed to check canvas content:', error)
    return false
  }
})

// 格式化 unicode 显示
const formatUnicode = (unicode: string | number): string => {
  if (typeof unicode === 'number') {
    return `0x${unicode.toString(16)}`
  }
  
  // 如果是字符串，处理各种格式
  const trimmed = unicode.trim()
  
  // 如果已经是 0x 格式，直接返回（但确保格式正确）
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const hex = trimmed.substring(2)
    const num = parseInt(hex, 16)
    if (!isNaN(num)) {
      return `0x${num.toString(16)}`
    }
    return trimmed // 如果解析失败，返回原字符串
  }
  
  // 尝试作为十进制数字解析
  const decimalNum = parseInt(trimmed, 10)
  if (!isNaN(decimalNum) && decimalNum.toString() === trimmed) {
    // 确保是纯数字字符串（避免 "4e00" 被解析为科学计数法）
    return `0x${decimalNum.toString(16)}`
  }
  
  // 尝试作为十六进制解析（不包含 0x 前缀）
  const hexNum = parseInt(trimmed, 16)
  if (!isNaN(hexNum) && hexNum.toString(16).toLowerCase() === trimmed.toLowerCase()) {
    return `0x${hexNum.toString(16)}`
  }
  
  // 如果都不行，尝试强制解析为数字（可能是科学计数法或其他格式）
  const forcedNum = Number(trimmed)
  if (!isNaN(forcedNum) && isFinite(forcedNum)) {
    return `0x${Math.floor(forcedNum).toString(16)}`
  }
  
  // 最后，如果都不行，直接返回原字符串
  return trimmed || unicode
}

// 处理复制、编辑、删除（暂时只实现编辑）
const handleCopy = () => {
  // TODO: 实现复制功能
  console.log('Copy character:', props.character.uuid)
}

const handleEdit = () => {
  // TODO: 实现编辑功能（重命名）
  console.log('Edit character:', props.character.uuid)
}

const handleDelete = () => {
  // TODO: 实现删除功能
  console.log('Delete character:', props.character.uuid)
}

// 渲染字符预览
const renderPreview = async (force: boolean = false) => {
  if (!canvasRef.value) return

  const canvas = canvasRef.value
  const uuid = props.character.uuid

  // 如果不强制渲染，先检查是否可以跳过
  if (!force && CanvasManager.canSkipRender(canvas, uuid)) {
    // 缓存存在且Canvas已有内容，直接返回
    hasRendered.value = true
    return
  }

  // 先尝试从内存缓存恢复（同步，快速）
  if (CanvasManager.restoreFromCache(canvas, uuid)) {
    hasRendered.value = true
    return
  }

  // 尝试从 IndexedDB 异步加载缓存
  const restored = await CanvasManager.restoreFromCacheAsync(canvas, uuid)
  if (restored) {
    // 成功从 IndexedDB 恢复，不需要渲染
    hasRendered.value = true
    return
  }

  // 缓存都没有，使用渲染引擎渲染
  const fontSettings = projectStore.selectedFile?.fontSettings
  const success = await CharacterRenderer.renderPreview(
    props.character,
    canvas,
    fontSettings
  )
  
  // 更新渲染状态
  // 无论成功与否，都标记为已尝试渲染
  // 然后检查 canvas 是否有内容
  hasRendered.value = true
  const hasContent = CanvasManager.hasContent(canvas)
  
  return success && hasContent
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
      hasRendered.value = true
      return
    }
    
    // 尝试从 IndexedDB 异步加载缓存
    // 注意：从 IndexedDB 恢复时，只有在 Canvas 没有被复用的情况下才标记
    CanvasManager.restoreFromCacheAsync(canvas, uuid).then(restored => {
      if (restored) {
        isInitialized.value = true
        hasRendered.value = true
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
              renderPreview().then(() => {
                if (canvasRef.value) {
                  hasRendered.value = CanvasManager.hasContent(canvasRef.value)
                }
              })
            } else {
              hasRendered.value = true
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
      if (canvas && !CanvasManager.hasContent(canvas)) {
        const restored = CanvasManager.restoreFromCache(canvas, uuid)
        hasRendered.value = restored && canvas && CanvasManager.hasContent(canvas)
      } else if (canvas) {
        hasRendered.value = true
      }
      return
    }
    
    // 内容变化，清除缓存，强制重新渲染
    CanvasManager.clearRenderCache(uuid)
    hasRendered.value = false
    nextTick(() => {
      const canvas = canvasRef.value
      if (canvas) {
        renderPreview(true).then(() => {
          if (canvasRef.value) {
            try {
              hasRendered.value = CanvasManager.hasContent(canvasRef.value)
            } catch (error) {
              console.warn('Failed to check canvas content after render:', error)
              hasRendered.value = false
            }
          }
        }).catch((error) => {
          console.warn('Render preview failed:', error)
          hasRendered.value = false
        })
      }
    })
  } else {
    // 新字符（UUID不同），检查是否可以跳过
    if (CanvasManager.canSkipRender(canvas, uuid)) {
      hasRendered.value = true
      return
    }
    
    // 尝试从缓存恢复
    if (CanvasManager.restoreFromCache(canvas, uuid)) {
      hasRendered.value = true
      return
    }
    
    // 需要渲染
    hasRendered.value = false
    nextTick(() => {
      const canvas = canvasRef.value
      if (canvas) {
        renderPreview().then(() => {
          if (canvasRef.value) {
            try {
              hasRendered.value = CanvasManager.hasContent(canvasRef.value)
            } catch (error) {
              console.warn('Failed to check canvas content after render:', error)
              hasRendered.value = false
            }
          }
        }).catch((error) => {
          console.warn('Render preview failed:', error)
          hasRendered.value = false
        })
      }
    })
  }
}, { deep: false }) // 改为shallow watch，只在引用变化时触发，内容变化通过上面的逻辑判断

onUnmounted(() => {
  // 清理状态
  isInitialized.value = false
  hasRendered.value = false
  
  // 释放Canvas缓存（但保留DOM元素，因为虚拟滚动可能会复用）
  // 注意：这里不删除，因为VirtualCharacterList会统一管理清理
  // 但需要清理 ref，避免内存泄漏
  if (canvasRef.value) {
    // 不删除 canvas，只清理引用
    canvasRef.value = undefined as any
  }
})
</script>

<style scoped>
.character {
  width: 80px;
  height: 112px;
  display: flex;
  flex-direction: column;
  border: 3px solid var(--primary-0);
  box-sizing: content-box;
  cursor: pointer;
  position: relative;
}

.character:hover {
  border: 3px solid var(--primary-1);
}

.character:hover .info {
  background-color: var(--primary-1);
}

.character:hover .info .unicode {
  background-color: var(--primary-1);
}

.character:hover .delete-icon,
.character:hover .copy-icon,
.character:hover .edit-icon {
  display: inline-flex;
}

.character:hover .icon-group {
  display: inline-flex;
}

.icon-group {
  display: none;
  position: absolute;
  right: 5px;
  top: 5px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  z-index: 10;
}

.delete-icon,
.copy-icon,
.edit-icon {
  width: 18px;
  height: 18px;
  display: none;
  align-items: center;
  justify-content: center;
  background-color: var(--primary-0);
  color: white;
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 0.2s ease;
  padding: 2px;
}

.delete-icon:hover,
.copy-icon:hover,
.edit-icon:hover {
  background-color: var(--primary-2);
}

.delete-icon svg,
.copy-icon svg,
.edit-icon svg {
  width: 100%;
  height: 100%;
  color: white;
}

.preview {
  display: inline-block;
  width: 80px;
  height: 80px;
  flex: 0 0 80px;
  background-color: white;
  position: relative;
}

.empty-line-1 {
  position: absolute;
  top: 0;
  left: -10px;
  right: 0;
  width: 100px;
  transform: translateY(40px) rotate(-45deg);
  border-bottom: 2px solid #bd6565;
  pointer-events: none;
}

.empty-line-2 {
  position: absolute;
  top: 0;
  left: -10px;
  right: 0;
  width: 100px;
  transform: translateY(40px) rotate(45deg);
  border-bottom: 2px solid #bd6565;
  pointer-events: none;
}

.preview-canvas {
  width: 100%;
  height: 100%;
}

.info {
  display: flex;
  flex-direction: row;
  /* flex: 0 0 32px; */
  height: 32px;
  line-height: 32px;
  background-color: var(--primary-0);
  color: var(--primary-5);
}

.text {
  flex: 0 0 32px;
  justify-content: center;
  text-align: center;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  line-height: 30px;
}

.unicode {
  line-height: 32px;
  font-size: 12px;
  background-color: var(--primary-0);
  color: var(--primary-5);
  flex: 1;
  text-align: center;
}
</style>
