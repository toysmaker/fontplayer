/**
 * RectangleTool 测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RectangleTool } from '@/features/tools/rectangle/RectangleTool'
import { createMockCanvas } from '../../helpers/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'

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

describe('RectangleTool', () => {
  let canvas: HTMLCanvasElement
  let config: any

  beforeEach(() => {
    setActivePinia(createPinia())
    canvas = createMockCanvas(500, 500)
    
    const characterStore = {
      addComponent: vi.fn(),
      updateComponent: vi.fn(),
      selectedComponent: null,
      editingCharacter: { components: [] },
    }
    
    const glyphStore = {
      addComponent: vi.fn(),
      updateComponent: vi.fn(),
      selectedComponent: null,
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

    RectangleTool.reset()
  })

  afterEach(() => {
    RectangleTool.reset()
  })

  describe('单例模式', () => {
    it('should create instance with canvas and config', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      expect(tool).toBeInstanceOf(RectangleTool)
      expect(tool.name).toBe('rectangle')
    })

    it('should return same instance on subsequent calls', () => {
      const tool1 = RectangleTool.getInstance(canvas, config)
      const tool2 = RectangleTool.getInstance()
      expect(tool1).toBe(tool2)
    })

    it('should throw error if called without canvas/config on first call', () => {
      RectangleTool.reset()
      expect(() => RectangleTool.getInstance()).toThrow('canvas and config are required')
    })
  })

  describe('初始化', () => {
    it('should initialize tool state', async () => {
      const tool = RectangleTool.getInstance(canvas, config)
      await tool.init()
      expect(tool.isToolActive()).toBe(false)
    })
  })

  describe('激活和停用', () => {
    it('should activate tool', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      expect(tool.isToolActive()).toBe(true)
    })

    it('should deactivate tool', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      tool.deactivate()
      expect(tool.isToolActive()).toBe(false)
    })

    it('should bind events on activate', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      const addEventListenerSpy = vi.spyOn(canvas, 'addEventListener')
      tool.activate()
      expect(addEventListenerSpy).toHaveBeenCalled()
    })

    it('should unbind events on deactivate', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      const removeEventListenerSpy = vi.spyOn(canvas, 'removeEventListener')
      tool.deactivate()
      expect(removeEventListenerSpy).toHaveBeenCalled()
    })
  })

  describe('渲染函数', () => {
    it('should return render function when active', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      const renderFn = tool.getRenderFunction()
      expect(renderFn).toBeDefined()
      expect(typeof renderFn).toBe('function')
    })

    it('should render without errors', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      const renderFn = tool.getRenderFunction()
      expect(() => renderFn?.(canvas)).not.toThrow()
    })
  })

  describe('清理', () => {
    it('should cleanup tool resources', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      tool.cleanup()
      expect(tool.isToolActive()).toBe(false)
    })
  })

  describe('鼠标事件', () => {
    it('should handle mouse down to start rectangle', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
      })
      
      expect(() => canvas.dispatchEvent(mouseEvent)).not.toThrow()
    })

    it('should handle mouse move to resize rectangle', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      
      // Start drawing
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
      })
      canvas.dispatchEvent(mouseDownEvent)
      
      // Move mouse
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 200,
      })
      expect(() => canvas.dispatchEvent(mouseMoveEvent)).not.toThrow()
    })

    it('should handle mouse up to finish rectangle', () => {
      const tool = RectangleTool.getInstance(canvas, config)
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
    it('should handle Shift key to create square', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      
      const keyDownEvent = new KeyboardEvent('keydown', {
        key: 'Shift',
        shiftKey: true,
      })
      
      expect(() => window.dispatchEvent(keyDownEvent)).not.toThrow()
    })

    it('should handle Shift key up to release square mode', () => {
      const tool = RectangleTool.getInstance(canvas, config)
      tool.activate()
      
      const keyUpEvent = new KeyboardEvent('keyup', {
        key: 'Shift',
        shiftKey: false,
      })
      
      expect(() => window.dispatchEvent(keyUpEvent)).not.toThrow()
    })
  })
})
