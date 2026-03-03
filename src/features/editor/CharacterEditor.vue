<template>
  <div class="character-editor">
    <div class="editor-canvas-wrapper">
      <canvas
        ref="canvasRef"
        class="editor-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
      />
    </div>
    <div class="right-panel">
      <!-- 组件列表 -->
      <n-card title="组件列表" class="component-list-card">
        <n-list>
          <n-list-item
            v-for="component in components"
            :key="component.uuid"
            :class="{ 'selected': component.uuid === characterStore.selectedComponentUUID }"
            @click="handleComponentClick(component)"
          >
            <n-thing :title="component.name || component.type" />
          </n-list-item>
        </n-list>
      </n-card>
      
      <!-- 参数编辑面板 -->
      <n-card v-if="selectedComponent" title="参数编辑" class="parameter-panel-card">
        <ParameterEditor :component="selectedComponent" />
      </n-card>
      <n-card v-else title="提示" class="parameter-panel-card">
        <n-empty description="请选择一个组件进行编辑" />
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { NCard, NList, NListItem, NThing, NEmpty } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import { getOrCreateDragger } from '@/features/tools/glyphDragger'
import type { BaseGlyphDragger } from '@/features/tools/glyphDragger'
import ParameterEditor from '@/ui/components/ParameterEditor.vue'
import type { IComponent } from '@/core/types'

const characterStore = useCharacterStore()
const canvasRef = ref<HTMLCanvasElement>()
let dragger: BaseGlyphDragger | null = null

const selectedComponent = computed(() => characterStore.selectedComponent)

// 获取字符的所有组件（扁平化）
const components = computed(() => {
  const character = characterStore.editingCharacter
  if (!character) return []
  
  // 递归获取所有组件
  const flattenComponents = (comps: IComponent[]): IComponent[] => {
    const result: IComponent[] = []
    for (const comp of comps) {
      result.push(comp)
      // 如果是字形组件，递归获取子组件
      if (comp.type === 'glyph' && (comp.value as any).components) {
        result.push(...flattenComponents((comp.value as any).components))
      }
    }
    return result
  }
  
  return flattenComponents(character.components || [])
})

// 处理组件点击
const handleComponentClick = (component: IComponent) => {
  characterStore.selectComponent(component.uuid, [])
}

// 初始化拖拽器
const initDragger = () => {
  if (!canvasRef.value || !characterStore.editingCharacter) {
    cleanupDragger()
    return
  }

  const character = characterStore.editingCharacter
  const component = characterStore.selectedComponent
  
  // 如果没有选中组件，不初始化拖拽器
  if (!component) {
    cleanupDragger()
    return
  }

  try {
    dragger = getOrCreateDragger(canvasRef.value, 'character', {
      canvas: canvasRef.value,
      context: {
        mode: 'character',
        component,
        character,
        selectedComponentsTree: characterStore.selectedComponentsTree,
      },
      onRender: () => {
        // TODO: 触发渲染
      },
      onUpdate: (comp) => {
        characterStore.updateComponent(comp.uuid, comp)
      },
      characterStore: characterStore, // 传递store实例
    })

    dragger.activate()
  } catch (error) {
    console.error('Failed to initialize dragger:', error)
    cleanupDragger()
  }
}

// 清理拖拽器
const cleanupDragger = () => {
  if (dragger) {
    dragger.deactivate()
    dragger = null
  }
}

onMounted(() => {
  initDragger()
})

onUnmounted(() => {
  cleanupDragger()
})

// 监听编辑字符变化
watch(() => characterStore.editingCharacter, () => {
  cleanupDragger()
  nextTick(() => {
    initDragger()
  })
})

// 监听选中组件变化
watch(() => characterStore.selectedComponent, () => {
  cleanupDragger()
  nextTick(() => {
    initDragger()
  })
})

// 鼠标事件处理（由dragger内部处理，这里可以添加额外逻辑）
const handleMouseDown = () => {
  // dragger会处理拖拽逻辑
}

const handleMouseMove = () => {
  // dragger会处理拖拽逻辑
}

const handleMouseUp = () => {
  // dragger会处理拖拽逻辑
}

// Canvas点击事件（用于选择组件）
const handleCanvasClick = (e: MouseEvent) => {
  // TODO: 实现组件选择逻辑
  // 1. 计算点击位置
  // 2. 查找被点击的组件
  // 3. 更新selectedComponent
  console.log('Canvas clicked:', e)
}
</script>

<style scoped>
.character-editor {
  width: 100%;
  height: 100%;
  display: flex;
}

.editor-canvas-wrapper {
  flex: 1;
  overflow: hidden;
}

.editor-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.right-panel {
  width: 300px;
  border-left: 1px solid var(--n-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.component-list-card {
  flex: 1;
  overflow-y: auto;
  border-bottom: 1px solid var(--n-border-color);
}

.parameter-panel-card {
  flex: 1;
  overflow-y: auto;
}

.n-list-item {
  cursor: pointer;
  padding: 8px;
}

.n-list-item.selected {
  background-color: var(--n-color-hover);
}

.n-list-item:hover {
  background-color: var(--n-color-hover);
}
</style>
