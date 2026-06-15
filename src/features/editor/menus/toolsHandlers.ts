import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import type { IComponent } from '@/core/types'
import { EditStatus } from '@/core/types'
import { ContourConverter } from '@/core/font/converter'
import { removeOverlapFromContours, pathToEditingPenComponents } from '@/features/editor/services/RemoveOverlapService'

export function createToolsHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, dialog, formatContainerGlyphComponents, message, characterStore, editorStore, glyphStore } = ctx

  const handleRemoveOverlap = async () => {
    const file = projectStore.selectedFile
    if (!file) return

    const status = editorStore.editStatus
    const isCharacter = status === EditStatus.Edit
    const isGlyph = status === EditStatus.Glyph
    if (!isCharacter && !isGlyph) return

    const orderedComponents = isCharacter
      ? characterStore.orderedListWithItemsForCurrentCharacterFile
      : glyphStore.orderedListWithItemsForCurrentGlyph
    const editingEntity = isCharacter ? characterStore.editingCharacter : glyphStore.editingGlyph

    if (!editingEntity || !orderedComponents || orderedComponents.length === 0) {
      message.info(isCharacter ? '当前字符没有组件，无需去除重叠。' : '当前字形没有组件，无需去除重叠。')
      return
    }

    try {
      const contours = ContourConverter.componentsToContoursEditing(
        orderedComponents as IComponent[],
        { x: 0, y: 0 }
      )
      if (!contours || contours.length === 0) {
        message.info('无法生成轮廓，请检查组件数据。')
        return
      }

      const result = removeOverlapFromContours(contours)
      if (!result) {
        message.info('轮廓已优化或无需去除重叠。')
        return
      }
      const { path: unitedPath, pathsToRemove } = result
      const newComponents = pathToEditingPenComponents(unitedPath)
      pathsToRemove.forEach((p) => p.remove())
      unitedPath.remove()
      if (!newComponents.length) {
        message.warning('合并后未得到有效组件。')
        return
      }

      const orderedList = newComponents.map((c) => ({ type: 'component', uuid: c.uuid }))

      ;(editingEntity as any).components = newComponents
      ;(editingEntity as any).orderedList = orderedList
      if ('script' in editingEntity) (editingEntity as any).script = undefined
      if ('glyph_script' in editingEntity) (editingEntity as any).glyph_script = undefined
      ;(editingEntity as any).previewRef = undefined
      ;(editingEntity as any).contourRef = undefined

      if (isCharacter) {
        ;(characterStore as any).updateCharacterListFromEditFile()
      } else {
        ;(glyphStore as any).updateGlyphListFromEditFile()
      }
      projectStore.markFileUnsaved(file.uuid)
      message.success(isCharacter ? '已对当前字符去除重叠。' : '已对当前字形去除重叠。')

      window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
      const { CanvasManager } = await import('@/core/canvas/CanvasManager')
      CanvasManager.forceCleanupAllCache()
    } catch (err) {
      console.error('Remove overlap failed:', err)
      message.error('去除重叠时发生错误，请重试。')
    }
  }

  const handleFormatAllCharacters = () => {
    const file = projectStore.selectedFile
    if (!file) return

    const doFormat = async () => {
      const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
      const { CanvasManager } = await import('@/core/canvas/CanvasManager')

      projectStore.loadingMessage = '正在格式化字符...'
      projectStore.loadingProgress = 0
      projectStore.loadingTotal = file.characterList.length
      projectStore.loading = true

      let changed = 0
      try {
        for (let i = 0; i < file.characterList.length; i++) {
          const metadata = file.characterList[i]
          const ch = await characterDataManager.loadCharacter(file.uuid, metadata.uuid)

          if (ch && ch.components && ch.components.length > 0) {
            const container = {
              components: ch.components as IComponent[],
              orderedList: (ch as any).orderedList,
            }
            if (formatContainerGlyphComponents(container)) {
              changed++
              ch.components = container.components
              ;(ch as any).orderedList = container.orderedList
              ch.previewRef = undefined
              ch.contourRef = undefined
              await characterDataManager.updateCharacter(file.uuid, ch)
            }
          }

          projectStore.loadingProgress = i + 1
        }
      } finally {
        projectStore.loading = false
      }

      if (changed > 0) {
        CanvasManager.forceCleanupAllCache()
        window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
        projectStore.markFileUnsaved(file.uuid)
        message.success(`已格式化 ${changed} 个字符中的字形组件。`)
      } else {
        message.info('当前工程中没有可格式化的字形组件。')
      }
    }

    dialog.warning({
      title: '格式化全部字符',
      content:
        '将对当前工程中的所有字符执行”格式化字形组件”，把脚本字形组件转换为普通轮廓组件。该操作不可撤销，建议先保存工程，是否继续？',
      positiveText: '继续格式化',
      negativeText: '取消',
      onPositiveClick: () => {
        doFormat()
      },
    })
  }

  const handleFormatCurrentCharacter = () => {
    const file = projectStore.selectedFile
    const editing = characterStore.editingCharacter
    if (!file || !editing) return

    const doFormat = () => {
      const container = {
        components: editing.components as IComponent[],
        orderedList: editing.orderedList as any,
      }
      const changed = formatContainerGlyphComponents(container)
      if (!changed) {
        message.info('当前字符中没有可格式化的字形组件。')
        return
      }

      editing.components = container.components
      editing.orderedList = container.orderedList
      ;(characterStore as any).updateCharacterListFromEditFile()

      projectStore.markFileUnsaved(file.uuid)
      message.success('当前字符已格式化（脚本字形组件已展开为普通轮廓组件）。')
    }

    dialog.warning({
      title: '格式化当前字符',
      content:
        '将把当前编辑字符中的所有脚本字形组件转换为普通轮廓组件。该操作不可撤销，建议先保存工程，是否继续？',
      positiveText: '继续格式化',
      negativeText: '取消',
      onPositiveClick: doFormat,
    })
  }

  function handleComponentBoolean(op: string) {
    window.dispatchEvent(new CustomEvent('editor-component-boolean', { detail: { operation: op } }))
  }
  return {
    'remove_overlap': handleRemoveOverlap,
    'format-all-characters': handleFormatAllCharacters,
    'format-current-character': handleFormatCurrentCharacter,
    'component-union': () => handleComponentBoolean('union'),
    'component-intersect': () => handleComponentBoolean('intersect'),
    'component-subtract': () => handleComponentBoolean('subtract'),
  }
}

