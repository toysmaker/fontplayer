<template>
  <div class="glyph-editor">
    <!-- 工具栏 -->
    <header class="toolbar-wrapper">
      <ToolBar />
    </header>
    
    <!-- 主内容区 -->
    <main class="editor-content-wrapper">
      <!-- 左侧面板 -->
      <aside class="left-panel-wrapper">
        <div class="left-panel-content">
          <GlyphComponentList />
        </div>
      </aside>
      
      <!-- 中间 Canvas 区域 -->
      <main class="main-wrapper">
        <!-- FilesBar（编辑模式） -->
        <header class="files-bar-wrapper">
          <EditFilesBar />
        </header>
        <div class="canvas-panel-wrapper">
          <div class="edit-canvas-wrapper">
            <canvas
              ref="canvasRef"
              class="editor-canvas"
              :class="{
                'edit-canvas-panel': true,
              }"
              :style="{
                'transform': editingGlyph ? `translate3d(${editingGlyph.view.translateX}px, ${editingGlyph.view.translateY}px, 0px)` : 'none',
              }"
              :width="canvasWidth"
              :height="canvasHeight"
            />
          </div>
        </div>
        <!-- 底部栏（在 main-wrapper 内部，卡在左边栏和右边栏中间） -->
        <footer class="bottom-bar-wrapper">
          <BottomBar />
        </footer>
      </main>
      
      <!-- 右侧面板 -->
      <aside class="right-panel-wrapper">
        <RightPanel />
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { NCard, NEmpty } from 'naive-ui'
import { useGlyphStore } from '@/stores/glyph'
import { getOrCreateDragger } from '@/features/tools/glyphDragger'
import type { BaseGlyphDragger } from '@/features/tools/glyphDragger'
import ToolBar from '@/ui/components/ToolBar/ToolBar.vue'
import GlyphComponentList from '@/ui/components/ComponentList/GlyphComponentList.vue'
import RightPanel from '@/ui/components/RightPanel/RightPanel.vue'
import BottomBar from '@/ui/components/BottomBar/BottomBar.vue'
import EditFilesBar from '@/ui/components/FilesBar/EditFilesBar.vue'
import type { ICustomGlyph } from '@/core/types'
import { render } from '@/core/canvas/EditorCanvasRenderer'
import { mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { BackgroundType, GridType } from '@/core/canvas/types'
import type { IBackground, IGrid } from '@/core/canvas/types'
import { renderJoints, renderRefLines } from '@/core/script/Joint'
import { useEditorStore } from '@/stores/editor'
import { fontRenderStyle } from '@/core/script/globals'
import { bottomBarToolManager } from '@/features/bottomBar/BottomBarToolManager'
import { useBottomBarToolStore } from '@/stores/bottomBarTool'

const glyphStore = useGlyphStore()
const editorStore = useEditorStore()
const bottomBarToolStore = useBottomBarToolStore()
const canvasRef = ref<HTMLCanvasElement>()
let dragger: BaseGlyphDragger | null = null

const selectedComponent = computed(() => glyphStore.selectedComponent)
const editingGlyph = computed(() => glyphStore.editingGlyph)

// Canvas 尺寸（字形编辑界面使用默认尺寸）
const defaultUnitsPerEm = 1000
const canvasWidth = computed(() => mapCanvasWidth(defaultUnitsPerEm))
const canvasHeight = computed(() => mapCanvasHeight(defaultUnitsPerEm))

// Canvas 显示尺寸（固定为 500，与原工程一致）
const displayWidth = computed(() => 500)
const displayHeight = computed(() => 500)

// 默认背景和网格配置
const defaultBackground: IBackground = {
  type: BackgroundType.Transparent,
  color: '#FFFFFF'
}

const defaultGrid: IGrid = {
  type: GridType.None,
  precision: 20
}

// 渲染画布
const renderCanvas = async () => {
  if (!canvasRef.value || !editingGlyph.value) return
  
  await render(canvasRef.value, true, false, {
    mode: 'glyph',
    glyph: editingGlyph.value,
    background: defaultBackground,
    grid: defaultGrid,
  })
  
  // 渲染关键点和辅助线（在主要渲染之后）
  // 如果当前选中的组件被设置为不可见（visible === false），则不渲染其关键点和辅助线
  if (editorStore.checkJoints || editorStore.checkRefLines) {
    const selectedComponent = glyphStore.selectedComponent
    if (
      selectedComponent &&
      selectedComponent.type === 'glyph' &&
      selectedComponent.visible !== false
    ) {
      if (editorStore.checkJoints) {
        renderJoints(selectedComponent, canvasRef.value)
      }
      if (editorStore.checkRefLines) {
        renderRefLines(selectedComponent, canvasRef.value)
      }
    }
  }
}

// 初始化拖拽器
const initDragger = () => {
  if (!canvasRef.value || !glyphStore.editingGlyph) {
    cleanupDragger()
    return
  }

  const glyph = glyphStore.editingGlyph
  const component = glyphStore.selectedComponent
  
  // 如果没有选中组件，不初始化拖拽器
  if (!component) {
    cleanupDragger()
    return
  }

  try {
    dragger = getOrCreateDragger(canvasRef.value, 'glyph', {
      canvas: canvasRef.value,
      context: {
        mode: 'glyph',
        component,
        componentUUID: component.uuid, // 组件的 UUID，用作 instanceKey
        glyph,
        selectedComponentsTree: glyphStore.selectedComponentsTree,
      },
      onRender: () => {
        // TODO: 触发渲染
      },
      onUpdate: (comp) => {
        glyphStore.updateComponent(comp.uuid, comp)
      },
      glyphStore: glyphStore, // 传递store实例
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

onMounted(async () => {
  // 如果还没有设置编辑字形，从 UUID 设置
  if (glyphStore.editingGlyphUUID && !glyphStore.editingGlyph) {
    await glyphStore.setEditGlyphByUUID(glyphStore.editingGlyphUUID, glyphStore.glyphCategory)
  }
  
  // 等待 nextTick 确保 editingGlyph 已设置
  await nextTick()
  
  // 初始化画布尺寸
  if (canvasRef.value && editingGlyph.value) {
    // 设置 canvas 的实际尺寸（用于渲染，高分辨率）
    canvasRef.value.width = canvasWidth.value
    canvasRef.value.height = canvasHeight.value
    
    // 设置 canvas 的显示尺寸（CSS style，固定 500px * zoom）
    const zoom = editingGlyph.value.view.zoom || 100
    const styleWidth = displayWidth.value * zoom / 100
    const styleHeight = displayHeight.value * zoom / 100
    canvasRef.value.style.width = `${styleWidth}px`
    canvasRef.value.style.height = `${styleHeight}px`
  }
  
  // 初始渲染
  await renderCanvas()
  
  initDragger()

  // 注册 canvas 到 BottomBarToolManager（如果 coordsViewer 已激活）
  if (canvasRef.value && bottomBarToolStore.currentTool === 'coordsViewer') {
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, true)
  }
})

onUnmounted(() => {
  cleanupDragger()
  // 清理 BottomBarToolManager
  bottomBarToolManager.cleanup()
  // 退出编辑时，将编辑字形的数据同步回列表
  if (glyphStore.editingGlyphUUID) {
    glyphStore.updateGlyphListFromEditFile()
    glyphStore.resetEditGlyph()
  }
})

// 监听编辑字形变化
watch(() => glyphStore.editingGlyph, async () => {
  cleanupDragger()
  await nextTick()
  
  // 更新 canvas 显示尺寸
  if (canvasRef.value && editingGlyph.value) {
    const zoom = editingGlyph.value.view.zoom || 100
    const styleWidth = displayWidth.value * zoom / 100
    const styleHeight = displayHeight.value * zoom / 100
    canvasRef.value.style.width = `${styleWidth}px`
    canvasRef.value.style.height = `${styleHeight}px`
  }
  
  // 重新渲染画布
  await renderCanvas()
  
  initDragger()

  // 如果 coordsViewer 已激活，重新注册 canvas
  if (canvasRef.value && bottomBarToolStore.currentTool === 'coordsViewer') {
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, true)
  }
})

// 监听 zoom 变化，更新 canvas 显示尺寸
watch(() => editingGlyph.value?.view?.zoom, (newZoom) => {
  if (canvasRef.value && editingGlyph.value) {
    const zoom = newZoom || 100
    const styleWidth = displayWidth.value * zoom / 100
    const styleHeight = displayHeight.value * zoom / 100
    canvasRef.value.style.width = `${styleWidth}px`
    canvasRef.value.style.height = `${styleHeight}px`
  }
})

// 监听 bottomBarTool 变化，激活/停用 coordsViewer
watch(() => bottomBarToolStore.currentTool, (newTool) => {
  if (!canvasRef.value) return
  
  if (newTool === 'coordsViewer') {
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, true)
  } else {
    // 如果当前管理器中的工具是 coordsViewer，但新工具不是，则停用
    const currentTool = bottomBarToolManager.getCurrentTool()
    if (currentTool === 'coordsViewer') {
      bottomBarToolManager.deactivateCoordsViewer()
    }
  }
})

// 监听组件列表变化，重新渲染
watch(() => glyphStore.orderedListWithItemsForCurrentGlyph, async () => {
  await renderCanvas()
}, { deep: true })

// 监听选中组件变化
watch(() => glyphStore.selectedComponent, () => {
  cleanupDragger()
  nextTick(() => {
    initDragger()
  })
})

// 监听关键点和辅助线显示状态变化，重新渲染
watch([() => editorStore.checkJoints, () => editorStore.checkRefLines], async () => {
  await renderCanvas()
})

// 监听渲染样式变化，重新渲染
watch(() => fontRenderStyle.value, async () => {
  await renderCanvas()
})

// 注意：鼠标事件由 dragger 的 activate() 方法自动处理
// 不需要在模板中手动绑定 @mousedown, @mousemove, @mouseup
</script>

<style scoped>
.glyph-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar-wrapper {
  flex: 0 0 50px;
  box-sizing: border-box;
}

.editor-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: row;
  height: 0; /* 配合 flex: 1 使用 */
  overflow: hidden;
}

.left-panel-wrapper {
  height: 100%;
  flex: 0 0 200px;
  border-right: 1px solid var(--dark-4);
  background-color: var(--dark-0);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.left-panel-content {
  flex: 1;
  overflow: hidden;
  height: 0;
  display: flex;
  flex-direction: column;
}

.main-wrapper {
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.files-bar-wrapper {
  flex: 0 0 36px;
  border-bottom: 1px solid var(--dark-4);
  background-color: white;
}

.canvas-panel-wrapper {
  flex: 1;
  overflow: hidden;
}

.edit-canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--dark-1);
}

.editor-canvas {
  position: absolute;
  /* cursor: crosshair; */
}

.right-panel-wrapper {
  height: 100%;
  flex: 0 0 300px;
  border-left: 1px solid var(--dark-4);
  background-color: white;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.parameter-panel-card {
  flex: 1;
  overflow-y: auto;
  height: 100%;
}

.bottom-bar-wrapper {
  flex: 0 0 36px;
  border-top: 1px solid var(--dark-4);
  background-color: white;
}

</style>
