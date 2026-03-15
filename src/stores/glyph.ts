/**
 * 字形编辑 Store
 * 管理字形编辑相关的状态
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import type { ICustomGlyph, IGlyphComponent } from '@/core/types'
import { useProjectStore } from './project'
import { useEditorStore } from './editor'
import { instanceManager } from '@/core/instance'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { selectedItemByUUID } from '@/core/utils/component'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'

export const useGlyphStore = defineStore('glyph', () => {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  
  // 状态
  const editingGlyphUUID = ref<string>('')
  const selectedComponentUUID = ref<string>('')
  const selectedComponentsTree = ref<string[]>([])
  const glyphCategory = ref<'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'>('glyphs')

  // 字形列表更新信号：退出编辑时递增，供虚拟列表监听以强制刷新预览
  const glyphListVersion = ref(0)
  const lastUpdatedGlyphUUID = ref<string>('')

  // 剪贴板（复用字符的剪贴板，因为两者可以互相复制粘贴）
  // 注意：这里暂时使用独立的剪贴板，后续可以考虑统一管理
  const clipBoard = reactive<{ value: Array<IGlyphComponent> }>({
    value: []
  })
  
  // 是否支持多选（暂时不支持，保持与原工程一致）
  const enableMultiSelect = ref(false)

  // 当前编辑的字形文件（独立对象，与列表分离，提升性能）
  // 由于列表中有大量字形时，computed属性计算过慢，editGlyph改用手动赋值，不使用computed
  const editingGlyph = ref<ICustomGlyph | null>(null)

  const selectedComponent = computed(() => {
    if (!selectedComponentUUID.value || !editingGlyph.value) {
      return null
    }
    return findComponentInTree(
      editingGlyph.value.components,
      selectedComponentUUID.value
    )
  })

  // 当前字形的排序组件（包含组件本身）列表
  const orderedListWithItemsForCurrentGlyph = computed(() => {
    if (!editingGlyph.value) return []
    const glyph = editingGlyph.value
    if (!glyph.orderedList || !glyph.orderedList.length) {
      return glyph.components || []
    }
    
    return glyph.orderedList.map((item: { type: string; uuid: string }) => {
      if (item.type === 'group') {
        // 如果是组，从 groups 中查找（暂时不支持组）
        return null
      }
      return selectedItemByUUID(glyph.components, item.uuid)
    }).filter((item): item is IGlyphComponent => item !== null)
  })

  // 当前字形的排序列表（不包含组件本身）
  const orderedListForCurrentGlyph = computed(() => {
    if (!editingGlyph.value) return []
    return editingGlyph.value.orderedList || []
  })

  // 选中的所有组件uuid列表
  const selectedComponentsUUIDs = computed(() => {
    if (!editingGlyph.value) return []
    return editingGlyph.value.selectedComponentsUUIDs || []
  })

  // 选中的所有组件列表
  const selectedComponents = computed(() => {
    if (!editingGlyph.value || !selectedComponentsUUIDs.value.length) return []
    const components: IGlyphComponent[] = []
    selectedComponentsUUIDs.value.forEach(uuid => {
      const component = findComponentInTree(editingGlyph.value!.components, uuid)
      if (component) {
        components.push(component)
      }
    })
    return components
  })

  // 用在字形中的组件列表（usedInCharacter 为 true 的组件）
  const usedComponents = computed(() => {
    return orderedListWithItemsForCurrentGlyph.value.filter((component: IGlyphComponent) => {
      return !!component.usedInCharacter
    })
  })

  /**
   * 在组件树中查找组件
   */
  function findComponentInTree(
    components: IGlyphComponent[],
    uuid: string
  ): IGlyphComponent | null {
    for (const comp of components) {
      if (comp.uuid === uuid) {
        return comp
      }
      // 如果是字形组件，递归查找子组件
      if (comp.type === 'glyph' && (comp.value as any).components) {
        const found = findComponentInTree(
          (comp.value as any).components,
          uuid
        )
        if (found) return found
      }
    }
    return null
  }

  // Actions
  /**
   * 设置正在编辑的字形 UUID
   */
  function setEditingGlyphUUID(uuid: string) {
    editingGlyphUUID.value = uuid
  }

  /**
   * 从列表中设置编辑字形（深拷贝，与列表分离）
   * 将列表中指定uuid的字形数据设置为editGlyph
   */
  function setEditGlyphByUUID(uuid: string, category: typeof glyphCategory.value = 'glyphs') {
    if (!projectStore.selectedFile) return
    
    const glyphList = projectStore.selectedFile[category] || []
    const glyph = glyphList.find(g => g.uuid === uuid)
    
    if (glyph) {
      // 深拷贝字形数据，与列表分离
      editingGlyph.value = R.clone(glyph) as ICustomGlyph
      editingGlyphUUID.value = uuid
      glyphCategory.value = category
      selectedComponentsTree.value = []
      
      // 确保必要的属性存在
      if (!editingGlyph.value.components) {
        editingGlyph.value.components = []
      }
      if (!editingGlyph.value.orderedList) {
        // 如果 orderedList 不存在，从 components 生成
        editingGlyph.value.orderedList = editingGlyph.value.components.map(comp => ({
          type: 'component',
          uuid: comp.uuid
        }))
      }
      if (!editingGlyph.value.selectedComponentsUUIDs) {
        editingGlyph.value.selectedComponentsUUIDs = []
      }
      if (!editingGlyph.value.groups) {
        editingGlyph.value.groups = []
      }
      
      // 如果文件中已经有选中的组件，恢复选中状态
      if (editingGlyph.value.selectedComponentsUUIDs && editingGlyph.value.selectedComponentsUUIDs.length > 0) {
        // 取第一个选中的组件作为当前选中组件
        selectedComponentUUID.value = editingGlyph.value.selectedComponentsUUIDs[0]
      } else {
        selectedComponentUUID.value = ''
      }
      
      if (import.meta.env.DEV) {
        console.log('[GlyphStore] setEditGlyphByUUID:', {
          uuid,
          category,
          componentsCount: editingGlyph.value.components.length,
          orderedListCount: editingGlyph.value.orderedList.length
        })
      }
      
      // 标记为正在编辑，触发实例化
      instanceManager.markEditing(uuid)
      // 获取或创建实例（延迟实例化）
      getGlyphInstance()
    }
  }

  /**
   * 重置编辑字形（退出编辑时调用）
   */
  function resetEditGlyph() {
    editingGlyph.value = null
    editingGlyphUUID.value = ''
    selectedComponentUUID.value = ''
    selectedComponentsTree.value = []
  }

  /**
   * 将编辑字形的数据同步回列表
   * 在退出编辑时调用，将 editGlyph 的值赋给列表中相应字形
   */
  function updateGlyphListFromEditFile() {
    if (!editingGlyph.value || !projectStore.selectedFile) return

    // 清除预览和轮廓缓存引用，使列表项在重新可见时重新计算最新内容
    // previewRef 置空后，列表组件的 watcher 会检测到变化并触发重新渲染
    // contourRef 置空后，下次导出时轮廓会重新计算，确保导出内容是最新的
    editingGlyph.value.previewRef = undefined
    editingGlyph.value.contourRef = undefined

    const glyphList = projectStore.selectedFile[glyphCategory.value] || []
    const index = glyphList.findIndex(
      g => g.uuid === editingGlyphUUID.value
    )

    if (index >= 0) {
      // 深拷贝编辑字形的数据回列表
      glyphList[index] = R.clone(editingGlyph.value) as ICustomGlyph
      // 更新信号，通知虚拟列表强制刷新该项预览
      lastUpdatedGlyphUUID.value = editingGlyphUUID.value
      glyphListVersion.value++
    }
  }

  /**
   * 设置正在编辑的字形（兼容旧接口）
   * 会触发实例化（延迟实例化）
   */
  function setEditingGlyph(uuid: string, category: typeof glyphCategory.value = 'glyphs') {
    // 取消之前的编辑标记
    if (editingGlyphUUID.value) {
      instanceManager.unmarkEditing(editingGlyphUUID.value)
    }
    
    // 从列表中设置编辑字形
    setEditGlyphByUUID(uuid, category)
  }

  /**
   * 获取字形实例（延迟实例化）
   */
  function getGlyphInstance(): CustomGlyph | null {
    if (!editingGlyph.value) {
      return null
    }
    
    return instanceManager.getInstance(
      editingGlyph.value.uuid,
      () => new CustomGlyph(editingGlyph.value!),
      'glyph'
    )
  }

  /**
   * 选择组件
   */
  function selectComponent(uuid: string, tree: string[] = []) {
    // 统一通过 setSelection 来更新选中状态（包括多选、高亮等）
    setSelection(uuid)
    // 同步记录选中路径（用于嵌套字形组件）
    selectedComponentsTree.value = tree

    // 如果选中的是字形组件，在字形编辑界面同样需要显示骨架与参考线
    const component = selectedComponent.value
    if (component && component.type === 'glyph') {
      editorStore.checkJoints = true
      editorStore.checkRefLines = true
    }
  }

  /**
   * 清除选择
   */
  function clearSelection() {
    selectedComponentUUID.value = ''
    selectedComponentsTree.value = []
    // 同时清除 editingGlyph 中的 selectedComponentsUUIDs，确保组件列表的高亮状态也被清除
    if (editingGlyph.value) {
      editingGlyph.value.selectedComponentsUUIDs = []
    }
  }

  /**
   * 更新组件
   */
  function updateComponent(uuid: string, updates: Partial<IGlyphComponent>) {
    if (!editingGlyph.value) return false

    const component = findComponentInTree(editingGlyph.value.components, uuid)
    if (component) {
      Object.assign(component, updates)
      return true
    }
    return false
  }

  /**
   * 修改组件（支持更多选项）
   */
  function modifyComponent(uuid: string, options: Partial<IGlyphComponent>) {
    if (!editingGlyph.value) return false
    
    const component = findComponentInTree(editingGlyph.value.components, uuid)
    if (!component) return false
    
    Object.keys(options).forEach((key: string) => {
      const optionValue = (options as any)[key]
      if (key === 'value' && typeof optionValue === 'object') {
        // 合并 value 对象，保留现有属性（如 editMode）
        const compAny = component as any
        const currentValue = compAny.value || {}
        compAny.value = { ...currentValue, ...R.clone(optionValue) }
      } else {
        (component as any)[key] = optionValue
      }
    })
    
    return true
  }

  /**
   * 删除组件
   */
  function removeComponent(uuid: string) {
    if (!editingGlyph.value) return false
    
    const glyph = editingGlyph.value
    const index = glyph.components.findIndex(comp => comp.uuid === uuid)
    if (index === -1) return false
    
    // 从 orderedList 中删除
    removeOrderedItem(uuid)
    
    // 从 components 中删除
    glyph.components.splice(index, 1)
    
    // 清除选择
    if (selectedComponentUUID.value === uuid) {
      selectedComponentUUID.value = ''
      selectedComponentsTree.value = []
    }
    
    return true
  }

  /**
   * 从 orderedList 中删除项目
   */
  function removeOrderedItem(uuid: string) {
    if (!editingGlyph.value) return
    
    const glyph = editingGlyph.value
    if (!glyph.orderedList) return
    
    const index = glyph.orderedList.findIndex(item => item.uuid === uuid)
    if (index >= 0) {
      glyph.orderedList.splice(index, 1)
    }
  }

  /**
   * 插入组件
   */
  function insertComponent(component: IGlyphComponent, options: { uuid: string; pos: 'prev' | 'next' }) {
    if (!editingGlyph.value) return false
    
    const glyph = editingGlyph.value
    glyph.components.push(component)
    
    // 插入到 orderedList
    insertOrderedItem({
      type: 'component',
      uuid: component.uuid,
    }, options)
    
    return true
  }

  /**
   * 插入 orderedList 项目
   */
  function insertOrderedItem(
    item: { type: string; uuid: string },
    options: { uuid: string; pos: 'prev' | 'next' }
  ) {
    if (!editingGlyph.value) return
    
    const glyph = editingGlyph.value
    if (!glyph.orderedList) {
      glyph.orderedList = []
    }
    
    const index = glyph.orderedList.findIndex(item => item.uuid === options.uuid)
    if (index === -1) {
      // 如果找不到，直接添加到末尾
      glyph.orderedList.push(item)
      return
    }
    
    if (options.pos === 'prev') {
      glyph.orderedList.splice(index, 0, item)
    } else {
      glyph.orderedList.splice(index + 1, 0, item)
    }
  }

  /**
   * 设置排序列表
   */
  function setOrderedList(list: Array<{ type: string; uuid: string }>) {
    if (!editingGlyph.value) return
    editingGlyph.value.orderedList = list
  }

  /**
   * 设置组件选择（支持多选）
   */
  function setSelection(uuid: string) {
    if (!editingGlyph.value) return
    
    const glyph = editingGlyph.value
    if (!glyph.selectedComponentsUUIDs) {
      glyph.selectedComponentsUUIDs = []
    }
    
    if (uuid) {
      if (enableMultiSelect.value) {
        const index = glyph.selectedComponentsUUIDs.indexOf(uuid)
        if (index === -1) {
          glyph.selectedComponentsUUIDs.push(uuid)
        } else {
          glyph.selectedComponentsUUIDs.splice(index, 1)
        }
        // 多选模式下，始终将 selectedComponentUUID 设置为当前点击的组件
        selectedComponentUUID.value = uuid
      } else {
        glyph.selectedComponentsUUIDs = [uuid]
        // 同步更新 selectedComponentUUID
        selectedComponentUUID.value = uuid
      }
    } else {
      glyph.selectedComponentsUUIDs = []
      selectedComponentUUID.value = ''
    }
  }

  /**
   * 设置剪贴板
   */
  function setClipBoard(components: IGlyphComponent | IGlyphComponent[]) {
    clipBoard.value = Array.isArray(components) ? R.clone(components) : [R.clone(components)]
  }

  /**
   * 添加组件到当前编辑的字形
   */
  function addComponent(component: IGlyphComponent) {
    if (!editingGlyph.value) return false

    const glyph = editingGlyph.value
    glyph.components.push(component)

    // 添加到 orderedList
    if (!glyph.orderedList) {
      glyph.orderedList = []
    }
    glyph.orderedList.push({
      type: 'component',
      uuid: component.uuid,
    })

    // 选中新添加的组件
    selectComponent(component.uuid)

    return true
  }

  /**
   * 更新字形参数
   */
  function updateGlyphParameter(glyphUUID: string, paramName: string, value: any) {
    const glyph = editingGlyph.value
    if (!glyph || glyph.uuid !== glyphUUID) return false

    if (Array.isArray(glyph.parameters)) {
      const param = glyph.parameters.find(p => p.name === paramName)
      if (param) {
        param.value = value
        return true
      }
    } else if (
      glyph.parameters &&
      typeof glyph.parameters === 'object' &&
      typeof (glyph.parameters as Map<string, any>).get === 'function'
    ) {
      const param = (glyph.parameters as Map<string, { name: string; value: any }>).get(paramName)
      if (param) {
        param.value = value
        return true
      }
    }
    return false
  }

  return {
    // State
    editingGlyphUUID,
    selectedComponentUUID,
    selectedComponentsTree,
    glyphCategory,
    clipBoard,
    enableMultiSelect,
    glyphListVersion,
    lastUpdatedGlyphUUID,
    
    // Getters
    editingGlyph,
    selectedComponent,
    orderedListWithItemsForCurrentGlyph,
    orderedListForCurrentGlyph,
    selectedComponentsUUIDs,
    selectedComponents,
    usedComponents,
    
    // Actions
    setEditingGlyph,
    setEditingGlyphUUID,
    setEditGlyphByUUID,
    resetEditGlyph,
    updateGlyphListFromEditFile,
    getGlyphInstance,
    selectComponent,
    clearSelection,
    updateComponent,
    updateGlyphParameter,
    modifyComponent,
    removeComponent,
    insertComponent,
    setOrderedList,
    setSelection,
    setClipBoard,
    addComponent,
  }
})
