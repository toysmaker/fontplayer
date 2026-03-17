/**
 * 编辑菜单动作：复制、粘贴、剪切、删除
 * 根据当前编辑状态（字符 / 字形）调用对应 store，供侧边栏与 Tauri 菜单共用。
 */

import * as R from 'ramda'
import { EditStatus } from '@/core/types'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { genUUID } from '@/utils/uuid'

export function doCut(): void {
  const editorStore = useEditorStore()
  const status = editorStore.editStatus

  if (status === EditStatus.Edit) {
    const characterStore = useCharacterStore()
    const selected = characterStore.selectedComponents
    if (!selected || selected.length === 0) return
    characterStore.setClipBoard(selected)
    selected.forEach((c) => characterStore.removeComponent(c.uuid))
    characterStore.clearSelection()
    return
  }

  if (status === EditStatus.Glyph) {
    const glyphStore = useGlyphStore()
    const selected = glyphStore.selectedComponents
    if (!selected || selected.length === 0) return
    glyphStore.setClipBoard(selected)
    selected.forEach((c) => glyphStore.removeComponent(c.uuid))
    glyphStore.setSelection('')
    return
  }
}

export function doCopy(): void {
  const editorStore = useEditorStore()
  const status = editorStore.editStatus

  if (status === EditStatus.Edit) {
    const characterStore = useCharacterStore()
    const selected = characterStore.selectedComponents
    if (!selected || selected.length === 0) return
    characterStore.setClipBoard(selected)
    return
  }

  if (status === EditStatus.Glyph) {
    const glyphStore = useGlyphStore()
    const selected = glyphStore.selectedComponents
    if (!selected || selected.length === 0) return
    glyphStore.setClipBoard(selected)
    return
  }
}

/**
 * 粘贴：有选中则粘贴到选中组件之后，无选中则粘贴到列表末尾。
 */
export function doPaste(): void {
  const editorStore = useEditorStore()
  const status = editorStore.editStatus

  if (status === EditStatus.Edit) {
    const characterStore = useCharacterStore()
    const components = characterStore.clipBoard.value
    if (!components || components.length === 0) return

    const orderedList = characterStore.orderedListForCurrentCharacterFile
    const selectedUUIDs = characterStore.selectedComponentsUUIDs
    const refUuid =
      selectedUUIDs && selectedUUIDs.length > 0
        ? selectedUUIDs[selectedUUIDs.length - 1]
        : orderedList.length > 0
          ? orderedList[orderedList.length - 1].uuid
          : ''

    for (let i = components.length - 1; i >= 0; i--) {
      const component = R.clone(components[i]) as typeof components[0]
      component.uuid = genUUID()
      characterStore.insertComponent(component, { uuid: refUuid, pos: 'next' })
    }
    return
  }

  if (status === EditStatus.Glyph) {
    const glyphStore = useGlyphStore()
    const components = glyphStore.clipBoard.value
    if (!components || components.length === 0) return

    const orderedList = glyphStore.orderedListForCurrentGlyph
    const selectedUUIDs = glyphStore.selectedComponentsUUIDs
    const refUuid =
      selectedUUIDs && selectedUUIDs.length > 0
        ? selectedUUIDs[selectedUUIDs.length - 1]
        : orderedList.length > 0
          ? orderedList[orderedList.length - 1].uuid
          : ''

    for (let i = components.length - 1; i >= 0; i--) {
      const component = R.clone(components[i]) as typeof components[0]
      component.uuid = genUUID()
      glyphStore.insertComponent(component, { uuid: refUuid, pos: 'next' })
    }
    return
  }
}

export function doDelete(): void {
  const editorStore = useEditorStore()
  const status = editorStore.editStatus

  if (status === EditStatus.Edit) {
    const characterStore = useCharacterStore()
    const selected = characterStore.selectedComponents
    if (!selected || selected.length === 0) return
    selected.forEach((c) => characterStore.removeComponent(c.uuid))
    characterStore.clearSelection()
    return
  }

  if (status === EditStatus.Glyph) {
    const glyphStore = useGlyphStore()
    const selected = glyphStore.selectedComponents
    if (!selected || selected.length === 0) return
    selected.forEach((c) => glyphStore.removeComponent(c.uuid))
    glyphStore.setSelection('')
    return
  }
}
