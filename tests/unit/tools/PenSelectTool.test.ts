/**
 * PenSelectTool 测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PenSelectTool, editModeFixedBounds } from '@/features/tools/select/PenSelectTool'
import { createMockCanvas } from '../../helpers/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { createMockPenComponent } from '../../helpers/mock-helpers'

// Mock stores
vi.mock('@/stores/character', () => ({
  useCharacterStore: vi.fn(),
}))

vi.mock('@/stores/glyph', () => ({
  useGlyphStore: vi.fn(),
}))

vi.mock('@/stores/project', () => ({
  useProjectStore: vi.fn(),
}))

describe('PenSelectTool', () => {
  let canvas: HTMLCanvasElement
  let config: any

  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = createMockCanvas(500, 500)
    
    const characterStore = {
      selectedComponent: null,
      updateComponent: vi.fn(),
      editingCharacter: { components: [] },
    }
    
    const glyphStore = {
      selectedComponent: null,
      updateComponent: vi.fn(),
      editingGlyph: { components: [] },
    }
    
    const projectStore = {
      selectedFile: { fontSettings: { unitsPerEm: 1000 } },
    }

    vi.mocked(useCharacterStore).mockReturnValue(characterStore as any)
    vi.mocked(useGlyphStore).mockReturnValue(glyphStore as any)
    vi.mocked(useProjectStore).mockReturnValue(projectStore as any)

    config = {
      canvas,
      mode: 'character' as const,
      getCoord: (coord: number) => coord,
      onRender: vi.fn(),
    }

    PenSelectTool.reset()
    editModeFixedBounds.clear()
  })

  afterEach(() => {
    PenSelectTool.reset()
    editModeFixedBounds.clear()
  })

  describe('单例模式', () => {
    it('should create instance with canvas and config', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      expect(tool).toBeInstanceOf(PenSelectTool)
      expect(tool.name).toBe('pen-select')
    })

    it('should return same instance on subsequent calls', () => {
      const tool1 = PenSelectTool.getInstance(canvas, config)
      const tool2 = PenSelectTool.getInstance()
      expect(tool1).toBe(tool2)
    })

    it('should throw error if called without canvas/config on first call', () => {
      PenSelectTool.reset()
      expect(() => PenSelectTool.getInstance()).toThrow('canvas and config are required')
    })
  })

  describe('初始化', () => {
    it('should initialize tool state', async () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      await tool.init()
      expect(tool.isToolActive()).toBe(false)
    })

    it('should reset initial bounds', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.resetInitialBounds()
      expect(tool).toBeDefined()
    })
  })

  describe('拖拽状态', () => {
    it('should return false when not dragging', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      expect(tool.isDragging()).toBe(false)
    })
  })

  describe('激活和停用', () => {
    it('should activate tool', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      expect(tool.isToolActive()).toBe(true)
    })

    it('should deactivate tool', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      tool.deactivate()
      expect(tool.isToolActive()).toBe(false)
    })

    it('should bind events on activate', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      const addEventListenerSpy = vi.spyOn(canvas, 'addEventListener')
      tool.activate()
      expect(addEventListenerSpy).toHaveBeenCalled()
    })

    it('should unbind events on deactivate', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      const removeEventListenerSpy = vi.spyOn(canvas, 'removeEventListener')
      tool.deactivate()
      expect(removeEventListenerSpy).toHaveBeenCalled()
    })
  })

  describe('渲染函数', () => {
    it('should return render function when active', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      const renderFn = tool.getRenderFunction()
      expect(renderFn).toBeDefined()
      expect(typeof renderFn).toBe('function')
    })

    it('should render without errors', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      const renderFn = tool.getRenderFunction()
      expect(() => renderFn?.(canvas)).not.toThrow()
    })
  })

  describe('清理', () => {
    it('should cleanup tool resources', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      tool.cleanup()
      expect(tool.isToolActive()).toBe(false)
    })

    it('should clear editModeFixedBounds on reset', () => {
      editModeFixedBounds.set('test-uuid', { x: 0, y: 0, w: 100, h: 100 })
      PenSelectTool.reset()
      expect(editModeFixedBounds.size).toBe(0)
    })
  })

  describe('鼠标事件', () => {
    it('should handle mouse down', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
      })
      
      expect(() => canvas.dispatchEvent(mouseEvent)).not.toThrow()
    })

    it('should handle mouse move', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
      })
      
      expect(() => canvas.dispatchEvent(mouseEvent)).not.toThrow()
    })

    it('should handle mouse up', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: 100,
        clientY: 100,
        button: 0,
      })
      
      expect(() => canvas.dispatchEvent(mouseEvent)).not.toThrow()
    })
  })

  describe('键盘事件', () => {
    it('should handle Delete key', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
      })
      
      expect(() => window.dispatchEvent(keyEvent)).not.toThrow()
    })

    it('should handle Backspace key', () => {
      const tool = PenSelectTool.getInstance(canvas, config)
      tool.activate()
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Backspace',
      })
      
      expect(() => window.dispatchEvent(keyEvent)).not.toThrow()
    })
  })
})
