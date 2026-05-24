<template>
  <div class="list-wrapper" data-testid="component-list">
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
      {{ t('panels.componentList.warningEditingCharacterEmpty') }}
    </div>
    <n-scrollbar v-if="editPanelCompFilter === 'all'" class="component-list-scrollbar">
      <div class="all-components-list" v-if="editPanelCompFilter === 'all'" @dragenter.prevent @dragover.prevent @drop="onContainerDrop">
        <div v-if="orderedListWithItemsForCurrentCharacterFile.length === 0" style="padding: 10px; color: #999;">
          {{ t('panels.componentList.noComponents') }}
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
                :data-testid="`component-item`"
                :data-type="component.type"
                :data-uuid="component.uuid"
                @dragstart="(e: DragEvent) => onDragStart(e, component.uuid)"
                @dragover="(e: DragEvent) => onDragOver(e, component.uuid)"
                @dragend="(e: DragEvent) => onDragEnd(e, component.uuid)"
                @drop="(e: DragEvent) => onDrop(e, component.uuid)"
                @click="(e: MouseEvent) => selectComponent(e, component.uuid)"
                @pointerup="(e: MouseEvent) => selectComponent(e, component.uuid)"
                @contextmenu="(e: MouseEvent) => openPopover(e, component.uuid)"
              >
                <span class="name">
                  {{ component.name || component.type }}
                </span>
                <span class="tool-wrapper">
                  <n-icon class="tool-icon used-in-character" @click.stop="(e: MouseEvent) => toggleUsedInCharacter(component.uuid, !component.usedInCharacter, component.type)" @pointerup.stop="(e: MouseEvent) => toggleUsedInCharacter(component.uuid, !component.usedInCharacter, component.type)">
                    <font-awesome-icon
                      :icon="['fas', 'circle-check']"
                      v-if="component.usedInCharacter"
                    />
                    <font-awesome-icon
                      :icon="['fas', 'circle-xmark']"
                      v-else
                    />
                  </n-icon>
                  <n-icon class="tool-icon lock" @click.stop="(e: MouseEvent) => toggleLock(component.uuid, !component.lock)" @pointerup.stop="(e: MouseEvent) => toggleLock(component.uuid, !component.lock)">
                    <font-awesome-icon
                      :icon="['fas', 'lock']"
                      v-if="component.lock"
                    />
                    <font-awesome-icon
                      :icon="['fas', 'lock-open']"
                      v-else
                    />
                  </n-icon>
                  <n-icon class="tool-icon visible" @click.stop="(e: MouseEvent) => toggleVisibility(component.uuid, !component.visible)" @pointerup.stop="(e: MouseEvent) => toggleVisibility(component.uuid, !component.visible)">
                    <font-awesome-icon
                      :icon="['fas', 'eye']"
                      v-if="component.visible"
                    />
                    <font-awesome-icon
                      :icon="['fas', 'eye-slash']"
                      v-else
                    />
                  </n-icon>
                </span>
              </div>
            </template>
            <div class="component-menu">
              <div class="component-menu-item" @click="(e: MouseEvent) => clip(component.uuid)" @pointerup="(e: MouseEvent) => clip(component.uuid)">
                {{ t('panels.componentList.menu.cut') || '剪切' }}
              </div>
              <div class="component-menu-item" @click="(e: MouseEvent) => copy(component.uuid)" @pointerup="(e: MouseEvent) => copy(component.uuid)">
                {{ t('panels.componentList.menu.copy') || '复制' }}
              </div>
              <div class="component-menu-item" @click="(e: MouseEvent) => paste(component.uuid)" @pointerup="(e: MouseEvent) => paste(component.uuid)">
                {{ t('panels.componentList.menu.paste') || '粘贴' }}
              </div>
              <div class="component-menu-item" @click="(e: MouseEvent) => remove(component.uuid)" @pointerup="(e: MouseEvent) => remove(component.uuid)">
                {{ t('panels.componentList.menu.delete') || '删除' }}
              </div>
            </div>
          </n-popover>
        </div>
      </div>
    </n-scrollbar>
    <n-scrollbar v-if="editPanelCompFilter === 'font'" class="component-list-scrollbar">
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
                @click="(e: MouseEvent) => selectComponent(e, component.uuid)"
                @pointerup="(e: MouseEvent) => selectComponent(e, component.uuid)"
              >
                <span class="name">
                  {{ component.name || component.type }}
                </span>
                <span class="tool-wrapper">
                  <n-icon class="tool-icon used-in-character" @click.stop="(e: MouseEvent) => toggleUsedInCharacter(component.uuid, !component.usedInCharacter, component.type)" @pointerup.stop="(e: MouseEvent) => toggleUsedInCharacter(component.uuid, !component.usedInCharacter, component.type)">
                    <font-awesome-icon
                      :icon="['fas', 'circle-check']"
                      v-if="component.usedInCharacter"
                    />
                    <font-awesome-icon
                      :icon="['fas', 'circle-xmark']"
                      v-else
                    />
                  </n-icon>
                  <n-icon class="tool-icon lock" @click.stop="(e: MouseEvent) => toggleLock(component.uuid, !component.lock)" @pointerup.stop="(e: MouseEvent) => toggleLock(component.uuid, !component.lock)">
                    <font-awesome-icon
                      :icon="['fas', 'lock']"
                      v-if="component.lock"
                    />
                    <font-awesome-icon
                      :icon="['fas', 'lock-open']"
                      v-else
                    />
                  </n-icon>
                  <n-icon class="tool-icon visible" @click.stop="(e: MouseEvent) => toggleVisibility(component.uuid, !component.visible)" @pointerup.stop="(e: MouseEvent) => toggleVisibility(component.uuid, !component.visible)">
                    <font-awesome-icon
                      :icon="['fas', 'eye']"
                      v-if="component.visible"
                    />
                    <font-awesome-icon
                      :icon="['fas', 'eye-slash']"
                      v-else
                    />
                  </n-icon>
                </span>
              </div>
            </template>
            <div class="component-menu">
              <div class="component-menu-item" @click="(e: MouseEvent) => clip(component.uuid)" @pointerup="(e: MouseEvent) => clip(component.uuid)">
                {{ t('panels.componentList.menu.cut') || '剪切' }}
              </div>
              <div class="component-menu-item" @click="(e: MouseEvent) => copy(component.uuid)" @pointerup="(e: MouseEvent) => copy(component.uuid)">
                {{ t('panels.componentList.menu.copy') || '复制' }}
              </div>
              <div class="component-menu-item" @click="(e: MouseEvent) => paste(component.uuid)" @pointerup="(e: MouseEvent) => paste(component.uuid)">
                {{ t('panels.componentList.menu.paste') || '粘贴' }}
              </div>
              <div class="component-menu-item" @click="(e: MouseEvent) => remove(component.uuid)" @pointerup="(e: MouseEvent) => remove(component.uuid)">
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
import { NScrollbar, NPopover, NSelect, NIcon } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import { useToolStore } from '@/stores/tool'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { IComponent } from '@/core/types'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const characterStore = useCharacterStore()
const toolStore = useToolStore()
const editorStore = useEditorStore()

// 开发模式标志
const isDev = import.meta.env.DEV

// 编辑面板组件过滤器
const editPanelCompFilter = computed({
  get: () => editorStore.editPanelCompFilter,
  set: (value: string) => {
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
const handleFilterChange = (value: string) => {
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
const _toggleLock = (uuid: string, lock: boolean) => {
  characterStore.modifyComponent(uuid, { lock })
}
const toggleLock = createDebouncedHandler(_toggleLock, 'CharacterComponentList.toggleLock', (args) => `${args[0]}_${args[1]}`)

// 切换可见性
const _toggleVisibility = (uuid: string, visible: boolean) => {
  characterStore.modifyComponent(uuid, { visible })
}
const toggleVisibility = createDebouncedHandler(_toggleVisibility, 'CharacterComponentList.toggleVisibility', (args) => `${args[0]}_${args[1]}`)

// 切换包含在字符轮廓中
const _toggleUsedInCharacter = (uuid: string, usedInCharacter: boolean, type: string) => {
  console.log('toggleUsedInCharacter', uuid, usedInCharacter, type)
  if (type === 'picture' || type === 'pressPen') return
  characterStore.modifyComponent(uuid, { usedInCharacter })
}
const toggleUsedInCharacter = createDebouncedHandler(_toggleUsedInCharacter, 'CharacterComponentList.toggleUsedInCharacter', (args) => `${args[0]}_${args[1]}`)

// 选择组件
const _selectComponent = (e: MouseEvent, uuid: string) => {
  // 仅左键：右键会触发 pointerup(button=2)，若走 setSelection 会冲掉多选
  if (e.button !== 0) {
    return
  }
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
  characterStore.setSelection(uuid)
  
  // 如果组件是字形类型，可能需要触发字形拖拽工具
  const component = characterStore.selectedComponent
  
  if (component && component.type === 'glyph') {
    // TODO: 触发字形拖拽工具
    // setGlyphDraggerTool('glyphDragger')
  }

  // 从列表选择组件时，自动切换到选择工具
  if (toolStore.tool !== 'select') {
    toolStore.setTool('select')
  }
}
const selectComponent = createDebouncedHandler(_selectComponent, 'CharacterComponentList.selectComponent', (args) => args[1])

// 拖拽开始
const onDragStart = (e: DragEvent, uuid: string) => {
  if (import.meta.env.DEV) {
    console.log('[DnD] dragstart', { uuid, dataTransfer: !!e.dataTransfer })
  }
  draggedItem = uuid
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', uuid)
    e.dataTransfer.effectAllowed = 'move'
  }
}

// 拖拽悬停
let _dragoverLogCounter = 0
const onDragOver = (e: DragEvent, uuid: string) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  const list = characterStore.orderedListForCurrentCharacterFile

  for (let i = 0; i < list.length; i++) {
    if (draggedItem === list[i].uuid) {
      fromIndex = i
    }
    if (uuid === list[i].uuid) {
      toIndex = i
    }
  }

  const currentTarget = e.currentTarget as HTMLElement
  const rect = currentTarget.getBoundingClientRect()
  const y = e.clientY - rect.top
  if (y < rect.height / 2) {
    insertIndex = toIndex
  } else {
    insertIndex = toIndex + 1
  }

  if (_dragoverLogCounter++ % 20 === 0 && import.meta.env.DEV) {
    console.log('[DnD] dragover (component)', {
      draggedItem, uuid, fromIndex, toIndex, insertIndex,
      targetTag: (e.target as HTMLElement)?.tagName,
    })
  }
}

// 拖拽结束
const onDragEnd = (e: DragEvent, uuid: string) => {
  if (import.meta.env.DEV) {
    console.log('[DnD] dragend', { uuid, draggedItem, fromIndex, toIndex, insertIndex })
  }
  draggedItem = ''
  fromIndex = -1
  toIndex = -1
  insertIndex = -1
}

// 拖拽放置
const onDrop = (e: DragEvent, uuid: string) => {
  if (import.meta.env.DEV) {
    console.log('[DnD] drop (component)', { uuid, draggedItem, fromIndex, toIndex, insertIndex })
  }
  e.preventDefault()
  e.stopPropagation()
  const list = R.clone(characterStore.orderedListForCurrentCharacterFile)
  if (fromIndex === toIndex) {
    if (import.meta.env.DEV) {
      console.log('[DnD] drop skipped: fromIndex === toIndex')
    }
    return
  }

  list.splice(fromIndex, 1)
  if (fromIndex <= insertIndex) {
    insertIndex -= 1
  }
  list.splice(insertIndex, 0, {
    type: 'component',
    uuid: draggedItem,
  })

  if (import.meta.env.DEV) {
    console.log('[DnD] drop after reorder, calling setOrderedList')
  }
  characterStore.setOrderedList(list)
}

// 容器拖拽放置（处理拖到 item 间隙的情况，WKWebView 兼容）
const onContainerDrop = (e: DragEvent) => {
  if (import.meta.env.DEV) {
    console.log('[DnD] drop (container)', { draggedItem, clientX: e.clientX, clientY: e.clientY })
  }
  e.preventDefault()
  e.stopPropagation()

  if (!draggedItem) {
    if (import.meta.env.DEV) {
      console.log('[DnD] container drop skipped: no draggedItem')
    }
    return
  }

  const list = R.clone(characterStore.orderedListForCurrentCharacterFile)

  let from = -1
  for (let i = 0; i < list.length; i++) {
    if (draggedItem === list[i].uuid) {
      from = i
      break
    }
  }
  if (from < 0) {
    if (import.meta.env.DEV) {
      console.log('[DnD] container drop skipped: from < 0')
    }
    return
  }

  const container = e.currentTarget as HTMLElement
  const allDivs = container.querySelectorAll<HTMLElement>('.component')
  let closest: HTMLElement | null = null
  let minDist = Infinity

  allDivs.forEach((el) => {
    const rect = el.getBoundingClientRect()
    const dist = Math.abs(e.clientY - (rect.top + rect.height / 2))
    if (dist < minDist) {
      minDist = dist
      closest = el
    }
  })

  if (!closest) {
    if (import.meta.env.DEV) {
      console.log('[DnD] container drop skipped: no closest .component found')
    }
    return
  }

  const uuid = closest.dataset.uuid
  if (!uuid) {
    if (import.meta.env.DEV) {
      console.log('[DnD] container drop skipped: closest has no data-uuid')
    }
    return
  }

  let to = -1
  for (let i = 0; i < list.length; i++) {
    if (uuid === list[i].uuid) {
      to = i
      break
    }
  }
  if (to < 0 || from === to) {
    if (import.meta.env.DEV) {
      console.log('[DnD] container drop skipped', { to, from })
    }
    return
  }

  const rect = closest.getBoundingClientRect()
  let insert = e.clientY < rect.top + rect.height / 2 ? to : to + 1

  if (import.meta.env.DEV) {
    console.log('[DnD] container drop reorder', { from, to, insert, listLen: list.length })
  }

  list.splice(from, 1)
  if (from <= insert) insert -= 1
  list.splice(insert, 0, { type: 'component', uuid: draggedItem })

  characterStore.setOrderedList(list)
}

// 剪切
const _clip = (uuid: string) => {
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
const clip = createDebouncedHandler(_clip, 'CharacterComponentList.clip', (args) => args[0])

// 复制
const _copy = (uuid: string) => {
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
const copy = createDebouncedHandler(_copy, 'CharacterComponentList.copy', (args) => args[0])

// 粘贴
const _paste = (uuid: string) => {
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
const paste = createDebouncedHandler(_paste, 'CharacterComponentList.paste', (args) => args[0])

// 删除
const _remove = (uuid: string) => {
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
const remove = createDebouncedHandler(_remove, 'CharacterComponentList.remove', (args) => args[0])

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
/* 与左侧面板 flex 链配合：占满筛选器下剩余高度并在内部滚动。
   若仅 height:100% 而不约束 n-scrollbar，滚动区会按内容撑开，被父级 overflow:hidden 裁掉底部若干项。 */
.list-wrapper {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.component-list-scrollbar {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.component-list-scrollbar :deep(.n-scrollbar-container) {
  max-height: 100%;
}

.all-components-list,
.font-components-list {
  padding-top: 5px;
  padding-bottom: 12px;
  box-sizing: border-box;
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
  .n-icon {
    font-size: 14px !important;
  }
}

.component .tool-icon {
  margin: 0 5px;
  cursor: pointer;
  font-size: 14px;
  color: var(--primary-5);
}

.component .tool-icon:hover {
  color: var(--primary-1);
}

.component-menu {
  background-color: var(--primary-0);
}

.component-menu-item {
  height: 30px;
  line-height: 30px;
  cursor: pointer;
  color: var(--primary-5);
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
  flex-shrink: 0;
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
  .list-wrapper .n-base-selection {
    background-color: var(--primary-0) !important;
    .n-base-selection-label {
      color: var(--primary-5) !important;
      background-color: var(--primary-0) !important;

      .n-base-selection-input, .n-base-suffix__arrow {
        color: var(--primary-5) !important;
      }
    }
  }
</style>