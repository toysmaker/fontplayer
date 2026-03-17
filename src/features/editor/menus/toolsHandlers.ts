import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import type { IComponent } from '@/core/types'

export function createToolsHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, dialog, formatContainerGlyphComponents, message, characterStore } = ctx

  const handleRemoveOverlap = () => {
    console.log('Remove overlap')
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

  return {
    'remove_overlap': handleRemoveOverlap,
    'format-all-characters': handleFormatAllCharacters,
    'format-current-character': handleFormatCurrentCharacter,
  }
}

