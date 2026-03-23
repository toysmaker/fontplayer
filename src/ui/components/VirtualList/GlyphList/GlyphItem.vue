<template>
  <div class="glyph" :class="`glyph-${glyph.uuid}`">
    <span class="preview">
      <div v-if="showEmptyLines" class="empty-line-1"></div>
      <div v-if="showEmptyLines" class="empty-line-2"></div>
      <canvas
        ref="canvasRef"
        :data-uuid="glyph.uuid"
        :width="canvasWidth"
        :height="canvasHeight"
        class="preview-canvas"
      />
    </span>
    <span class="info">
      <span class="name">{{ glyph.name }}</span>
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
import type { ICustomGlyph } from '@/core/types'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { useProjectStore } from '@/stores/project'
import { useGlyphStore } from '@/stores/glyph'
import { CanvasManager } from '@/core/canvas/CanvasManager'

// 标记是否已初始化（避免重复渲染）
const isInitialized = ref(false)
// 标记是否已渲染（用于控制红线显示）
const hasRendered = ref(false)

const props = defineProps<{
  glyph: ICustomGlyph
}>()

const canvasRef = ref<HTMLCanvasElement>()
const canvasWidth = 100
const canvasHeight = 100
const projectStore = useProjectStore()
const glyphStore = useGlyphStore()

// 检查是否应该显示空字形红线
const showEmptyLines = computed(() => {
  const glyphUUID = props.glyph.uuid
  const glyphName = props.glyph.name

  // 已绑定骨架的笔画：预览由 ScriptExecutor + 骨架生成，可无 script、也可能暂无钢笔组件
  // （例如轮廓被过滤为空），不得走「无组件无脚本」分支误标红叉
  if (props.glyph.skeleton) {
    return false
  }
  // 测试手绘模板在 createBaseGlyph 即写入 style；若工程往返后 skeleton 丢失，仍避免误标
  if (props.glyph.style === '测试手绘风格') {
    return false
  }
  
  // 检查字形是否有组件数据或脚本
  const hasComponents = props.glyph.components && props.glyph.components.length > 0
  const hasScript = !!(props.glyph.script || props.glyph.script_reference)
  
  // 如果字形既没有组件也没有脚本，显示红线
  if (!hasComponents && !hasScript) {
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=true (no components and no script)`)
    }
    return true
  }
  
  // 如果字形有脚本但没有组件，暂时不显示红线（等待脚本执行生成组件）
  if (!hasComponents && hasScript) {
    // 检查 canvas 是否有内容（可能已经渲染过了）
    const canvas = canvasRef.value
    if (canvas) {
      try {
        const hasContent = CanvasManager.hasContent(canvas)
        if (hasContent) {
          if (import.meta.env.DEV) {
            console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=false (has script and canvas has content)`)
          }
          return false
        }
      } catch (error) {
        // 忽略错误
      }
    }
    // 有脚本但 canvas 没有内容，等待渲染完成
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=false (has script, waiting for render)`)
    }
    return false
  }
  
  // 如果字形有组件数据，检查 canvas 是否有内容
  const canvas = canvasRef.value
  if (!canvas) {
    // Canvas 还没创建，暂时不显示（等待创建）
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=false (canvas not created)`)
    }
    return false
  }
  
  // 使用 try-catch 包裹，避免在虚拟滚动时 canvas 被销毁导致的错误
  try {
    const hasContent = CanvasManager.hasContent(canvas)
    const canSkip = CanvasManager.canSkipRender(canvas, glyphUUID)
    
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines check`, {
        hasComponents,
        hasContent,
        canSkip,
        isInitialized: isInitialized.value,
        hasRendered: hasRendered.value,
        componentsCount: props.glyph.components?.length || 0,
      })
    }
    
    // 如果 canvas 有内容，不显示红线（无论 hasRendered 状态如何）
    // 这可以处理 VirtualGlyphList 已经渲染但 hasRendered 还没更新的情况
    if (hasContent) {
      if (import.meta.env.DEV) {
        console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=false (has content)`)
      }
      return false
    }
    
    // 如果 canvas 没有内容，需要判断是还没渲染还是渲染后确实没有内容
    // 只有当已经初始化且已经尝试过渲染时，才显示红线
    // 这表示字形虽然有组件，但渲染后没有内容（可能是空字形）
    if (isInitialized.value && hasRendered.value) {
      // 已经初始化且已尝试渲染，但 canvas 没有内容，显示红线
      if (import.meta.env.DEV) {
        console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=true (initialized and rendered but no content)`)
      }
  return true
    }
    
    // 还没初始化或还在渲染中，暂时不显示红线（等待渲染完成）
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): showEmptyLines=false (waiting for render)`)
    }
    return false
  } catch (error) {
    // 如果检查失败（可能 canvas 已被销毁），不显示红线
    console.warn(`[GlyphItem] ${glyphName} (${glyphUUID}): Failed to check canvas content:`, error)
    return false
  }
})

// 渲染预览
const renderPreview = async (force: boolean = false) => {
  if (!canvasRef.value || !props.glyph) return

  const canvas = canvasRef.value
  const uuid = props.glyph.uuid
  const glyphName = props.glyph.name

  if (import.meta.env.DEV) {
    console.log(`[GlyphItem] ${glyphName} (${uuid}): renderPreview called`, { force })
  }
  
  // 注册 Canvas
  CanvasManager.registerCanvas(uuid, canvas)
  
  // 如果不强制渲染，先检查是否可以跳过
  if (!force && CanvasManager.canSkipRender(canvas, uuid)) {
    // 缓存存在且Canvas已有内容，直接返回
    hasRendered.value = true
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${uuid}): canSkipRender=true, hasRendered=true`)
    }
    return
  }

  // 先尝试从内存缓存恢复（同步，快速）
  if (CanvasManager.restoreFromCache(canvas, uuid)) {
      hasRendered.value = true
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${uuid}): restored from memory cache, hasRendered=true`)
    }
      return
    }

  // 尝试从 IndexedDB 异步加载缓存
  const restored = await CanvasManager.restoreFromCacheAsync(canvas, uuid)
  if (restored) {
    // 成功从 IndexedDB 恢复，不需要渲染
    hasRendered.value = true
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${uuid}): restored from IndexedDB cache, hasRendered=true`)
    }
    return
  }
  
  // 缓存都没有，使用渲染引擎渲染
  try {
    const fontSettings = projectStore.selectedFile?.fontSettings
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${uuid}): calling GlyphRenderer.renderPreview`)
    }
    const success = await GlyphRenderer.renderPreview(canvas, props.glyph, fontSettings)
    
    // 更新渲染状态
    // 无论成功与否，都标记为已尝试渲染
    // 然后检查 canvas 是否有内容
    hasRendered.value = true
    const hasContent = CanvasManager.hasContent(canvas)
    
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${uuid}): renderPreview completed`, {
        success,
        hasContent,
        hasRendered: hasRendered.value,
      })
    }
    
    return success && hasContent
  } catch (error) {
    console.error(`[GlyphItem] ${glyphName} (${uuid}): Failed to render glyph:`, error)
    hasRendered.value = true // 标记为已尝试渲染，即使失败
    return false
  }
}

// 处理复制
const handleCopy = () => {
  // TODO: 实现复制功能
  console.log('Copy glyph:', props.glyph.uuid)
}

// 处理编辑
const handleEdit = () => {
  glyphStore.setEditingGlyph(props.glyph.uuid)
  // TODO: 切换到字形编辑页面
  console.log('Edit glyph:', props.glyph.uuid)
}

// 处理删除
const handleDelete = () => {
  // TODO: 实现删除功能
  console.log('Delete glyph:', props.glyph.uuid)
}

onMounted(() => {
  nextTick(() => {
    if (!canvasRef.value) return
    
    const canvas = canvasRef.value
    const uuid = props.glyph.uuid
    const glyphName = props.glyph.name
    
    if (import.meta.env.DEV) {
      console.log(`[GlyphItem] ${glyphName} (${uuid}): onMounted`)
    }
    
    // 注册Canvas到管理器（用于复用）
    CanvasManager.registerCanvas(uuid, canvas)
    
    // 先尝试从内存缓存恢复（同步，快速）
    if (CanvasManager.restoreFromCache(canvas, uuid)) {
      isInitialized.value = true
      hasRendered.value = CanvasManager.hasContent(canvas)
      if (import.meta.env.DEV) {
        console.log(`[GlyphItem] ${glyphName} (${uuid}): restored from memory cache`, {
          isInitialized: isInitialized.value,
          hasRendered: hasRendered.value,
          hasContent: CanvasManager.hasContent(canvas),
        })
      }
      return
    }
    
    // 尝试从 IndexedDB 异步加载缓存
    CanvasManager.restoreFromCacheAsync(canvas, uuid).then(restored => {
      if (restored) {
        isInitialized.value = true
        hasRendered.value = CanvasManager.hasContent(canvas)
        if (import.meta.env.DEV) {
          console.log(`[GlyphItem] ${glyphName} (${uuid}): restored from IndexedDB cache`, {
            isInitialized: isInitialized.value,
            hasRendered: hasRendered.value,
            hasContent: CanvasManager.hasContent(canvas),
          })
        }
        return
      }
      
      // 缓存都没有，让 VirtualGlyphList 的渲染队列统一处理
      // 避免重复渲染和标记冲突
      // 如果 VirtualGlyphList 没有处理，再自己渲染
  if (!isInitialized.value) {
        if (import.meta.env.DEV) {
          console.log(`[GlyphItem] ${glyphName} (${uuid}): no cache, waiting for VirtualGlyphList or self render`)
        }
        
        // 启动内容检查定时器（用于检测 VirtualGlyphList 是否已经渲染）
        startContentCheck()
        
        // 延迟一下，让 VirtualGlyphList 有机会先处理
        setTimeout(() => {
          if (!isInitialized.value && canvasRef.value) {
            const hasContent = CanvasManager.hasContent(canvasRef.value)
            const canSkip = CanvasManager.canSkipRender(canvasRef.value, uuid)
            
            if (import.meta.env.DEV) {
              console.log(`[GlyphItem] ${glyphName} (${uuid}): delayed check after 500ms`, {
                hasContent,
                canSkip,
                isInitialized: isInitialized.value,
              })
            }
            
            // 再次检查是否可以跳过（可能 VirtualGlyphList 已经渲染了）
            if (canSkip) {
              // VirtualGlyphList 已经渲染了
              isInitialized.value = true
              hasRendered.value = hasContent
              if (import.meta.env.DEV) {
                console.log(`[GlyphItem] ${glyphName} (${uuid}): VirtualGlyphList rendered, updated state`, {
                  isInitialized: isInitialized.value,
                  hasRendered: hasRendered.value,
                })
              }
            } else if (hasContent) {
              // Canvas 有内容，可能是 VirtualGlyphList 渲染的，但没有标记
              isInitialized.value = true
              hasRendered.value = true
              if (import.meta.env.DEV) {
                console.log(`[GlyphItem] ${glyphName} (${uuid}): canvas has content, updated state`, {
                  isInitialized: isInitialized.value,
                  hasRendered: hasRendered.value,
                })
              }
            } else {
              // 需要自己渲染
              if (import.meta.env.DEV) {
                console.log(`[GlyphItem] ${glyphName} (${uuid}): need self render`)
              }
              renderPreview().then(() => {
                if (canvasRef.value) {
                  hasRendered.value = CanvasManager.hasContent(canvasRef.value)
                  if (import.meta.env.DEV) {
                    console.log(`[GlyphItem] ${glyphName} (${uuid}): self render completed`, {
                      hasRendered: hasRendered.value,
                      hasContent: CanvasManager.hasContent(canvasRef.value),
                    })
                  }
                }
    isInitialized.value = true
              })
            }
          }
        }, 500) // 增加延迟时间，确保 VirtualGlyphList 有足够时间渲染
      }
    })
  })
})

// 使用定时器定期检查 canvas 内容（用于检测 VirtualGlyphList 是否已经渲染）
let contentCheckTimer: number | null = null
const startContentCheck = () => {
  if (contentCheckTimer) return
  
  const glyphUUID = props.glyph.uuid
  const glyphName = props.glyph.name
  
  if (import.meta.env.DEV) {
    console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): startContentCheck`)
  }
  
  contentCheckTimer = window.setInterval(() => {
    if (!canvasRef.value) {
      if (contentCheckTimer) {
        clearInterval(contentCheckTimer)
        contentCheckTimer = null
      }
      return
    }
    
    try {
      const hasContent = CanvasManager.hasContent(canvasRef.value!)
      const canSkip = CanvasManager.canSkipRender(canvasRef.value!, glyphUUID)
      
      if (import.meta.env.DEV && (hasContent || canSkip || isInitialized.value)) {
        console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): contentCheck`, {
          hasContent,
          canSkip,
          isInitialized: isInitialized.value,
          hasRendered: hasRendered.value,
        })
      }
      
      // 如果 canvas 有内容或可以跳过渲染，说明已经渲染过了
      if (hasContent || canSkip) {
        hasRendered.value = true
        isInitialized.value = true
        if (import.meta.env.DEV) {
          console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): contentCheck detected render, updated state`)
        }
        if (contentCheckTimer) {
          clearInterval(contentCheckTimer)
          contentCheckTimer = null
        }
        return
      }
      
      // 如果已经初始化，但 canvas 没有内容，说明渲染完成但没有内容
      // 这时应该停止检查
      if (isInitialized.value) {
        if (import.meta.env.DEV) {
          console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): contentCheck stopped (initialized but no content)`)
        }
        if (contentCheckTimer) {
          clearInterval(contentCheckTimer)
          contentCheckTimer = null
        }
      }
    } catch (error) {
      // 忽略错误
    }
  }, 100) // 每 100ms 检查一次
  
  // 最多检查 5 秒
  setTimeout(() => {
    if (contentCheckTimer) {
      clearInterval(contentCheckTimer)
      contentCheckTimer = null
    }
    // 如果超时还没初始化，标记为已初始化（避免一直显示红线）
    if (!isInitialized.value) {
      isInitialized.value = true
      if (import.meta.env.DEV) {
        console.log(`[GlyphItem] ${glyphName} (${glyphUUID}): contentCheck timeout, marked as initialized`)
      }
    }
  }, 5000)
}

// 监听字形变化
watch(() => props.glyph, (newGlyph, oldGlyph) => {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const uuid = newGlyph.uuid
  
  // 如果Canvas已有内容且缓存存在，且内容未变化，直接跳过
  if (oldGlyph && newGlyph.uuid === oldGlyph.uuid) {
    // UUID相同，检查内容是否变化
    const contentChanged =
      newGlyph.name !== oldGlyph.name ||
      (newGlyph.components?.length || 0) !== (oldGlyph.components?.length || 0) ||
      newGlyph.previewRef !== oldGlyph.previewRef
    
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
    // 新字形（UUID不同），检查是否可以跳过
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
}, { deep: false }) // 使用shallow watch，只在引用变化时触发

onUnmounted(() => {
  // 清理定时器
  if (contentCheckTimer) {
    clearInterval(contentCheckTimer)
    contentCheckTimer = null
  }
  
  // 清理状态
  isInitialized.value = false
  hasRendered.value = false
  
  // 释放Canvas缓存（但保留DOM元素，因为虚拟滚动可能会复用）
  // 注意：这里不删除，因为VirtualGlyphList会统一管理清理
  // 但需要清理 ref，避免内存泄漏
  if (canvasRef.value) {
    // 不删除 canvas，只清理引用
    canvasRef.value = undefined as any
  }
})
</script>

<style scoped>
.glyph {
  width: 86px;
  height: 112px;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: var(--primary-0);
  border: 3px solid var(--primary-0);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.glyph:hover {
  border-color: var(--primary-0);
}

.glyph .preview {
  flex: 0 0 80px;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: white;
}

.glyph .preview .empty-line-1,
.glyph .preview .empty-line-2 {
  position: absolute;
  width: 100%;
  height: 2px;
  background-color: red;
  z-index: 1;
}

.glyph .preview .empty-line-1 {
  top: 50%;
  left: 0;
  transform: translateY(-50%) rotate(45deg);
}

.glyph .preview .empty-line-2 {
  top: 50%;
  left: 0;
  transform: translateY(-50%) rotate(-45deg);
}

.glyph .preview .preview-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.glyph .info {
  /* flex: 0 0 32px; */
  height: 32px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--primary-0);
  color: var(--light-0);
  font-size: 12px;
}

.glyph .info .name {
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.glyph .icon-group {
  display: none;
  position: absolute;
  right: 5px;
  top: 5px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  z-index: 10;
  padding: 2px;
}

.glyph:hover .icon-group {
  display: flex;
}

.delete-icon,
.copy-icon,
.edit-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--primary-0);
  color: white;
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.delete-icon:hover,
.copy-icon:hover,
.edit-icon:hover {
  background-color: var(--primary-1);
}

.delete-icon svg,
.copy-icon svg,
.edit-icon svg {
  width: 14px;
  height: 14px;
  color: white;
}
</style>
