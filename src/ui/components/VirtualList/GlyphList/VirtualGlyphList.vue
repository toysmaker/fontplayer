<template>
  <div ref="containerRef" class="virtual-glyph-list" @scroll="handleScroll">
    <div
      class="virtual-list-spacer"
      :style="{ height: `${totalHeight}px` }"
    />
    <div
      class="virtual-list-content"
      :style="{ transform: `translateY(${offsetY}px)` }"
    >
      <!-- Vue 3 会智能复用相同 key 的组件，减少DOM操作 -->
      <div
        v-for="item in visibleItems"
        :key="item.uuid"
        :ref="el => setItemRef(el, item.uuid)"
        class="glyph-item"
        @click="handleItemClick(item)"
        @pointerup="handleItemClick(item)"
      >
        <GlyphItem :glyph="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { ICustomGlyph } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useGlyphStore } from '@/stores/glyph'
import GlyphItem from './GlyphItem.vue'
import { throttle } from '@/utils/performance'
import { EditStatus } from '@/core/types'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { CanvasManager } from '@/core/canvas/CanvasManager'
import { createDebouncedHandler } from '@/utils/debounce-click'

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const glyphStore = useGlyphStore()

// 渲染队列和缓存
const renderQueue = ref<string[]>([])
const renderCache = new Set<string>()
const isRendering = ref(false)

// Props
const props = defineProps<{
  itemHeight?: number
  itemWidth?: number
  gap?: number
  padding?: number
  overscan?: number
  glyphType?: 'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'
}>()

// 配置
const itemHeight = props.itemHeight || 112 // 字符项高度：80px preview + 32px info
const itemWidth = props.itemWidth || 86 // 字符项宽度：80px + 3px border * 2
const gap = props.gap || 10 // 网格间距
const padding = props.padding || 10 // 容器内边距
const overscan = props.overscan || 2 // 预加载的行数

// Refs
const containerRef = ref<HTMLElement>()
const itemRefs = new Map<string, HTMLElement>()

// 状态
const scrollTop = ref(0)
const containerHeight = ref(0)
const containerWidth = ref(0)
const lastVisibleStart = ref(0)
const lastVisibleEnd = ref(0)

// 字形列表
const glyphList = computed(() => {
  const selectedFile = projectStore.selectedFile
  if (!selectedFile) return []
  
  const glyphType = props.glyphType || 'glyphs'
  return selectedFile[glyphType] || []
})

// 计算每行字符数（响应式，参考原工程的容错机制）
const colsPerRow = computed(() => {
  if (containerWidth.value <= 0) return 1
  // 可用宽度 = 容器宽度 - 左右内边距
  const availableWidth = containerWidth.value - padding * 2
  // 每行字符数 = 可用宽度 / (字符宽度 + 间距)
  // 使用 Math.ceil 计算理论值，然后减1作为容错（因为 Grid 可能不会完全占满）
  const theoreticalCols = Math.ceil(availableWidth / (itemWidth + gap))
  const cols = Math.max(1, theoreticalCols - 1) // 减少1个作为容错，至少1列
  return cols
})

// 计算总行数
const totalRows = computed(() => {
  if (glyphList.value.length === 0) return 0
  return Math.ceil(glyphList.value.length / colsPerRow.value)
})

// 计算行高（包括间距）
const rowHeight = computed(() => {
  return itemHeight + gap
})

// 计算可见范围（考虑网格布局）
const visibleRange = computed(() => {
  if (containerHeight.value <= 0 || containerWidth.value <= 0) {
    return { start: 0, end: Math.min(overscan * colsPerRow.value, glyphList.value.length) }
  }
  
  // 计算可见的行范围
  const startRow = Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - overscan)
  const endRow = Math.min(
    totalRows.value,
    Math.ceil((scrollTop.value + containerHeight.value) / rowHeight.value) + overscan
  )
  
  // 计算可见的字形范围
  const start = Math.max(0, startRow * colsPerRow.value)
  const end = Math.min(
    glyphList.value.length,
    endRow * colsPerRow.value
  )
  
  return { start, end }
})

// 可见项（使用ref优化，减少数组重建）
const visibleItems = ref<ICustomGlyph[]>([])

// 更新可见项（使用更智能的更新策略，减少DOM操作）
const updateVisibleItems = async () => {
  const { start, end } = visibleRange.value
  const newGlyphs = glyphList.value.slice(start, end)
  
  // 计算新旧UUID集合
  const currentUUIDs = new Set(visibleItems.value.map(item => item.uuid))
  const newUUIDs = new Set(newGlyphs.map(item => item.uuid))
  
  // 如果UUID集合完全相同，不需要更新（避免不必要的DOM diff）
  if (currentUUIDs.size === newUUIDs.size && 
      [...currentUUIDs].every(uuid => newUUIDs.has(uuid)) &&
      visibleItems.value.length === newGlyphs.length) {
    // 检查顺序是否相同
    let orderChanged = false
    for (let i = 0; i < visibleItems.value.length; i++) {
      if (visibleItems.value[i].uuid !== newGlyphs[i].uuid) {
        orderChanged = true
        break
      }
    }
    if (!orderChanged) {
      return // 完全没变化，跳过更新
    }
  }
  
  // 范围变化检测
  const rangeChanged = 
    Math.abs(start - lastVisibleStart.value) > overscan ||
    Math.abs(end - lastVisibleEnd.value) > overscan
  
  if (rangeChanged) {
    lastVisibleStart.value = start
    lastVisibleEnd.value = end
  }
  
  // 更新数组（Vue会智能diff，只更新变化的项）
  visibleItems.value = newGlyphs
}

// 监听可见范围变化（使用防抖，减少更新频率）
let updateTimer: number | null = null
watch(visibleRange, () => {
  // 清除之前的定时器
  if (updateTimer !== null) {
    cancelAnimationFrame(updateTimer)
  }
  
  // 使用 requestAnimationFrame 批量更新，避免频繁DOM操作
  updateTimer = requestAnimationFrame(() => {
    updateVisibleItems()
    updateTimer = null
  })
}, { immediate: true })

// 总高度（考虑网格布局）
const totalHeight = computed(() => {
  if (totalRows.value === 0) return 0
  // 总高度 = 行数 * 行高 - 最后一行不需要间距
  return totalRows.value * rowHeight.value - gap + padding * 2
})

// 偏移量（考虑网格布局）
const offsetY = computed(() => {
  const startRow = Math.floor(visibleRange.value.start / colsPerRow.value)
  return startRow * rowHeight.value + padding
})

// 设置项引用
const setItemRef = (el: any, uuid: string) => {
  if (el) {
    // Vue 3 ref 可能返回 Element 或 ComponentPublicInstance
    // 需要提取实际的 DOM 元素
    const element = el instanceof HTMLElement ? el : (el.$el || el) as HTMLElement
    if (element instanceof HTMLElement) {
      itemRefs.set(uuid, element)
    }
  } else {
    itemRefs.delete(uuid)
  }
}

// 滚动清理的节流（避免频繁清理）
let scrollCleanupTimer: number | null = null
let lastScrollCleanupTime = 0
const SCROLL_CLEANUP_INTERVAL = 500 // 滚动时每500ms最多清理一次

const scrollCleanupThrottle = () => {
  const now = Date.now()
  if (now - lastScrollCleanupTime < SCROLL_CLEANUP_INTERVAL) {
    return // 节流：太频繁了，跳过
  }
  lastScrollCleanupTime = now
  
  // 清理不可见的缓存
  const visibleUUIDs = new Set(visibleItems.value.map(item => item.uuid))
  const fileUUID = projectStore.selectedFile?.uuid
  
  // 清理 Canvas 缓存
  CanvasManager.cleanupInvisible(visibleUUIDs)
  
  // 字形列表不需要字符数据缓存清理
}

// 节流的滚动处理（减少更新频率）
const handleScroll = throttle((e: Event) => {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
  
  // 滚动时延迟清理（节流，避免频繁清理）
  if (scrollCleanupTimer !== null) {
    cancelAnimationFrame(scrollCleanupTimer)
  }
  scrollCleanupTimer = requestAnimationFrame(() => {
    scrollCleanupThrottle()
    scrollCleanupTimer = null
  })
}, 16) // 约60fps

// 处理项点击
const _handleItemClick = (glyph: ICustomGlyph) => {
  // 触发字形编辑
  // 先设置 glyphCategory，确保在进入编辑模式前知道来源
  const category = props.glyphType || 'glyphs'
  glyphStore.glyphCategory = category
  // 设置编辑字形（深拷贝，与列表分离）
  glyphStore.setEditGlyphByUUID(glyph.uuid, category)
  // 确保在切换状态前，当前状态是列表状态（用于保存 prevStatus）
  // setEditStatus 会自动保存当前的列表状态到 prevStatus
  editorStore.setEditStatus(EditStatus.Glyph)
}

// 使用防重复调用包装，通过UUID区分不同的项
const handleItemClick = createDebouncedHandler(
  _handleItemClick,
  'VirtualGlyphList.itemClick',
  (args) => args[0].uuid // 使用UUID作为比较参数
)

// 更新容器尺寸
const updateContainerSize = () => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
    containerWidth.value = containerRef.value.clientWidth
  }
}

// 监听窗口大小变化
let resizeObserver: ResizeObserver | null = null

// 定期清理机制（使用 requestIdleCallback）
let periodicCleanupTimer: number | null = null
const schedulePeriodicCleanup = () => {
  if (periodicCleanupTimer !== null) {
    cancelIdleCallback(periodicCleanupTimer)
  }
  
  if ('requestIdleCallback' in window) {
    periodicCleanupTimer = requestIdleCallback(() => {
      const visibleUUIDs = new Set(visibleItems.value.map(item => item.uuid))
      const fileUUID = projectStore.selectedFile?.uuid
      
      // 清理不可见的缓存
      CanvasManager.cleanupInvisible(visibleUUIDs)
      
      // 如果缓存仍然很大，强制清理
      if (CanvasManager.getCacheSize() > 30 || CanvasManager.getCanvasMapSize() > 100) {
        CanvasManager.forceCleanupAllCache()
      }
      
      periodicCleanupTimer = null
      // 每3秒清理一次（更频繁的清理，减少内存占用）
      setTimeout(() => schedulePeriodicCleanup(), 3000)
    }, { timeout: 1000 })
  } else {
    // 降级到 setTimeout
    periodicCleanupTimer = setTimeout(() => {
      const visibleUUIDs = new Set(visibleItems.value.map(item => item.uuid))
      const fileUUID = projectStore.selectedFile?.uuid
      
      CanvasManager.cleanupInvisible(visibleUUIDs)
      
      periodicCleanupTimer = null
      schedulePeriodicCleanup()
    }, 3000) as any
  }
}

onMounted(() => {
  updateContainerSize()
  
  if (containerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerSize()
    })
    resizeObserver.observe(containerRef.value)
  }
  
  // 启动定期清理
  schedulePeriodicCleanup()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  
  // 清理所有渲染相关的资源
  renderQueue.value = []
  renderCache.clear()
  isRendering.value = false
  
  // 清理所有缓存
  const visibleUUIDs = new Set<string>()
  const fileUUID = projectStore.selectedFile?.uuid
  
  // 清理 Canvas 缓存
  CanvasManager.cleanupInvisible(visibleUUIDs)
  CanvasManager.forceCleanupAllCache()
  
  // 字形列表不需要字符数据缓存清理
  
  // 清理定时器
  if (updateTimer !== null) {
    cancelAnimationFrame(updateTimer)
    updateTimer = null
  }
  if (renderTimer !== null) {
    cancelAnimationFrame(renderTimer)
    renderTimer = null
  }
  if (scrollCleanupTimer !== null) {
    cancelAnimationFrame(scrollCleanupTimer)
    scrollCleanupTimer = null
  }
  if (periodicCleanupTimer !== null) {
    if ('cancelIdleCallback' in window) {
      cancelIdleCallback(periodicCleanupTimer)
    } else {
      clearTimeout(periodicCleanupTimer)
    }
    periodicCleanupTimer = null
  }
})

// 监听字形列表变化（使用 shallow watch，避免深度监听大数组）
// 只在引用变化时触发，而不是内容变化
watch(glyphList, (newList, oldList) => {
  console.log('glyphList changed', newList, oldList)
  // 只在列表引用真正变化时处理（比如切换文件）
  // 避免在加载过程中频繁触发
  if (newList !== oldList && newList.length > 0) {
    updateContainerSize()
    // 延迟处理，确保文件加载完成后再渲染
    nextTick(() => {
      console.log('projectStore.loading', projectStore.loading)
      // 只在文件加载完成后才清空缓存和触发渲染
      // 检查是否还在加载中
      if (!projectStore.loading) {
        console.log('render queue')
        renderCache.clear()
        renderQueue.value = []
        scheduleRender()
      }
    })
  }
}, { immediate: false }) // 改为 immediate: false，避免初始化时触发

// 监听可见项变化，触发渲染（延迟处理，避免在文件加载时触发）
let renderTimer: number | null = null
let lastCleanupTime = 0
const CLEANUP_INTERVAL = 2000 // 每2秒最多清理一次（减少清理频率，避免清空刚渲染的内容）

watch(visibleItems, () => {
  // 如果文件还在加载中，延迟渲染
  if (projectStore.loading) {
    return
  }
  
  // 清除之前的定时器
  if (renderTimer !== null) {
    cancelAnimationFrame(renderTimer)
  }
  
  // 延迟调度渲染，避免频繁触发
  renderTimer = requestAnimationFrame(() => {
    scheduleRender()
    
    // 延迟清理：等待渲染完成后再清理（避免清空刚渲染的内容）
    setTimeout(() => {
      // 节流清理：每2秒最多清理一次，避免频繁清理导致性能问题
      const now = Date.now()
      if (now - lastCleanupTime > CLEANUP_INTERVAL) {
        const visibleUUIDs = new Set(visibleItems.value.map(item => item.uuid))
        const fileUUID = projectStore.selectedFile?.uuid
        
        // 清理 Canvas 缓存
        CanvasManager.cleanupInvisible(visibleUUIDs)
        
        // 字形列表不需要字符数据缓存清理
        
        lastCleanupTime = now
      }
    }, 500) // 延迟 500ms，确保渲染完成
    
    renderTimer = null
  })
}, { deep: false }) // 使用shallow watch，避免深度监听导致的性能问题

// 调度渲染（只渲染可见项中未渲染的）
const scheduleRender = () => {
  // 如果文件还在加载中，不进行渲染
  if (projectStore.loading) {
    return
  }
  
  if (isRendering.value) return
  
  const visible = visibleItems.value
  const newItems: string[] = []
  
  for (const item of visible) {
    const cacheKey = `${item.uuid}_rendered`
    if (!renderCache.has(cacheKey) && !renderQueue.value.includes(item.uuid)) {
      newItems.push(item.uuid)
    }
  }

  console.log('newItems', newItems)
  
  if (newItems.length > 0) {
    renderQueue.value.push(...newItems)
    processRenderQueue()
  }
}

// 处理渲染队列
const processRenderQueue = async () => {
  if (isRendering.value || renderQueue.value.length === 0) return
  
  isRendering.value = true
  
  try {
    const glyphs = glyphList.value
    const fontSettings = projectStore.selectedFile?.fontSettings
    let processed = 0
    const maxBatch = 5 // 每批处理5个
    
    while (renderQueue.value.length > 0 && processed < maxBatch) {
      const uuid = renderQueue.value.shift()!
      
      // 从可见项中查找字形
      const glyph: ICustomGlyph | null = visibleItems.value.find(g => g.uuid === uuid) || null
      
      if (!glyph) {
        continue
      }
      
      try {
        // 使用CanvasManager获取Canvas（支持缓存和复用）
        const canvas = CanvasManager.getCanvasFromDOM(uuid)
        if (!canvas) {
          // Canvas 还没创建，跳过（等待 GlyphItem 挂载）
          continue
        }
        
        // 注册到管理器（如果尚未注册）
        CanvasManager.registerCanvas(uuid, canvas)
        
        // 检查是否可以跳过渲染（缓存存在且Canvas已有内容）
        const canSkip = CanvasManager.canSkipRender(canvas, uuid)
        if (import.meta.env.DEV) {
          console.log(`[VirtualGlyphList] canSkipRender for ${uuid}:`, canSkip)
        }

        if (!canSkip) {
          if (import.meta.env.DEV) {
            console.log(`[VirtualGlyphList] renderPreview ${uuid}`)
          }
          await GlyphRenderer.renderPreview(canvas, glyph, fontSettings)
        }
        
        renderCache.add(`${uuid}_rendered`)
        processed++
      } catch (error) {
        console.error(`Error rendering glyph ${uuid}:`, error)
      }
      
      // 每处理一个就让出主线程
      if (processed > 0) {
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
    }
  } finally {
    isRendering.value = false
    
    // 如果队列中还有项目，继续处理
    if (renderQueue.value.length > 0) {
      requestAnimationFrame(() => processRenderQueue())
    }
  }
}
</script>

<style scoped>
.virtual-glyph-list {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background-color: var(--dark-1);
  padding: 10px;
}

.virtual-list-spacer {
  width: 100%;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, 86px);
  gap: 10px;
  /* 使用 will-change 提示浏览器优化 */
  will-change: transform;
  /* 使用 contain 隔离渲染，提升性能 */
  contain: layout style paint;
}

.glyph-item {
  width: 86px;
  /* 使用 will-change 提示浏览器优化 */
  will-change: transform;
  /* 使用 contain 隔离渲染，提升性能 */
  contain: layout style paint;
}
</style>
