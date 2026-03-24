import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ToolManager } from '@/features/tools/base/ToolManager'
import type { BaseTool } from '@/features/tools/base/BaseTool'
import type { ToolType } from '@/features/tools/base/types'

function mockTool(): BaseTool {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn(),
    deactivate: vi.fn(),
    cleanup: vi.fn(),
    getRenderFunction: vi.fn().mockReturnValue(null),
  } as unknown as BaseTool
}

describe('ToolManager', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ToolManager.reset()
  })

  afterEach(() => {
    ToolManager.reset()
  })

  it('registerTool, switchTool, getToolRenderFunction', async () => {
    const m = ToolManager.getInstance()
    m.registerTool('pen', mockTool())
    m.registerTool('select', mockTool())
    await m.switchTool('pen')
    expect(m.getCurrentToolType()).toBe('pen')
    expect(m.getTool('pen')).not.toBeNull()
    expect(m.getToolRenderFunction('pen')).toBeNull()
    await m.switchTool('select')
    expect(m.getCurrentToolType()).toBe('select')
    expect(m.getCurrentToolRenderFunction()).toBeNull()
  })

  it('switchTool with missing tool leaves current cleared after deactivate', async () => {
    const m = ToolManager.getInstance()
    m.registerTool('pen', mockTool())
    await m.switchTool('pen')
    await m.switchTool('rectangle' as ToolType)
    expect(m.getCurrentTool()).toBeNull()
  })

  it('cleanupAll clears tools', () => {
    const m = ToolManager.getInstance()
    const t = mockTool()
    m.registerTool('pen', t)
    m.cleanupAll()
    expect(m.getTool('pen')).toBeNull()
  })
})
