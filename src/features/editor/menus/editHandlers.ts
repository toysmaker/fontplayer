import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import { doCut, doCopy, doPaste, doDelete } from '@/features/editor/actions/editActions'

export function createEditHandlers(_ctx: MenuHandlerContext): MenuHandlersMap {
  const handleUndo = () => {
    if (import.meta.env.DEV) { console.log('Undo') }
  }

  const handleRedo = () => {
    if (import.meta.env.DEV) { console.log('Redo') }
  }

  const handleCut = () => {
    doCut()
  }

  const handleCopy = () => {
    doCopy()
  }

  const handlePaste = () => {
    doPaste()
  }

  const handleDelete = () => {
    doDelete()
  }

  return {
    'undo': handleUndo,
    'redo': handleRedo,
    'cut': handleCut,
    'copy': handleCopy,
    'paste': handlePaste,
    'delete': handleDelete,
  }
}

