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

const characterStore = useCharacterStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const canvasRef = ref<HTMLCanvasElement>()
let dragger: BaseGlyphDragger | null = null

const selectedComponent = computed(() => characterStore.selectedComponent)
const editingCharacter = computed(() => characterStore.editingCharacter)

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
  
  const components = characterStore.orderedListWithItemsForCurrentCharacterFile
  
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
  
  console.log('renderCanvas')
  
  render(canvasRef.value, true, false, {
    mode: 'character',
    character: editingCharacter.value,
    components: components,
    background: defaultBackground,
    grid: defaultGrid,
  })
  
  // 渲染关键点和辅助线（在主要渲染之后）
  if (editorStore.checkJoints || editorStore.checkRefLines) {
    const selectedComponent = characterStore.selectedComponent
    if (selectedComponent && selectedComponent.type === 'glyph') {
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
        componentUUID: component.uuid, // 组件的 UUID，用作 instanceKey
        glyph: component.type === 'glyph' ? (component.value as any) : undefined,
        character: character as ICharacterFileLite, // 类型断言：编辑时字符数据应该已加载
        selectedComponentsTree: characterStore.selectedComponentsTree,
      },
      onRender: () => {
        // 拖拽骨架关键点后触发重新渲染
        renderCanvas()
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

onMounted(async () => {
  // 如果还没有设置编辑字符，从 UUID 设置
  if (characterStore.editingCharacterUUID) {
    if (!characterStore.editingCharacter) {
      if (import.meta.env.DEV) {
        console.log('[CharacterEditor] onMounted: setting edit character from UUID', characterStore.editingCharacterUUID)
      }
      await characterStore.setEditCharacterFileByUUID(characterStore.editingCharacterUUID)
    } else {
      if (import.meta.env.DEV) {
        console.log('[CharacterEditor] onMounted: editingCharacter already set', {
          uuid: characterStore.editingCharacterUUID,
          componentsCount: characterStore.editingCharacter.components?.length || 0,
          orderedListCount: characterStore.editingCharacter.orderedList?.length || 0
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
      editingCharacter: !!characterStore.editingCharacter,
      componentsCount: characterStore.editingCharacter?.components?.length || 0,
      orderedListCount: characterStore.editingCharacter?.orderedList?.length || 0
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
  
  initDragger()
})

onUnmounted(() => {
  cleanupDragger()
  // 退出编辑时，将编辑字符的数据同步回列表
  if (characterStore.editingCharacterUUID) {
    characterStore.updateCharacterListFromEditFile()
    characterStore.resetEditCharacterFile()
  }
})

// 监听编辑字符变化
watch(() => characterStore.editingCharacter, async () => {
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
  
  initDragger()
})

// 监听组件列表变化，重新渲染
watch(() => characterStore.orderedListWithItemsForCurrentCharacterFile, async () => {
  renderCanvas()
}, { deep: true })

// 监听选中组件变化
watch(() => characterStore.selectedComponent, () => {
  cleanupDragger()
  nextTick(() => {
    initDragger()
  })
})

// 监听关键点和辅助线显示状态变化，重新渲染
watch([() => editorStore.checkJoints, () => editorStore.checkRefLines], async () => {
  renderCanvas()
})

// 监听渲染样式变化，重新渲染
watch(() => fontRenderStyle.value, async () => {
  renderCanvas()
})

// 注意：鼠标事件由 dragger 的 activate() 方法自动处理
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
