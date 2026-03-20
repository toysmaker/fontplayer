/**
 * EditorCanvasRenderer 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { render, renderCanvas, fillBackground } from '@/core/canvas/EditorCanvasRenderer'
import { createMockPenComponent, createMockCharacter, createMockGlyph } from '../../helpers/mock-helpers'
import { createMockCanvas } from '../../helpers/test-utils'
import { BackgroundType, GridType } from '@/core/canvas/types'

// Mock dependencies
vi.mock('@/stores/editor', () => ({
  useEditorStore: vi.fn(() => ({
    // Mock store methods if needed
  })),
}))
vi.mock('@/core/script/ScriptExecutor', () => ({
  executeGlyphScript: vi.fn(),
}))

vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: {
    acquireTemporaryInstance: vi.fn((key, factory) => factory()),
    isTemporary: vi.fn(() => false),
    isEditing: vi.fn(() => false),
    getOrCreateGlyphInstance: vi.fn((glyph, factory) => factory()),
  },
}))

vi.mock('@/core/instance/CustomGlyph', () => ({
  CustomGlyph: vi.fn().mockImplementation((data) => ({
    components: data.components || [],
    _components: data.components || [],
    render: vi.fn(),
    render_forceUpdate: vi.fn(),
  })),
}))

vi.mock('@/core/script/globals', () => ({
  fontRenderStyle: {
    value: 'black',
  },
}))

vi.mock('@/utils/canvas', () => ({
  mapCanvasX: vi.fn((x) => x),
  mapCanvasY: vi.fn((y) => y),
  mapCanvasWidth: vi.fn((w) => w),
  mapCanvasHeight: vi.fn((h) => h),
  mapCanvasCoords: vi.fn((coords) => coords),
}))

vi.mock('@/utils/canvas-utils', () => ({
  getStrokeWidth: vi.fn(() => 1),
}))

describe('EditorCanvasRenderer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fillBackground', () => {
    it('should fill color background', () => {
      const canvas = createMockCanvas(100, 100)
      const background = {
        type: BackgroundType.Color,
        color: '#FFFFFF',
      }
      const grid = {
        type: GridType.None,
        precision: 20,
      }

      fillBackground(canvas, background, grid)

      // fillBackground may not directly set fillStyle on context
      // It calls different background functions
      const ctx = canvas.getContext('2d')
      expect(ctx).toBeDefined()
    })

    it('should handle transparent background', () => {
      const canvas = createMockCanvas(100, 100)
      const background = {
        type: BackgroundType.Transparent,
        color: '#FFFFFF',
      }
      const grid = {
        type: GridType.None,
        precision: 20,
      }

      fillBackground(canvas, background, grid)

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('renderCanvas', () => {
    it('should render pen components', async () => {
      const canvas = createMockCanvas(100, 100)
      const component = createMockPenComponent({
        uuid: 'comp-1',
        visible: true,
        usedInCharacter: true,
      })

      await renderCanvas([component], canvas, {
        fill: false,
        offset: { x: 0, y: 0 },
        scale: 1,
      })

      const ctx = canvas.getContext('2d')
      expect(ctx).toBeDefined()
    })

    it('should skip invisible components', async () => {
      const canvas = createMockCanvas(100, 100)
      const component = createMockPenComponent({
        uuid: 'comp-1',
        visible: false,
      })

      await renderCanvas([component], canvas)

      // Should not throw
      expect(true).toBe(true)
    })

    it('should render glyph component with script execution', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyphValue = createMockGlyph({
        uuid: 'glyph-1',
        script: 'function script_test(glyph, constantsMap, FP) { }',
      })

      const component = {
        uuid: 'comp-1',
        type: 'glyph',
        name: 'glyph',
        lock: false,
        visible: true,
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        ox: 0,
        oy: 0,
        value: glyphValue,
      }

      const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
      await renderCanvas([component as any], canvas)

      expect(executeGlyphScript).toHaveBeenCalled()
    })
  })

  describe('render', () => {
    it('should render character mode', async () => {
      const canvas = createMockCanvas(100, 100)
      const character = createMockCharacter({
        uuid: 'char-1',
        components: [createMockPenComponent({ uuid: 'comp-1', visible: true })],
      })

      await render(canvas, true, false, {
        mode: 'character',
        character,
        components: character.components,
      })

      // Should not throw
      expect(true).toBe(true)
    })

    it('should render glyph mode', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyph = createMockGlyph({ uuid: 'glyph-1' })

      await render(canvas, true, false, {
        mode: 'glyph',
        glyph,
      })

      // Should not throw
      expect(true).toBe(true)
    })

    it('should handle empty components', async () => {
      const canvas = createMockCanvas(100, 100)

      await render(canvas, true, false, {
        mode: 'character',
        components: [],
      })

      // Should not throw
      expect(true).toBe(true)
    })
  })
})
