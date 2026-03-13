<template>
  <div class="character-editor">
    <!-- 工具栏 -->
    <header class="toolbar-wrapper">
      <ToolBar />
    </header>
    
    <!-- 主内容区 -->
    <main class="editor-content-wrapper">
      <!-- 左侧面板 -->
      <aside class="left-panel-wrapper">
        <div class="left-panel-content">
          <CharacterComponentList />
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
                'transform': editingCharacter ? `translate3d(${editingCharacter.view.translateX}px, ${editingCharacter.view.translateY}px, 0px)` : 'none',
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
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import { getOrCreateDragger } from '@/features/tools/glyphDragger'
import type { BaseGlyphDragger } from '@/features/tools/glyphDragger'
import ToolBar from '@/ui/components/ToolBar/ToolBar.vue'
import CharacterComponentList from '@/ui/components/ComponentList/CharacterComponentList.vue'
import RightPanel from '@/ui/components/RightPanel/RightPanel.vue'
import BottomBar from '@/ui/components/BottomBar/BottomBar.vue'
import EditFilesBar from '@/ui/components/FilesBar/EditFilesBar.vue'
import type { IComponent, ICharacterFileLite } from '@/core/types'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { render } from '@/core/canvas/EditorCanvasRenderer'
import { mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { BackgroundType, GridType } from '@/core/canvas/types'
import type { IBackground, IGrid } from '@/core/canvas/types'
import { renderJoints, renderRefLines } from '@/core/script/Joint'
import { useEditorStore } from '@/stores/editor'
import { fontRenderStyle } from '@/core/script/globals'
import { JointManager } from '@/features/tools/glyphDragger/core/JointManager'
import { mapCanvasX, mapCanvasY } from '@/utils/canvas'
import { bottomBarToolManager } from '@/features/bottomBar/BottomBarToolManager'
import { useBottomBarToolStore } from '@/stores/bottomBarTool'
import { toolManager, SelectTool, PenTool, PolygonTool, EllipseTool, RectangleTool } from '@/features/tools'
import { getCoord } from '@/features/tools/utils/coord'
import { useToolStore } from '@/stores/tool'
import type { ToolType } from '@/features/tools'

const characterStore = useCharacterStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const bottomBarToolStore = useBottomBarToolStore()
const toolStore = useToolStore()
const canvasRef = ref<HTMLCanvasElement>()
let dragger: BaseGlyphDragger | null = null
let selectControlCheckInterval: number | null = null

const selectedComponent = computed(() => (characterStore as any).selectedComponent)
const editingCharacter = computed(() => (characterStore as any).editingCharacter)

// 当前工具和选择控制状态（用于鼠标样式）
const currentTool = ref<ToolType | ''>('')
const selectControl = ref<string>('null')

// Canvas 尺寸
const canvasWidth = computed(() => {
  if (!projectStore.selectedFile) return mapCanvasWidth(1000)
  return mapCanvasWidth(projectStore.selectedFile.width || 1000)
})

const canvasHeight = computed(() => {
  if (!projectStore.selectedFile) return mapCanvasHeight(1000)
  return mapCanvasHeight(projectStore.selectedFile.height || 1000)
})

// Canvas 显示尺寸（逻辑尺寸，用于CSS）
// 原工程中 width.value 和 height.value 默认是 500
// 这是显示尺寸，不是字符的实际宽度
// Canvas 实际尺寸是 mapCanvasWidth(selectedFile.width) = 2 * width
// 显示尺寸是 width.value = 500（默认）
// 所以如果字符宽度是 1000，canvas 实际尺寸是 2000，显示尺寸是 500（缩小了 1/4）
// 原工程中，显示尺寸固定为 500（width.value 默认值）
const displayWidth = computed(() => {
  return 500
})
const displayHeight = computed(() => {
  return 500
})

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
const renderCanvas = () => {
  if (!canvasRef.value || !editingCharacter.value) {
    if (import.meta.env.DEV) {
      console.warn('[CharacterEditor] Cannot render: canvas or editingCharacter is null')
    }
    return
  }
  
  const components = (characterStore as any).orderedListWithItemsForCurrentCharacterFile
  
  if (import.meta.env.DEV) {
    console.log('[CharacterEditor] Rendering canvas:', {
      componentsCount: components.length,
      canvasSize: { width: canvasRef.value.width, height: canvasRef.value.height },
      editingCharacterUUID: editingCharacter.value.uuid,
      editingCharacterComponentsCount: editingCharacter.value.components?.length || 0,
      editingCharacterOrderedListCount: editingCharacter.value.orderedList?.length || 0,
      components: components
    })
  }
  
  render(canvasRef.value, true, false, {
    mode: 'character',
    character: editingCharacter.value,
    components: components,
    background: defaultBackground,
    grid: defaultGrid,
  })
  
  // 渲染关键点和辅助线（在主要渲染之后）
  // 如果当前选中的组件被设置为不可见（visible === false），则不渲染其关键点和辅助线
  if (editorStore.checkJoints || editorStore.checkRefLines) {
    const selectedComponent = (characterStore as any).selectedComponent
    if (
      selectedComponent &&
      selectedComponent.type === 'glyph' &&
      selectedComponent.visible !== false
    ) {
      if (import.meta.env.DEV) {
        console.log('[CharacterEditor] Rendering joints/reflines:', {
          checkJoints: editorStore.checkJoints,
          checkRefLines: editorStore.checkRefLines,
          componentType: selectedComponent.type,
          componentUUID: selectedComponent.uuid,
        })
      }
      if (editorStore.checkJoints) {
        renderJoints(selectedComponent, canvasRef.value)
        
        // 渲染高亮的悬停关键点（如果不是第一个关键点，且不在拖拽中）
        if (dragger && !dragger.isDragging()) {
          const hoverJoint = dragger.getHoverJoint()
          if (hoverJoint) {
            // 获取所有关键点来判断是否是第一个
            const joints = dragger.getJointsForHighlight()
            const isFirst = JointManager.isFirstJoint(hoverJoint, joints)
            
            // 只高亮非第一个关键点
            if (!isFirst) {
              const ctx = canvasRef.value.getContext('2d')
              if (ctx) {
                // 获取关键点坐标
                let x: number, y: number
                if (typeof hoverJoint.x === 'function') {
                  x = hoverJoint.x()
                } else {
                  x = hoverJoint.x as number
                }
                if (typeof hoverJoint.y === 'function') {
                  y = hoverJoint.y()
                } else {
                  y = hoverJoint.y as number
                }
                
                // 转换为 canvas 坐标
                const _x = mapCanvasX(x)
                const _y = mapCanvasY(y)
                const _d = 10
                
                // 绘制红色方块（参考原工程样式）
                ctx.save()
                ctx.fillStyle = 'red'
                ctx.fillRect(_x - _d, _y - _d, 2 * _d, 2 * _d)
                ctx.restore()
              }
            }
          }
        }
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
  if (!canvasRef.value || !(characterStore as any).editingCharacter) {
    cleanupDragger()
    return
  }

  const character = (characterStore as any).editingCharacter
  const component = (characterStore as any).selectedComponent
  
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
    const latestComponent = (characterStore as any).selectedComponent
    if (latestComponent && latestComponent.type === 'glyph' && latestComponent.value) {
      glyphValue = latestComponent.value
    }
  }

  try {
    dragger = getOrCreateDragger(canvasRef.value, 'character', {
      canvas: canvasRef.value,
      context: {
        mode: 'character',
        component,
        componentUUID: component.uuid, // 组件的 UUID，用作 instanceKey
        glyph: glyphValue,
        character: character as ICharacterFileLite, // 类型断言：编辑时字符数据应该已加载
        selectedComponentsTree: (characterStore as any).selectedComponentsTree,
      },
      onRender: () => {
        // 拖拽骨架关键点后触发重新渲染
        renderCanvas()
      },
      onUpdate: (comp) => {
        ;(characterStore as any).updateComponent(comp.uuid, comp)
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

// 初始化工具系统
const initTools = async () => {
  if (!canvasRef.value) return

  // 每次进入字符编辑界面时，重置所有工具的单例实例，确保绑定当前 canvas
  // 避免上一次编辑留下的实例仍然持有旧的 canvas 引用，导致事件监听失效
  try {
    SelectTool.reset()
    PenTool.reset()
    PolygonTool.reset()
    EllipseTool.reset()
    RectangleTool.reset()
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[CharacterEditor] initTools: tool reset failed (can be ignored in some environments)', e)
    }
  }
  // 同时清理 ToolManager 中已注册的旧工具
  toolManager.cleanupAll()
  
  const toolConfig = {
    canvas: canvasRef.value,
    mode: 'character' as const,
    getCoord: (coord: number) => {
      // 动态获取当前的 zoom 值
      const currentZoom = editingCharacter.value?.view?.zoom || 100
      return getCoord(coord, 'character', currentZoom)
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
    if (import.meta.env.DEV) {
      console.log('[CharacterEditor] initTools: toolStore.tool before switchTool:', toolStore.tool)
    }
    await toolManager.switchTool('select')
    if (import.meta.env.DEV) {
      console.log('[CharacterEditor] initTools: switched to select tool, toolStore.tool after switchTool:', toolStore.tool)
    }
  } else {
    await toolManager.switchTool(toolStore.tool as ToolType)
  }
}

// 清理工具系统
const cleanupTools = () => {
  toolManager.cleanupAll()
}

onMounted(async () => {
  // 如果还没有设置编辑字符，从 UUID 设置
  if ((characterStore as any).editingCharacterUUID) {
    if (!(characterStore as any).editingCharacter) {
      if (import.meta.env.DEV) {
        console.log('[CharacterEditor] onMounted: setting edit character from UUID', (characterStore as any).editingCharacterUUID)
      }
      await (characterStore as any).setEditCharacterFileByUUID((characterStore as any).editingCharacterUUID)
    } else {
      if (import.meta.env.DEV) {
        console.log('[CharacterEditor] onMounted: editingCharacter already set', {
          uuid: (characterStore as any).editingCharacterUUID,
          componentsCount: (characterStore as any).editingCharacter.components?.length || 0,
          orderedListCount: (characterStore as any).editingCharacter.orderedList?.length || 0
        })
      }
    }
  } else {
    if (import.meta.env.DEV) {
      console.warn('[CharacterEditor] onMounted: no editingCharacterUUID set')
    }
  }
  
  // 等待 nextTick 确保 editingCharacter 已设置
  await nextTick()
  if (import.meta.env.DEV) {
    console.log('[CharacterEditor] onMounted after nextTick:', {
      editingCharacter: !!(characterStore as any).editingCharacter,
      componentsCount: (characterStore as any).editingCharacter?.components?.length || 0,
      orderedListCount: (characterStore as any).editingCharacter?.orderedList?.length || 0
    })
  }
  
  // 初始化画布尺寸
  if (canvasRef.value && editingCharacter.value) {
    // 设置 canvas 的实际尺寸（用于渲染，高分辨率）
    canvasRef.value.width = canvasWidth.value
    canvasRef.value.height = canvasHeight.value
    
    // 设置 canvas 的显示尺寸（CSS style，逻辑尺寸 * zoom）
    const zoom = editingCharacter.value.view.zoom || 100
    const styleWidth = displayWidth.value * zoom / 100
    const styleHeight = displayHeight.value * zoom / 100
    canvasRef.value.style.width = `${styleWidth}px`
    canvasRef.value.style.height = `${styleHeight}px`
  }
  
  // 初始渲染
  renderCanvas()
  
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
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, false)
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
  // 退出编辑时，将编辑字符的数据同步回列表
  if ((characterStore as any).editingCharacterUUID) {
    ;(characterStore as any).updateCharacterListFromEditFile()
    ;(characterStore as any).resetEditCharacterFile()
  }
})

// 监听编辑字符变化
watch(() => (characterStore as any).editingCharacter, async () => {
  cleanupDragger()
  await nextTick()
  
  // 更新 canvas 显示尺寸
  if (canvasRef.value && editingCharacter.value) {
    const zoom = editingCharacter.value.view.zoom || 100
    const styleWidth = displayWidth.value * zoom / 100
    const styleHeight = displayHeight.value * zoom / 100
    canvasRef.value.style.width = `${styleWidth}px`
    canvasRef.value.style.height = `${styleHeight}px`
  }
  
  // 重新渲染画布
  renderCanvas()
  
  // 只有在选择工具激活时才初始化 dragger（与 selectedComponent watch 逻辑保持一致）
  const currentTool = toolManager.getCurrentToolType()
  if (currentTool === 'select') {
    initDragger()
  }

  // 如果 coordsViewer 已激活，重新注册 canvas
  if (canvasRef.value && bottomBarToolStore.currentTool === 'coordsViewer') {
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, false)
  }
})

// 监听 zoom 变化，更新 canvas 显示尺寸
watch(() => editingCharacter.value?.view?.zoom, (newZoom) => {
  if (canvasRef.value && editingCharacter.value) {
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
    bottomBarToolManager.activateCoordsViewer(canvasRef.value, false)
  } else {
    // 如果当前管理器中的工具是 coordsViewer，但新工具不是，则停用
    const currentTool = bottomBarToolManager.getCurrentTool()
    if (currentTool === 'coordsViewer') {
      bottomBarToolManager.deactivateCoordsViewer()
    }
  }
})

// 监听组件列表变化，重新渲染
watch(() => (characterStore as any).orderedListWithItemsForCurrentCharacterFile, async () => {
  renderCanvas()
}, { deep: true })

// 监听选中组件变化
watch(() => (characterStore as any).selectedComponent, async () => {
  // 只有在选择工具激活时才初始化 dragger
  const toolType = toolManager.getCurrentToolType()
  if (toolType === 'select') {
    // 如果 dragger 正在拖拽，不要清理和重新初始化，避免中断拖拽
    if (dragger && dragger.isDragging()) {
      if (import.meta.env.DEV) {
        console.log('[CharacterEditor] Skipping dragger cleanup/reinit: dragger is dragging')
      }
      // 只更新 penSelectTool 状态和重新渲染
      const selectTool = toolManager.getTool('select')
      if (selectTool && typeof (selectTool as any).updatePenSelectToolState === 'function') {
        (selectTool as any).updatePenSelectToolState()
      }
      renderCanvas()
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
    renderCanvas()
  }
}, { deep: true })

// 监听钢笔组件的 editMode 变化
watch(() => {
  const component = (characterStore as any).selectedComponent
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
    renderCanvas()
  }
})

// 监听关键点和辅助线显示状态变化，重新渲染
watch([() => editorStore.checkJoints, () => editorStore.checkRefLines], async () => {
  renderCanvas()
})

// 监听渲染样式变化，重新渲染
watch(() => fontRenderStyle.value, async () => {
  renderCanvas()
})

// 监听工具切换
watch(() => toolStore.tool, async (newTool) => {
  if (import.meta.env.DEV) {
    console.log('[CharacterEditor] watch toolStore.tool triggered:', newTool)
  }
  if (!canvasRef.value) {
    if (import.meta.env.DEV) {
      console.log('[CharacterEditor] watch toolStore.tool: canvas not ready, returning')
    }
    return
  }

  // 更新当前工具状态
  currentTool.value = (newTool as ToolType | '') || ''

  if (newTool) {
    if (import.meta.env.DEV) {
      console.log('[CharacterEditor] watch toolStore.tool: calling toolManager.switchTool:', newTool)
    }
    await toolManager.switchTool(newTool as ToolType)
    renderCanvas()

    // 选择工具激活时，glyphDragger 和 SelectTool 可以同时存在
    // glyphDragger 处理字形组件的骨架拖拽，SelectTool 处理其他组件的选择和变换
    if (newTool === 'select' && (characterStore as any).selectedComponent) {
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

onUnmounted(() => {
  if (selectControlCheckInterval) {
    clearInterval(selectControlCheckInterval)
    selectControlCheckInterval = null
  }
})

// 注意：鼠标事件由 dragger 和工具系统的 activate() 方法自动处理
// 不需要在模板中手动绑定 @mousedown, @mousemove, @mouseup
</script>

<style scoped>
.character-editor {
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
  position: absolute; /* 原工程中使用 absolute，通过 wrapper 的 flex 居中 */
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