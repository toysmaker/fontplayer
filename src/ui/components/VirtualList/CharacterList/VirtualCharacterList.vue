<template>
  <div ref="containerRef" class="virtual-character-list" @scroll="handleScroll">
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
        class="character-item"
        :style="{ height: `${itemHeight}px` }"
        @click="handleItemClick(item)"
      >
        <CharacterItem :character="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { ICharacterFileLite, ICharacterFileMetadata } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import CharacterItem from './CharacterItem.vue'
import { throttle } from '@/utils/performance'
import { EditStatus } from '@/core/types'
import { CharacterRenderer } from '@/core/font/CharacterRenderer'
import { CanvasManager } from '@/core/canvas/CanvasManager'
import { characterDataManager } from '@/core/storage/CharacterDataManager'

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const characterStore = useCharacterStore()

// 渲染队列和缓存
const renderQueue = ref<string[]>([])
const renderCache = new Set<string>()
const isRendering = ref(false)

// Props
const props = defineProps<{
  itemHeight?: number
  overscan?: number
}>()

// 配置
const itemHeight = props.itemHeight || 120
const overscan = props.overscan || 5

// Refs
const containerRef = ref<HTMLElement>()
const itemRefs = new Map<string, HTMLElement>()

// 状态
const scrollTop = ref(0)
const containerHeight = ref(0)
const lastVisibleStart = ref(0)
const lastVisibleEnd = ref(0)

// 字符列表（元数据）
const characterList = computed(() => {
  return projectStore.selectedFile?.characterList || []
})

// 加载完整字符数据的辅助函数
const loadFullCharacter = async (metadata: ICharacterFileMetadata): Promise<ICharacterFileLite | null> => {
  const fileUUID = projectStore.selectedFile?.uuid
  if (!fileUUID) return null
  return await characterDataManager.loadCharacter(fileUUID, metadata.uuid)
}

// 计算可见范围（使用节流优化）
const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan)
  const end = Math.min(
    characterList.value.length,
    Math.ceil((scrollTop.value + containerHeight.value) / itemHeight) + overscan
  )
  return { start, end }
})

// 可见项（使用ref优化，减少数组重建）
const visibleItems = ref<ICharacterFileLite[]>([])

// 组件实例缓存（用于复用组件，避免频繁创建/销毁）
const componentInstances = new Map<string, any>()

// 更新可见项（使用更智能的更新策略，减少DOM操作）
const updateVisibleItems = async () => {
  const { start, end } = visibleRange.value
  const newMetadata = characterList.value.slice(start, end)
  
  // 计算新旧UUID集合
  const currentUUIDs = new Set(visibleItems.value.map(item => item.uuid))
  
  // 加载新项的完整数据
  const newItems: ICharacterFileLite[] = []
  for (const metadata of newMetadata) {
    if (currentUUIDs.has(metadata.uuid)) {
      // 已存在，从当前列表获取
      const existing = visibleItems.value.find(item => item.uuid === metadata.uuid)
      if (existing) {
        newItems.push(existing)
      }
    } else {
      // 新项，从IndexedDB加载
      const fullCharacter = await loadFullCharacter(metadata)
      if (fullCharacter) {
        newItems.push(fullCharacter)
      } else {
        // 如果加载失败，使用元数据创建一个最小化的字符对象
        newItems.push({
          ...metadata,
          components: [],
          groups: [],
          orderedList: [],
          view: { zoom: 100, translateX: 0, translateY: 0 },
        } as ICharacterFileLite)
      }
    }
  }
  const newUUIDs = new Set(newItems.map(item => item.uuid))
  
  // 如果UUID集合完全相同，不需要更新（避免不必要的DOM diff）
  if (currentUUIDs.size === newUUIDs.size && 
      [...currentUUIDs].every(uuid => newUUIDs.has(uuid)) &&
      visibleItems.value.length === newItems.length) {
    // 检查顺序是否相同
    let orderChanged = false
    for (let i = 0; i < visibleItems.value.length; i++) {
      if (visibleItems.value[i].uuid !== newItems[i].uuid) {
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
  visibleItems.value = newItems
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

// 总高度
const totalHeight = computed(() => {
  return characterList.value.length * itemHeight
})

// 偏移量
const offsetY = computed(() => {
  return visibleRange.value.start * itemHeight
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

// 节流的滚动处理（减少更新频率）
const handleScroll = throttle((e: Event) => {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
}, 16) // 约60fps

// 处理项点击
const handleItemClick = (character: ICharacterFileLite) => {
  // 触发字符编辑
  characterStore.setEditingCharacter(character.uuid)
  editorStore.setEditStatus(EditStatus.Edit)
}

// 更新容器高度
const updateContainerHeight = () => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
  }
}

// 监听窗口大小变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateContainerHeight()
  
  if (containerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerHeight()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// 监听字符列表变化（使用 shallow watch，避免深度监听大数组）
// 只在引用变化时触发，而不是内容变化
watch(characterList, (newList, oldList) => {
  console.log('characterList changed', newList, oldList)
  // 只在列表引用真正变化时处理（比如切换文件）
  // 避免在加载过程中频繁触发
  if (newList !== oldList && newList.length > 0) {
    updateContainerHeight()
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
    // 清理不可见的Canvas缓存
    const visibleUUIDs = new Set(visibleItems.value.map(item => item.uuid))
    CanvasManager.cleanupInvisible(visibleUUIDs)
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
    const characters = characterList.value
    const fontSettings = projectStore.selectedFile?.fontSettings
    let processed = 0
    const maxBatch = 5 // 每批处理5个
    
    while (renderQueue.value.length > 0 && processed < maxBatch) {
      const uuid = renderQueue.value.shift()!
      
      // 从可见项中查找，如果不存在则从IndexedDB加载
      let character: ICharacterFileLite | null = visibleItems.value.find(c => c.uuid === uuid) || null
      if (!character) {
        const metadata = characters.find(c => c.uuid === uuid)
        if (metadata) {
          character = await loadFullCharacter(metadata)
        }
      }
      
      if (!character) {
        continue
      }
      
      try {
        // 使用CanvasManager获取Canvas（支持缓存和复用）
        const canvas = CanvasManager.getCanvasFromDOM(uuid)
        if (!canvas) {
          // Canvas 还没创建，跳过（等待 CharacterItem 挂载）
          continue
        }
        
        // 注册到管理器（如果尚未注册）
        CanvasManager.registerCanvas(uuid, canvas)
        
        // 检查是否可以跳过渲染（缓存存在且Canvas已有内容）
        const canSkip = CanvasManager.canSkipRender(canvas, uuid)
        if (import.meta.env.DEV) {
          console.log(`[VirtualCharacterList] canSkipRender for ${uuid}:`, canSkip)
        }

        if (!canSkip) {
          if (import.meta.env.DEV) {
            console.log(`[VirtualCharacterList] renderPreview ${uuid}`)
          }
          await CharacterRenderer.renderPreview(character, canvas, fontSettings)
        }
        
        renderCache.add(`${uuid}_rendered`)
        processed++
      } catch (error) {
        console.error(`Error rendering character ${uuid}:`, error)
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
.virtual-character-list {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.virtual-list-spacer {
  width: 100%;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.character-item {
  width: 100%;
  border-bottom: 1px solid var(--n-border-color);
  /* 使用 will-change 提示浏览器优化 */
  will-change: transform;
  /* 使用 contain 隔离渲染，提升性能 */
  contain: layout style paint;
}
</style>
