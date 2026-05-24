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
    <n-scrollbar class="component-list-scrollbar">
      <div class="all-components-list" @dragenter.prevent @dragover.prevent @drop="onContainerDrop">
        <div
          class="component-item-wrapper"
          v-for="component in filteredComponents"
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
                  <n-icon class="tool-icon layer-icon" @click.stop="(e: MouseEvent) => openLayerDialog(component.uuid)" @pointerup.stop="(e: MouseEvent) => openLayerDialog(component.uuid)">
                    <font-awesome-icon
                      :icon="['fas', 'layer-group']"
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

    <!-- Layer Picker Dialog -->
    <n-modal
      v-model:show="layerDialogVisible"
      preset="card"
      :title="t('panels.paramsPanel.layerPicker.title')"
      style="width: 420px;"
    >
      <div class="layer-dialog-body">
        <p style="margin-bottom: 8px; font-size: 13px; color: var(--n-text-color-2);">
          {{ t('dialogs.layerPickerDialog.selectLayer') }}
        </p>
        <n-select
          v-model:value="layerDialogSelectedLayer"
          :options="layerSelectOptions"
          :placeholder="t('panels.paramsPanel.layerPicker.selectLayer')"
          clearable
          style="margin-bottom: 16px;"
        />
        <p style="margin-bottom: 8px; font-size: 13px; color: var(--n-text-color-2);">
          {{ t('dialogs.layerPickerDialog.orCreateNew') }}
        </p>
        <n-input
          v-model:value="layerDialogNewLayerName"
          :placeholder="t('dialogs.layerPickerDialog.newLayerPlaceholder')"
          :disabled="!!layerDialogSelectedLayer"
        />
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="layerDialogVisible = false">{{ t('dialogs.layerPickerDialog.cancel') }}</n-button>
          <n-button type="primary" @click="confirmLayerDialog">{{ t('dialogs.layerPickerDialog.confirm') }}</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { NScrollbar, NPopover, NSelect, NIcon, NModal, NButton, NInput } from 'naive-ui'
import { useGlyphStore } from '@/stores/glyph'
import { useToolStore } from '@/stores/tool'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { IGlyphComponent } from '@/core/types'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const glyphStore = useGlyphStore()
const toolStore = useToolStore()
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

// 获取所有图层列表
const layerNames = computed(() => {
  const layers = editingGlyph.value?.layers
  if (!layers) return []
  return Object.keys(layers)
})

// 过滤器选项（包含图层）
const filterOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = [
    { label: t('panels.filter.all') || '全部', value: 'all' },
    { label: t('panels.filter.font') || '字体', value: 'font' }
  ]
  for (const layerName of layerNames.value) {
    options.push({
      label: t('panels.filter.layer', { name: layerName }),
      value: `layer:${layerName}`
    })
  }
  return options
})

// 处理过滤器变化
const handleFilterChange = (value: string) => {
  editorStore.setGlyphPanelCompFilter(value)
}

// 当前是否按 layer 筛选
const currentLayerFilter = computed(() => {
  const f = glyphPanelCompFilter.value
  if (f.startsWith('layer:')) {
    return f.substring(6)
  }
  return null
})

// 筛选后的组件列表
const filteredComponents = computed(() => {
  if (glyphPanelCompFilter.value === 'all') {
    return orderedListWithItemsForCurrentGlyph.value
  }
  if (glyphPanelCompFilter.value === 'font') {
    return usedComponents.value
  }
  // layer filter
  const layerName = currentLayerFilter.value
  if (layerName) {
    const layerUUIDs = editingGlyph.value?.layers?.[layerName] || []
    return orderedListWithItemsForCurrentGlyph.value.filter(c => layerUUIDs.includes(c.uuid))
  }
  return orderedListWithItemsForCurrentGlyph.value
})

// Layer dialog state
const layerDialogVisible = ref(false)
const layerDialogComponentUUID = ref('')
const layerDialogSelectedLayer = ref('')
const layerDialogNewLayerName = ref('')

const openLayerDialog = (uuid: string) => {
  layerDialogComponentUUID.value = uuid
  layerDialogSelectedLayer.value = ''
  layerDialogNewLayerName.value = ''
  layerDialogVisible.value = true
}

const confirmLayerDialog = () => {
  const uuid = layerDialogComponentUUID.value
  if (!uuid || !editingGlyph.value) {
    layerDialogVisible.value = false
    return
  }

  let layerName = layerDialogSelectedLayer.value
  if (!layerName) {
    layerName = layerDialogNewLayerName.value.trim()
  }

  if (!layerName) {
    // 移除 layer 关联
    glyphStore.modifyComponent(uuid, { layer: undefined } as any)
    // 从 layers 中移除
    if (editingGlyph.value.layers) {
      for (const [name, uuids] of Object.entries(editingGlyph.value.layers)) {
        const idx = uuids.indexOf(uuid)
        if (idx !== -1) {
          uuids.splice(idx, 1)
          if (uuids.length === 0) {
            delete editingGlyph.value.layers[name]
          }
        }
      }
    }
  } else {
    // 设置 layer
    glyphStore.modifyComponent(uuid, { layer: layerName } as any)
    // 先从所有已有图层中移除此组件（确保一个组件只属于一个图层）
    if (editingGlyph.value.layers) {
      for (const [name, uuids] of Object.entries(editingGlyph.value.layers)) {
        if (name === layerName) continue
        const idx = uuids.indexOf(uuid)
        if (idx !== -1) {
          uuids.splice(idx, 1)
          if (uuids.length === 0) {
            delete editingGlyph.value.layers[name]
          }
        }
      }
    }
    // 添加到目标图层
    if (!editingGlyph.value.layers) {
      editingGlyph.value.layers = {}
    }
    if (!editingGlyph.value.layers[layerName]) {
      editingGlyph.value.layers[layerName] = []
    }
    if (!editingGlyph.value.layers[layerName].includes(uuid)) {
      editingGlyph.value.layers[layerName].push(uuid)
    }
  }

  layerDialogVisible.value = false
}

// Layer select options for dialog
const layerSelectOptions = computed(() => {
  return layerNames.value.map(name => ({ label: name, value: name }))
})

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
const _toggleLock = (uuid: string, lock: boolean) => {
  glyphStore.modifyComponent(uuid, { lock })
}
const toggleLock = createDebouncedHandler(_toggleLock, 'GlyphComponentList.toggleLock', (args) => `${args[0]}_${args[1]}`)

// 切换可见性
const _toggleVisibility = (uuid: string, visible: boolean) => {
  glyphStore.modifyComponent(uuid, { visible })
}
const toggleVisibility = createDebouncedHandler(_toggleVisibility, 'GlyphComponentList.toggleVisibility', (args) => `${args[0]}_${args[1]}`)

// 切换包含在字形轮廓中
const _toggleUsedInCharacter = (uuid: string, usedInCharacter: boolean, type: string) => {
  if (type === 'picture' || type === 'pressPen') return
  glyphStore.modifyComponent(uuid, { usedInCharacter })
}
const toggleUsedInCharacter = createDebouncedHandler(_toggleUsedInCharacter, 'GlyphComponentList.toggleUsedInCharacter', (args) => `${args[0]}_${args[1]}`)

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
  glyphStore.setSelection(uuid)
  
  // 如果组件是字形类型，可能需要触发字形拖拽工具
  const component = glyphStore.selectedComponent
  
  if (component && component.type === 'glyph') {
    // TODO: 触发字形拖拽工具
    // setGlyphDraggerTool('glyphDragger')
  }

  // 从列表选择组件时，自动切换到选择工具
  if (toolStore.tool !== 'select') {
    toolStore.setTool('select')
  }
}
const selectComponent = createDebouncedHandler(_selectComponent, 'GlyphComponentList.selectComponent', (args) => args[1])

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
  const list = glyphStore.orderedListForCurrentGlyph

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
  const list = R.clone(glyphStore.orderedListForCurrentGlyph)
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
  glyphStore.setOrderedList(list)
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

  const list = R.clone(glyphStore.orderedListForCurrentGlyph)

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

  glyphStore.setOrderedList(list)
}

// 剪切
const _clip = (uuid: string) => {
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
const clip = createDebouncedHandler(_clip, 'GlyphComponentList.clip', (args) => args[0])

// 复制
const _copy = (uuid: string) => {
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
const copy = createDebouncedHandler(_copy, 'GlyphComponentList.copy', (args) => args[0])

// 粘贴
const _paste = (uuid: string) => {
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
const paste = createDebouncedHandler(_paste, 'GlyphComponentList.paste', (args) => args[0])

// 删除
const _remove = (uuid: string) => {
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
const remove = createDebouncedHandler(_remove, 'GlyphComponentList.remove', (args) => args[0])

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

.layer-dialog-body {
  padding: 16px 0;
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
