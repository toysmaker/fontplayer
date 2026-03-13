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
                'pen-on-edit': currentTool === 'pen',
                'rectangle-on-edit': currentTool === 'rectangle',
                'ellipse-on-edit': currentTool === 'ellipse',
                'polygon-on-edit': currentTool === 'polygon',
                'rotate-left-top': selectControl === 'rotate-left-top',
                'rotate-right-top': selectControl === 'rotate-right-top',
                'rotate-left-bottom': selectControl === 'rotate-left-bottom',
                'rotate-right-bottom': selectControl === 'rotate-right-bottom',
                'scale-left-top': selectControl === 'scale-left-top',
                'scale-right-top': selectControl === 'scale-right-top',
                'scale-left-bottom': selectControl === 'scale-left-bottom',
                'scale-right-bottom': selectControl === 'scale-right-bottom',
              }"
              :style="{
                'transform': editingGlyph ? `translate3d(${editingGlyph.view.translateX}px, ${editingGlyph.view.translateY}px, 0px)` : 'none',
              }"
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
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
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
import { toolManager, SelectTool, PenTool, PolygonTool, EllipseTool, RectangleTool } from '@/features/tools'
import { getCoord } from '@/features/tools/utils/coord'
import { useToolStore } from '@/stores/tool'
import type { ToolType } from '@/features/tools'

const glyphStore = useGlyphStore()
const editorStore = useEditorStore()
const bottomBarToolStore = useBottomBarToolStore()
const toolStore = useToolStore()
const canvasRef = ref<HTMLCanvasElement>()
let dragger: BaseGlyphDragger | null = null
let selectControlCheckInterval: number | null = null

const selectedComponent = computed(() => (glyphStore as any).selectedComponent)
const editingGlyph = computed(() => (glyphStore as any).editingGlyph)

// 当前工具和选择控制状态（用于鼠标样式）
const currentTool = ref<ToolType | ''>('')
const selectControl = ref<string>('null')

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
  
  const components = (glyphStore as any).orderedListWithItemsForCurrentGlyph
  
  // 获取 Canvas 的显示尺寸（CSS style）
  const computedStyle = window.getComputedStyle(canvasRef.value)
  const displayWidth = parseFloat(computedStyle.width) || 0
  const displayHeight = parseFloat(computedStyle.height) || 0
  const zoom = editingGlyph.value.view?.zoom || 100
  
  if (import.meta.env.DEV) {
    console.log('[GlyphEditor] Rendering canvas:', {
      componentsCount: components.length,
      canvasActualSize: { width: canvasRef.value.width, height: canvasRef.value.height },
      canvasDisplaySize: { width: displayWidth, height: displayHeight },
      canvasSizeRatio: { 
        widthRatio: canvasRef.value.width / (displayWidth || 1), 
        heightRatio: canvasRef.value.height / (displayHeight || 1) 
      },
      zoom: zoom,
      editingGlyphUUID: editingGlyph.value.uuid,
      editingGlyphName: editingGlyph.value.name,
      editingGlyphComponentsCount: editingGlyph.value.components?.length || 0,
      editingGlyphOrderedListCount: editingGlyph.value.orderedList?.length || 0,
      components: components
    })
  }
  
  await render(canvasRef.value, true, false, {
    mode: 'glyph',
    glyph: editingGlyph.value,
    components: components, // 传入组件列表，用于渲染字形内部的组件
    background: defaultBackground,
    grid: defaultGrid,
  })
  
  // 注意：render() 函数内部会检查实例状态并执行脚本（如果需要）
  // 如果脚本在 onMounted 中已执行，render() 会检测到实例已有 _components，不会重复执行
  
  // 渲染关键点和辅助线（在主要渲染之后）
  // 如果当前选中的组件被设置为不可见（visible === false），则不渲染其关键点和辅助线
  if (editorStore.checkJoints || editorStore.checkRefLines) {
    const selectedComponent = (glyphStore as any).selectedComponent
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
  
  // 渲染当前工具的额外内容（如选择框、工具预览等）
  if (canvasRef.value) {
    const toolRenderFn = toolManager.getCurrentToolRenderFunction()
    if (toolRenderFn) {
      toolRenderFn(canvasRef.value)
    }
  }
}

// 初始化拖拽器
const initDragger = () => {
  if (!canvasRef.value || !(glyphStore as any).editingGlyph) {
    cleanupDragger()
    return
  }

  const glyph = (glyphStore as any).editingGlyph
  const component = (glyphStore as any).selectedComponent
  
  // 如果没有选中组件，不初始化拖拽器
  if (!component) {
    cleanupDragger()
    return
  }

  // 如果是字形组件，确保使用最新的 component.value（从 store 中获取）
  // 因为字形实例的参数可能已经被修改，需要确保使用最新的数据
  let glyphValue = component.type === 'glyph' ? (component.value as any) : undefined
  if (component.type === 'glyph' && glyphValue) {
    // 从 store 中重新获取组件，确保使用最新的 value
    const latestComponent = (glyphStore as any).selectedComponent
    if (latestComponent && latestComponent.type === 'glyph' && latestComponent.value) {
      glyphValue = latestComponent.value
    }
  }

  try {
    dragger = getOrCreateDragger(canvasRef.value, 'glyph', {
      canvas: canvasRef.value,
      context: {
        mode: 'glyph',
        component,
        componentUUID: component.uuid, // 组件的 UUID，用作 instanceKey
        glyph: component.type === 'glyph' ? glyphValue : glyph,
        selectedComponentsTree: (glyphStore as any).selectedComponentsTree,
      },
      onRender: () => {
        // 拖拽骨架关键点后触发重新渲染
        renderCanvas()
      },
      onUpdate: (comp) => {
        ;(glyphStore as any).updateComponent(comp.uuid, comp)
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

// 初始化工具系统
const initTools = async () => {
  if (!canvasRef.value) return

  // 每次进入字形编辑界面时，重置所有工具的单例实例，确保绑定当前 canvas
  // 避免上一次编辑留下的实例仍然持有旧的 canvas 引用和配置，导致事件监听失效或调用错误的渲染函数
  try {
    SelectTool.reset()
    PenTool.reset()
    PolygonTool.reset()
    EllipseTool.reset()
    RectangleTool.reset()
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[GlyphEditor] initTools: tool reset failed (can be ignored in some environments)', e)
    }
  }
  // 同时清理 ToolManager 中已注册的旧工具
  toolManager.cleanupAll()
  
  const toolConfig = {
    canvas: canvasRef.value,
    mode: 'glyph' as const,
    getCoord: (coord: number) => {
      // 动态获取当前的 zoom 值
      const currentZoom = editingGlyph.value?.view?.zoom || 100
      return getCoord(coord, 'glyph', currentZoom)
    },
    onRender: () => {
      renderCanvas()
    },
  }
  
  // 创建并注册所有工具
  const selectTool = SelectTool.getInstance(canvasRef.value, toolConfig)
  await selectTool.init()
  toolManager.registerTool('select', selectTool)
  
  const penTool = PenTool.getInstance(canvasRef.value, toolConfig)
  await penTool.init()
  toolManager.registerTool('pen', penTool)
  
  const polygonTool = PolygonTool.getInstance(canvasRef.value, toolConfig)
  await polygonTool.init()
  toolManager.registerTool('polygon', polygonTool)
  
  const ellipseTool = EllipseTool.getInstance(canvasRef.value, toolConfig)
  await ellipseTool.init()
  toolManager.registerTool('ellipse', ellipseTool)
  
  const rectangleTool = RectangleTool.getInstance(canvasRef.value, toolConfig)
  await rectangleTool.init()
  toolManager.registerTool('rectangle', rectangleTool)
  
  // 默认激活选择工具
  if (toolStore.tool === '' || toolStore.tool === 'select') {
    await toolManager.switchTool('select')
  } else {
    await toolManager.switchTool(toolStore.tool as ToolType)
  }
}

// 清理工具系统
const cleanupTools = () => {
  toolManager.cleanupAll()
}

onMounted(async () => {
  // 如果还没有设置编辑字形，从 UUID 设置
  if ((glyphStore as any).editingGlyphUUID && !(glyphStore as any).editingGlyph) {
    await (glyphStore as any).setEditGlyphByUUID((glyphStore as any).editingGlyphUUID, (glyphStore as any).glyphCategory)
  }
  
  // 等待 nextTick 确保 editingGlyph 已设置
  await nextTick()
  
  // 确保字形实例已执行脚本（在初始渲染前，必须在 Canvas 尺寸设置之前）
  // 直接更新实例，确保使用最新的 editingGlyph.value 数据，避免缓存问题
  if (editingGlyph.value) {
    const instanceKey = editingGlyph.value.uuid
    
    if (import.meta.env.DEV) {
      console.log('[GlyphEditor.onMounted] Updating instance for editGlyph:', {
        instanceKey,
        glyphUUID: editingGlyph.value.uuid,
        glyphName: editingGlyph.value.name
      })
    }
    
    // 直接释放旧实例（如果存在），确保使用最新的 editingGlyph.value 数据
    // 这样可以避免从字符编辑界面创建的临时实例影响字形编辑界面
    if (instanceManager.isTemporary(instanceKey)) {
      instanceManager.releaseTemporaryInstance(instanceKey)
    }
    // 释放旧实例（如果存在）
    if (instanceManager.isEditing(instanceKey)) {
      // 如果已经在编辑状态，先释放（releaseInstance 会从 editingUUIDs 中删除）
      instanceManager.releaseInstance(instanceKey)
    }
    
    // 重新标记为编辑状态
    instanceManager.markEditing(instanceKey)
    
    // 重新创建实例（使用最新的 editingGlyph.value 数据）
    const glyphInstance = instanceManager.getInstance(
      instanceKey,
      () => new CustomGlyph(editingGlyph.value!),
      'glyph'
    ) as CustomGlyph | null
    
    if (import.meta.env.DEV) {
      console.log('[GlyphEditor.onMounted] Instance created/updated:', {
        instanceKey,
        hasInstance: !!glyphInstance,
        componentsCount: glyphInstance?._components?.length || 0,
        isEditing: instanceManager.isEditing(instanceKey)
      })
    }
    
    // 执行脚本生成新的 _components（无论实例是否已有 _components，都重新执行以确保数据最新）
    if (import.meta.env.DEV) {
      console.log('[GlyphEditor.onMounted] Executing script for initial render:', {
        instanceKey,
        hasInstance: !!glyphInstance
      })
    }
    
    // 执行脚本
    executeGlyphScript(editingGlyph.value, instanceKey)
    
    // 等待脚本执行完成
    await nextTick()
    
    // 重新获取实例，确保获取到脚本执行后的最新状态
    const finalInstance = instanceManager.getInstance(
      instanceKey,
      () => new CustomGlyph(editingGlyph.value!),
      'glyph'
    ) as CustomGlyph | null
    
    if (import.meta.env.DEV && finalInstance) {
      console.log('[GlyphEditor.onMounted] After script execution:', {
        instanceKey,
        hasInstance: !!finalInstance,
        componentsCount: finalInstance._components?.length || 0,
        isEditing: instanceManager.isEditing(instanceKey),
        isTemporary: instanceManager.isTemporary(instanceKey),
        componentTypes: finalInstance._components?.map((c: any) => c.type || 'unknown') || []
      })
    }
  }
  
  // 初始化画布尺寸（必须在脚本执行之后，确保编辑字形已设置）
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
  
  // 初始化工具系统（必须在 canvas 准备好之后）
  await initTools()
  
  // 更新当前工具状态
  currentTool.value = (toolStore.tool as ToolType | '') || ''
  
  // 初始化 dragger（只有在选择工具激活时才需要）
  const toolType = toolManager.getCurrentToolType()
  if (toolType === 'select') {
    initDragger()
  }

  // 注册 canvas 到 BottomBarToolManager（如果 coordsViewer 已激活）
  if (canvasRef.value && bottomBarToolStore.currentTool === 'coordsViewer') {
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, true)
  }
})

onUnmounted(() => {
  // 清理selectControl检查定时器
  if (selectControlCheckInterval) {
    clearInterval(selectControlCheckInterval)
    selectControlCheckInterval = null
  }
  cleanupDragger()
  cleanupTools()
  // 清理 BottomBarToolManager
  bottomBarToolManager.cleanup()
  
  // 退出编辑时，将编辑字形的数据同步回列表
  const editingGlyphUUID = (glyphStore as any).editingGlyphUUID
  if (editingGlyphUUID) {
    ;(glyphStore as any).updateGlyphListFromEditFile()
    
    // 取消编辑标记并释放字形实例（字形编辑界面全程维护该字形本身的实例）
    if (import.meta.env.DEV) {
      console.log('[GlyphEditor.onUnmounted] Releasing glyph instance:', {
        editingGlyphUUID,
        isEditing: instanceManager.isEditing(editingGlyphUUID),
        isTemporary: instanceManager.isTemporary(editingGlyphUUID)
      })
    }
    instanceManager.unmarkEditing(editingGlyphUUID)
    instanceManager.releaseInstance(editingGlyphUUID)
    
    ;(glyphStore as any).resetEditGlyph()
  }
})

// 监听编辑字形变化
watch(() => (glyphStore as any).editingGlyph, async () => {
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
  
  // 只有在选择工具激活时才初始化 dragger（与 selectedComponent watch 逻辑保持一致）
  const currentTool = toolManager.getCurrentToolType()
  if (currentTool === 'select') {
    initDragger()
  }

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
watch(() => (glyphStore as any).orderedListWithItemsForCurrentGlyph, async () => {
  await renderCanvas()
}, { deep: true })

// 监听选中组件变化
watch(() => (glyphStore as any).selectedComponent, async () => {
  // 只有在选择工具激活时才初始化 dragger
  const toolType = toolManager.getCurrentToolType()
  if (toolType === 'select') {
    // 如果 dragger 正在拖拽，不要清理和重新初始化，避免中断拖拽
    if (dragger && dragger.isDragging()) {
      if (import.meta.env.DEV) {
        console.log('[GlyphEditor] Skipping dragger cleanup/reinit: dragger is dragging')
      }
      // 只更新 penSelectTool 状态和重新渲染
      const selectTool = toolManager.getTool('select')
      if (selectTool && typeof (selectTool as any).updatePenSelectToolState === 'function') {
        (selectTool as any).updatePenSelectToolState()
      }
      await renderCanvas()
      return
    }
    
    cleanupDragger()
    await nextTick()
    initDragger()
    
    // 更新 penSelectTool 状态（如果选择工具激活）
    const selectTool = toolManager.getTool('select')
    if (selectTool && typeof (selectTool as any).updatePenSelectToolState === 'function') {
      (selectTool as any).updatePenSelectToolState()
    }
    
    // 选中组件变化后重新渲染画布，确保选择框/控件同步更新
    await renderCanvas()
  }
}, { deep: true })

// 监听钢笔组件的 editMode 变化
watch(() => {
  const component = (glyphStore as any).selectedComponent
  if (component && component.type === 'pen') {
    const penComponent = component.value as any
    return penComponent?.editMode
  }
  return false
}, async () => {
  const toolType = toolManager.getCurrentToolType()
  if (toolType === 'select') {
    // 更新 penSelectTool 状态
    const selectTool = toolManager.getTool('select')
    if (selectTool && typeof (selectTool as any).updatePenSelectToolState === 'function') {
      (selectTool as any).updatePenSelectToolState()
    }
    // 重新渲染画布
    await renderCanvas()
  }
})

// 监听关键点和辅助线显示状态变化，重新渲染
watch([() => editorStore.checkJoints, () => editorStore.checkRefLines], async () => {
  await renderCanvas()
})

// 监听渲染样式变化，重新渲染
watch(() => fontRenderStyle.value, async () => {
  await renderCanvas()
})

// 监听工具切换
watch(() => toolStore.tool, async (newTool) => {
  if (!canvasRef.value) return

  // 更新当前工具状态
  currentTool.value = (newTool as ToolType | '') || ''

  if (newTool) {
    await toolManager.switchTool(newTool as ToolType)
    await renderCanvas()

    // 选择工具激活时，glyphDragger 和 SelectTool 可以同时存在
    // glyphDragger 处理字形组件的骨架拖拽，SelectTool 处理其他组件的选择和变换
    if (newTool === 'select' && (glyphStore as any).selectedComponent) {
      initDragger()
    } else if (newTool !== 'select') {
      // 切换到非选择工具时，停用 dragger（其他工具不需要 dragger）
      cleanupDragger()
      selectControl.value = 'null'
    }
  } else {
    // 如果没有工具，清理 dragger
    cleanupDragger()
    selectControl.value = 'null'
  }
})

// 监听SelectTool的selectControl变化（用于鼠标样式）
// 使用定时器定期检查selectControl状态（因为SelectTool内部状态变化不会触发Vue响应式更新）
watch(() => toolStore.tool, (newTool) => {
  if (selectControlCheckInterval) {
    clearInterval(selectControlCheckInterval)
    selectControlCheckInterval = null
  }
  
  if (newTool === 'select') {
    // 当选择工具激活时，定期检查selectControl状态
    selectControlCheckInterval = window.setInterval(() => {
      const selectTool = toolManager.getTool('select') as SelectTool
      if (selectTool) {
        const newControl = selectTool.getSelectControl()
        if (selectControl.value !== newControl) {
          selectControl.value = newControl
        }
      }
    }, 16) // 约60fps
  } else {
    selectControl.value = 'null'
  }
}, { immediate: true })

// 注意：鼠标事件由 dragger 和工具系统的 activate() 方法自动处理
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

/* 工具鼠标样式 */
.pen-on-edit {
  cursor: url('@/assets/icons/pen-cursor.cur'), pointer;
}

.rectangle-on-edit, .ellipse-on-edit {
  cursor: crosshair;
}

.polygon-on-edit {
  cursor: url('@/assets/icons/square-solid.svg'), pointer;
}

/* 选择工具控件鼠标样式 */
.rotate-left-top, .rotate-left-bottom {
  cursor: url('@/assets/icons/rotate-right-solid.svg'), pointer;
}

.rotate-right-top, .rotate-right-bottom {
  cursor: url('@/assets/icons/rotate-left-solid.svg'), pointer;
}

.scale-left-top, .scale-right-bottom {
  cursor: nwse-resize;
}

.scale-left-bottom, .scale-right-top {
  cursor: nesw-resize;
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
