<template>
  <div class="list-wrapper">
    <!-- 组件过滤器选择器 -->
    <div class="filter-header" v-if="editingGlyph && (!editingGlyph.selectedComponentsTree || !editingGlyph.selectedComponentsTree.length)">
      <n-select
        v-model:value="glyphPanelCompFilter"
        class="filter-select"
        :options="filterOptions"
        @update:value="handleFilterChange"
      />
    </div>
    <n-scrollbar v-if="glyphPanelCompFilter === 'all'">
      <div class="all-components-list" v-if="glyphPanelCompFilter === 'all'">
        <div
          class="component-item-wrapper"
          v-for="component in orderedListWithItemsForCurrentGlyph"
          :key="component.uuid"
        >
          <n-popover
            placement="right"
            :width="200"
            trigger="manual"
            :show="popoverVisibleMap[component.uuid]"
          >
            <template #trigger>
              <div
                :class="{
                  'component': true,
                  'selected': selectedComponentsUUIDs.indexOf(component.uuid) !== -1,
                }"
                :draggable="true"
                @dragstart="(e: DragEvent) => onDragStart(e, component.uuid)"
                @dragover="(e: DragEvent) => onDragOver(e, component.uuid)"
                @dragend="(e: DragEvent) => onDragEnd(e, component.uuid)"
                @drop="(e: DragEvent) => onDrop(e, component.uuid)"
                @pointerdown="(e: MouseEvent) => selectComponent(e, component.uuid)"
                @contextmenu="(e: MouseEvent) => openPopover(e, component.uuid)"
              >
                <span class="name">
                  {{ component.name || component.type }}
                </span>
                <span class="tool-wrapper">
                  <n-icon
                    class="tool-icon used-in-character"
                    @pointerdown.stop="(e: MouseEvent) => toggleUsedInCharacter(component.uuid, !component.usedInCharacter, component.type)"
                  >
                    <component :is="component.usedInCharacter ? CheckmarkCircle : CloseCircle" />
                  </n-icon>
                  <n-icon
                    class="tool-icon lock"
                    @pointerdown.stop="(e: MouseEvent) => toggleLock(component.uuid, !component.lock)"
                  >
                    <component :is="component.lock ? LockClosed : LockOpen" />
                  </n-icon>
                  <n-icon
                    class="tool-icon visible"
                    @pointerdown.stop="(e: MouseEvent) => toggleVisibility(component.uuid, !component.visible)"
                  >
                    <component :is="component.visible ? Eye : EyeOff" />
                  </n-icon>
                </span>
              </div>
            </template>
            <div class="component-menu">
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => clip(component.uuid)">
                {{ t('panels.componentList.menu.cut') || '剪切' }}
              </div>
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => copy(component.uuid)">
                {{ t('panels.componentList.menu.copy') || '复制' }}
              </div>
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => paste(component.uuid)">
                {{ t('panels.componentList.menu.paste') || '粘贴' }}
              </div>
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => remove(component.uuid)">
                {{ t('panels.componentList.menu.delete') || '删除' }}
              </div>
            </div>
          </n-popover>
        </div>
      </div>
    </n-scrollbar>
    <n-scrollbar v-if="glyphPanelCompFilter === 'font'">
      <div class="font-components-list" v-if="glyphPanelCompFilter === 'font'">
        <div
          class="component-item-wrapper"
          v-for="component in usedComponents"
          :key="component.uuid"
        >
          <n-popover
            placement="right"
            :width="200"
            trigger="manual"
            :show="popoverVisibleMap[component.uuid]"
          >
            <template #trigger>
              <div
                :class="{
                  'component': true,
                  'selected': selectedComponentsUUIDs.indexOf(component.uuid) !== -1,
                }"
                @pointerdown="(e: MouseEvent) => selectComponent(e, component.uuid)"
                @contextmenu="(e: MouseEvent) => openPopover(e, component.uuid)"
              >
                <span class="name">
                  {{ component.name || component.type }}
                </span>
                <span class="tool-wrapper">
                  <n-icon
                    class="tool-icon used-in-character"
                    @pointerdown.stop="(e: MouseEvent) => toggleUsedInCharacter(component.uuid, !component.usedInCharacter, component.type)"
                  >
                    <component :is="component.usedInCharacter ? CheckmarkCircle : CloseCircle" />
                  </n-icon>
                  <n-icon
                    class="tool-icon lock"
                    @pointerdown.stop="(e: MouseEvent) => toggleLock(component.uuid, !component.lock)"
                  >
                    <component :is="component.lock ? LockClosed : LockOpen" />
                  </n-icon>
                  <n-icon
                    class="tool-icon visible"
                    @pointerdown.stop="(e: MouseEvent) => toggleVisibility(component.uuid, !component.visible)"
                  >
                    <component :is="component.visible ? Eye : EyeOff" />
                  </n-icon>
                </span>
              </div>
            </template>
            <div class="component-menu">
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => clip(component.uuid)">
                {{ t('panels.componentList.menu.cut') || '剪切' }}
              </div>
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => copy(component.uuid)">
                {{ t('panels.componentList.menu.copy') || '复制' }}
              </div>
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => paste(component.uuid)">
                {{ t('panels.componentList.menu.paste') || '粘贴' }}
              </div>
              <div class="component-menu-item" @pointerdown="(e: MouseEvent) => remove(component.uuid)">
                {{ t('panels.componentList.menu.delete') || '删除' }}
              </div>
            </div>
          </n-popover>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { NScrollbar, NIcon, NPopover, NSelect } from 'naive-ui'
import { 
  CheckmarkCircle, 
  CloseCircle, 
  LockClosed, 
  LockOpen, 
  Eye, 
  EyeOff 
} from '@vicons/ionicons5'
import { useGlyphStore } from '@/stores/glyph'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { IGlyphComponent } from '@/core/types'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'

const { t } = useI18n()
const glyphStore = useGlyphStore()
const editorStore = useEditorStore()

// 字形面板组件过滤器
const glyphPanelCompFilter = computed({
  get: () => editorStore.glyphPanelCompFilter,
  set: (value: 'all' | 'font') => {
    editorStore.setGlyphPanelCompFilter(value)
  }
})

// 编辑字形（用于条件判断）
const editingGlyph = computed(() => glyphStore.editingGlyph)

// 过滤器选项
const filterOptions = [
  { label: t('panels.filter.all') || '全部', value: 'all' },
  { label: t('panels.filter.font') || '字体', value: 'font' }
]

// 处理过滤器变化
const handleFilterChange = (value: 'all' | 'font') => {
  editorStore.setGlyphPanelCompFilter(value)
}

// 右键菜单可见性映射
const popoverVisibleMap = reactive<Record<string, boolean>>({})

// 拖拽相关状态
let draggedItem = ''
let fromIndex = -1
let toIndex = -1
let insertIndex = -1

// 计算属性
const orderedListWithItemsForCurrentGlyph = computed(() => {
  return glyphStore.orderedListWithItemsForCurrentGlyph
})

const selectedComponentsUUIDs = computed(() => {
  return glyphStore.selectedComponentsUUIDs
})

const selectedComponents = computed(() => {
  return glyphStore.selectedComponents
})

const usedComponents = computed(() => {
  return glyphStore.usedComponents
})

// 监听组件列表变化，更新 popoverVisibleMap
watch(
  () => orderedListWithItemsForCurrentGlyph.value,
  (components) => {
    components.forEach((component: IGlyphComponent) => {
      if (!(component.uuid in popoverVisibleMap)) {
        popoverVisibleMap[component.uuid] = false
      }
    })
  },
  { immediate: true }
)

// 切换锁定
const toggleLock = (uuid: string, lock: boolean) => {
  glyphStore.modifyComponent(uuid, { lock })
}

// 切换可见性
const toggleVisibility = (uuid: string, visible: boolean) => {
  glyphStore.modifyComponent(uuid, { visible })
}

// 切换包含在字形轮廓中
const toggleUsedInCharacter = (uuid: string, usedInCharacter: boolean, type: string) => {
  if (type === 'picture' || type === 'pressPen') return
  glyphStore.modifyComponent(uuid, { usedInCharacter })
}

// 选择组件
const selectComponent = (e: MouseEvent, uuid: string) => {
  // 如果点击的是工具图标，不处理选择
  const target = e.target as HTMLElement
  if (target.closest('.tool-wrapper') || target.closest('.tool-icon')) {
    return
  }
  
  // 阻止事件冒泡
  e.stopPropagation()
  e.preventDefault()
  
  const hasSelected = selectedComponentsUUIDs.value.indexOf(uuid) !== -1
  
  // 无论是否已选中，都调用 setSelection 以确保 selectedComponentUUID 被正确设置
  glyphStore.setSelection(uuid)
  
  // 如果组件是字形类型，可能需要触发字形拖拽工具
  const component = glyphStore.selectedComponent
  
  if (component && component.type === 'glyph') {
    // TODO: 触发字形拖拽工具
    // setGlyphDraggerTool('glyphDragger')
  }
}

// 拖拽开始
const onDragStart = (e: DragEvent, uuid: string) => {
  draggedItem = uuid
}

// 拖拽悬停
const onDragOver = (e: DragEvent, uuid: string) => {
  e.preventDefault()
  const list = glyphStore.orderedListForCurrentGlyph
  
  for (let i = 0; i < list.length; i++) {
    if (draggedItem === list[i].uuid) {
      fromIndex = i
    }
    if (uuid === list[i].uuid) {
      toIndex = i
    }
  }
  
  const target = e.target as HTMLElement
  if (e.offsetY < target.offsetHeight / 2) {
    insertIndex = toIndex
  } else if (e.offsetY > target.offsetHeight / 2) {
    insertIndex = toIndex + 1
  }
}

// 拖拽结束
const onDragEnd = (e: DragEvent, uuid: string) => {
  draggedItem = ''
  fromIndex = -1
  toIndex = -1
  insertIndex = -1
}

// 拖拽放置
const onDrop = (e: DragEvent, uuid: string) => {
  const list = R.clone(glyphStore.orderedListForCurrentGlyph)
  if (fromIndex === toIndex) return
  
  list.splice(fromIndex, 1)
  if (fromIndex <= insertIndex) {
    insertIndex -= 1
  }
  list.splice(insertIndex, 0, {
    type: 'component',
    uuid: draggedItem,
  })
  
  glyphStore.setOrderedList(list)
}

// 剪切
const clip = (uuid: string) => {
  if (!selectedComponents.value || !selectedComponents.value.length) {
    const component = orderedListWithItemsForCurrentGlyph.value.find(c => c.uuid === uuid)
    if (component) {
      glyphStore.setClipBoard(component)
      glyphStore.removeComponent(uuid)
    }
  } else {
    let mark = false
    if (selectedComponents.value) {
      for (let i = 0; i < selectedComponents.value.length; i++) {
        if (selectedComponents.value[i].uuid === uuid) {
          mark = true
        }
      }
    }
    if (mark) {
      // 剪切所有选中组件
      glyphStore.setClipBoard(selectedComponents.value)
      selectedComponents.value.forEach((component: IGlyphComponent) => {
        glyphStore.removeComponent(component.uuid)
      })
    } else {
      // 剪切菜单对应组件
      const component = orderedListWithItemsForCurrentGlyph.value.find(c => c.uuid === uuid)
      if (component) {
        glyphStore.setClipBoard(component)
        glyphStore.removeComponent(uuid)
      }
    }
  }
  glyphStore.setSelection('')
  popoverVisibleMap[uuid] = false
}

// 复制
const copy = (uuid: string) => {
  if (!selectedComponents.value || !selectedComponents.value.length) {
    const component = orderedListWithItemsForCurrentGlyph.value.find(c => c.uuid === uuid)
    if (component) {
      glyphStore.setClipBoard(component)
    }
  } else {
    let mark = false
    if (selectedComponents.value) {
      for (let i = 0; i < selectedComponents.value.length; i++) {
        if (selectedComponents.value[i].uuid === uuid) {
          mark = true
        }
      }
    }
    if (mark) {
      // 复制所有选中组件
      glyphStore.setClipBoard(selectedComponents.value)
    } else {
      // 复制菜单对应组件
      const component = orderedListWithItemsForCurrentGlyph.value.find(c => c.uuid === uuid)
      if (component) {
        glyphStore.setClipBoard(component)
      }
    }
  }
  popoverVisibleMap[uuid] = false
}

// 粘贴
const paste = (uuid: string) => {
  const components = glyphStore.clipBoard.value
  if (!components || components.length === 0) return
  
  let lastComponent: IGlyphComponent | null = null
  
  for (let i = components.length - 1; i >= 0; i--) {
    const component = R.clone(components[i])
    component.uuid = genUUID()
    glyphStore.insertComponent(component, { uuid, pos: 'next' })
    lastComponent = component
  }
  
  // TODO: 设置正确的工具
  // if (lastComponent && lastComponent.type === 'glyph') {
  //   setGlyphDraggerTool('glyphDragger')
  // } else {
  //   setTool('select')
  // }
  
  popoverVisibleMap[uuid] = false
}

// 删除
const remove = (uuid: string) => {
  if (!selectedComponents.value || !selectedComponents.value.length) {
    glyphStore.removeComponent(uuid)
  } else {
    let mark = false
    if (selectedComponents.value) {
      for (let i = 0; i < selectedComponents.value.length; i++) {
        if (selectedComponents.value[i].uuid === uuid) {
          mark = true
        }
      }
    }
    if (mark) {
      // 删除所有选中组件
      selectedComponents.value.forEach((component: IGlyphComponent) => {
        glyphStore.removeComponent(component.uuid)
      })
    } else {
      // 删除菜单对应组件
      glyphStore.removeComponent(uuid)
    }
  }
  glyphStore.setSelection('')
  popoverVisibleMap[uuid] = false
}

// 打开右键菜单
const openPopover = (e: MouseEvent, uuid: string) => {
  e.preventDefault()
  popoverVisibleMap[uuid] = true
  
  const onMouseDown = (e: MouseEvent) => {
    const inside = (e.target as HTMLElement).closest('.component-menu')
    if (!inside) {
      popoverVisibleMap[uuid] = false
      document.removeEventListener('mousedown', onMouseDown)
    }
  }
  
  document.addEventListener('mousedown', onMouseDown)
}
</script>

<style scoped>
.list-wrapper {
  height: 100%;
}

.all-components-list,
.font-components-list {
  height: 100%;
  margin-top: 5px;
}

.component-item-wrapper {
  padding: 3px 5px;
}

.component {
  width: 100%;
  height: 36px;
  display: flex;
  cursor: pointer;
  padding: 5px 10px;
  border: 1px solid #54648a;
  background-color: var(--primary-0);
  color: var(--primary-5);
  align-items: center;
}

.component:hover {
  background-color: var(--primary-3);
}

.component.selected {
  background-color: var(--primary-3);
}

.component .name {
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 120px;
  display: inline-block;
  overflow-x: hidden;
  flex: auto;
}

.component .tool-wrapper {
  flex: 0 0 80px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.component .tool-icon {
  margin: 0 5px;
  cursor: pointer;
  font-size: 16px;
  color: var(--primary-5);
}

.component .tool-icon:hover {
  color: var(--primary-1);
}

.component-menu {
  background-color: var(--primary-0);
  border: 1px solid var(--dark-4);
}

.component-menu-item {
  height: 30px;
  line-height: 30px;
  cursor: pointer;
  color: var(--primary-0);
  padding: 0 10px;
}

.component-menu-item:hover {
  background-color: var(--primary-3);
  color: var(--primary-5);
}

.component-menu-item:not(:last-child) {
  border-bottom: 1px solid var(--light-0);
}

.filter-header {
  width: 100%;
  border-bottom: 1px solid var(--dark-4);
  padding: 5px 15px 8px 15px;
  line-height: 36px;
}

.filter-select {
  width: 100%;
}
</style>

<style>
/* 全局样式，覆盖 Naive UI 的默认样式以匹配原工程 */
.list-wrapper .n-base-selection {
  background-color: var(--primary-0) !important;
  border-radius: 10px 5px 20px !important;
  box-shadow: 0 0 0 1px var(--primary-1) inset !important;
}

.list-wrapper .n-base-selection .n-base-selection-label {
  color: var(--primary-5) !important;
}

.list-wrapper .n-base-selection .n-base-selection-placeholder {
  color: var(--primary-5) !important;
}

.list-wrapper .n-base-selection .n-base-selection__arrow {
  color: var(--primary-5) !important;
}

.list-wrapper .n-base-selection:hover {
  background-color: var(--primary-0) !important;
}

.list-wrapper .n-base-selection.n-base-selection--active {
  background-color: var(--primary-0) !important;
  box-shadow: 0 0 0 1px var(--primary-1) inset !important;
}
</style>
