<template>
  <div class="list-wrapper">
    <!-- 组件过滤器选择器 -->
    <div class="filter-header" v-if="editingCharacter && (!editingCharacter.selectedComponentsTree || !editingCharacter.selectedComponentsTree.length)">
      <n-select
        v-model:value="editPanelCompFilter"
        class="filter-select"
        :options="filterOptions"
        @update:value="handleFilterChange"
      />
    </div>
    <!-- 调试信息 -->
    <div v-if="isDev && !editingCharacter" style="padding: 10px; color: red;">
      警告: editingCharacter 为空
    </div>
    <n-scrollbar v-if="editPanelCompFilter === 'all'">
      <div class="all-components-list" v-if="editPanelCompFilter === 'all'">
        <div v-if="orderedListWithItemsForCurrentCharacterFile.length === 0" style="padding: 10px; color: #999;">
          暂无组件
        </div>
        <div
          class="component-item-wrapper"
          v-for="component in orderedListWithItemsForCurrentCharacterFile"
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
    <n-scrollbar v-if="editPanelCompFilter === 'font'">
      <div class="font-components-list" v-if="editPanelCompFilter === 'font'">
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
import { useCharacterStore } from '@/stores/character'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { IComponent } from '@/core/types'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'

const { t } = useI18n()
const characterStore = useCharacterStore()
const editorStore = useEditorStore()

// 开发模式标志
const isDev = import.meta.env.DEV

// 编辑面板组件过滤器
const editPanelCompFilter = computed({
  get: () => editorStore.editPanelCompFilter,
  set: (value: 'all' | 'font') => {
    editorStore.setEditPanelCompFilter(value)
  }
})

// 编辑字符（用于调试）
const editingCharacter = computed(() => characterStore.editingCharacter)

// 过滤器选项
const filterOptions = [
  { label: t('panels.filter.all') || '全部', value: 'all' },
  { label: t('panels.filter.font') || '字体', value: 'font' }
]

// 处理过滤器变化
const handleFilterChange = (value: 'all' | 'font') => {
  editorStore.setEditPanelCompFilter(value)
}

// 右键菜单可见性映射
const popoverVisibleMap = reactive<Record<string, boolean>>({})

// 拖拽相关状态
let draggedItem = ''
let fromIndex = -1
let toIndex = -1
let insertIndex = -1

// 计算属性
const orderedListWithItemsForCurrentCharacterFile = computed(() => {
  const result = characterStore.orderedListWithItemsForCurrentCharacterFile
  if (import.meta.env.DEV) {
    console.log('[CharacterComponentList] orderedListWithItemsForCurrentCharacterFile:', {
      count: result.length,
      editingCharacter: !!characterStore.editingCharacter,
      editingCharacterUUID: characterStore.editingCharacterUUID,
      components: characterStore.editingCharacter?.components?.length || 0,
      orderedList: characterStore.editingCharacter?.orderedList?.length || 0
    })
  }
  return result
})

const selectedComponentsUUIDs = computed(() => {
  return characterStore.selectedComponentsUUIDs
})

const selectedComponents = computed(() => {
  return characterStore.selectedComponents
})

const usedComponents = computed(() => {
  return characterStore.usedComponents
})

// 监听组件列表变化，更新 popoverVisibleMap
watch(
  () => orderedListWithItemsForCurrentCharacterFile.value,
  (components) => {
    components.forEach((component: IComponent) => {
      if (!(component.uuid in popoverVisibleMap)) {
        popoverVisibleMap[component.uuid] = false
      }
    })
  },
  { immediate: true }
)

// 切换锁定
const toggleLock = (uuid: string, lock: boolean) => {
  characterStore.modifyComponent(uuid, { lock })
}

// 切换可见性
const toggleVisibility = (uuid: string, visible: boolean) => {
  characterStore.modifyComponent(uuid, { visible })
}

// 切换包含在字符轮廓中
const toggleUsedInCharacter = (uuid: string, usedInCharacter: boolean, type: string) => {
  if (type === 'picture' || type === 'pressPen') return
  characterStore.modifyComponent(uuid, { usedInCharacter })
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
  
  if (!hasSelected) {
    characterStore.setSelection(uuid)
  }
  
  // 如果组件是字形类型，可能需要触发字形拖拽工具
  const component = characterStore.selectedComponent
  
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
  const list = characterStore.orderedListForCurrentCharacterFile
  
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
  const list = R.clone(characterStore.orderedListForCurrentCharacterFile)
  if (fromIndex === toIndex) return
  
  list.splice(fromIndex, 1)
  if (fromIndex <= insertIndex) {
    insertIndex -= 1
  }
  list.splice(insertIndex, 0, {
    type: 'component',
    uuid: draggedItem,
  })
  
  characterStore.setOrderedList(list)
}

// 剪切
const clip = (uuid: string) => {
  if (!selectedComponents.value || !selectedComponents.value.length) {
    const component = orderedListWithItemsForCurrentCharacterFile.value.find(c => c.uuid === uuid)
    if (component) {
      characterStore.setClipBoard(component)
      characterStore.removeComponent(uuid)
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
      characterStore.setClipBoard(selectedComponents.value)
      selectedComponents.value.forEach((component: IComponent) => {
        characterStore.removeComponent(component.uuid)
      })
    } else {
      // 剪切菜单对应组件
      const component = orderedListWithItemsForCurrentCharacterFile.value.find(c => c.uuid === uuid)
      if (component) {
        characterStore.setClipBoard(component)
        characterStore.removeComponent(uuid)
      }
    }
  }
  characterStore.setSelection('')
  popoverVisibleMap[uuid] = false
}

// 复制
const copy = (uuid: string) => {
  if (!selectedComponents.value || !selectedComponents.value.length) {
    const component = orderedListWithItemsForCurrentCharacterFile.value.find(c => c.uuid === uuid)
    if (component) {
      characterStore.setClipBoard(component)
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
      characterStore.setClipBoard(selectedComponents.value)
    } else {
      // 复制菜单对应组件
      const component = orderedListWithItemsForCurrentCharacterFile.value.find(c => c.uuid === uuid)
      if (component) {
        characterStore.setClipBoard(component)
      }
    }
  }
  popoverVisibleMap[uuid] = false
}

// 粘贴
const paste = (uuid: string) => {
  const components = characterStore.clipBoard.value
  if (!components || components.length === 0) return
  
  let lastComponent: IComponent | null = null
  
  for (let i = components.length - 1; i >= 0; i--) {
    const component = R.clone(components[i])
    component.uuid = genUUID()
    characterStore.insertComponent(component, { uuid, pos: 'next' })
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
    characterStore.removeComponent(uuid)
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
      selectedComponents.value.forEach((component: IComponent) => {
        characterStore.removeComponent(component.uuid)
      })
    } else {
      // 删除菜单对应组件
      characterStore.removeComponent(uuid)
    }
  }
  characterStore.setSelection('')
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
