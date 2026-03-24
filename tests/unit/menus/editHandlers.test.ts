import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditHandlers } from '@/features/editor/menus/editHandlers'

vi.mock('@/features/editor/actions/editActions', () => ({
  doCut: vi.fn(),
  doCopy: vi.fn(),
  doPaste: vi.fn(),
  doDelete: vi.fn(),
}))

import { doCut, doCopy, doPaste, doDelete } from '@/features/editor/actions/editActions'

describe('createEditHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wires cut/copy/paste/delete to editActions', () => {
    const handlers = createEditHandlers({} as any)
    handlers.cut()
    handlers.copy()
    handlers.paste()
    handlers.delete()
    expect(doCut).toHaveBeenCalledTimes(1)
    expect(doCopy).toHaveBeenCalledTimes(1)
    expect(doPaste).toHaveBeenCalledTimes(1)
    expect(doDelete).toHaveBeenCalledTimes(1)
  })

  it('undo/redo are defined', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const handlers = createEditHandlers({} as any)
    handlers.undo()
    handlers.redo()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
