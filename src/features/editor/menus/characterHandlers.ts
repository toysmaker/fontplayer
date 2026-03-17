import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'

export function createCharacterHandlers(_ctx: MenuHandlerContext): MenuHandlersMap {
  const handleAddCharacter = () => {
    window.dispatchEvent(new CustomEvent('editor-add-character'))
  }

  const handleAddIcon = () => {
    window.dispatchEvent(new CustomEvent('editor-add-icon'))
  }

  return {
    'add-character': handleAddCharacter,
    'add-icon': handleAddIcon,
  }
}

