/**
 * GlyphRenderer 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { createMockGlyph, createMockFontSettings } from '../../helpers/mock-helpers'
import { createMockCanvas } from '../../helpers/test-utils'

// Mock dependencies
vi.mock('@/core/font/converter', () => ({
  ContourConverter: {
    componentsToContours: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('@/core/font/renderer', () => ({
  RenderEngine: {
    clearCanvas: vi.fn(),
    renderPreview: vi.fn(),
  },
}))

vi.mock('@/core/canvas/CanvasManager', () => ({
  CanvasManager: {
    needsRerender: vi.fn(() => true),
    restoreFromCache: vi.fn(() => false),
    markCanvasRendered: vi.fn(),
    setRenderCache: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/core/storage/IndexedDBManager', () => ({
  indexedDBManager: {
    get: vi.fn().mockResolvedValue(null),
  },
  IndexedDBManager: {
    generatePreviewKey: vi.fn((uuid: string) => `preview_${uuid}`),
  },
}))

vi.mock('@/core/script/ScriptExecutor', () => ({
  executeGlyphScript: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: {
    acquireTemporaryInstance: vi.fn((key, factory) => factory()),
    releaseTemporaryInstance: vi.fn(),
    getOrCreateGlyphInstance: vi.fn((glyph, factory) => factory()),
    isTemporary: vi.fn(() => false),
    isEditing: vi.fn(() => false),
  },
}))

vi.mock('@/stores/project', () => ({
  useProjectStore: vi.fn(() => ({
    fontPreviewStyle: 'black',
  })),
}))

vi.mock('@/core/instance/CustomGlyph', () => ({
  CustomGlyph: vi.fn().mockImplementation((data) => ({
    components: data.components || [],
  })),
}))

describe('GlyphRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('renderPreview', () => {
    it('should render glyph preview', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyph = createMockGlyph({ uuid: 'glyph-1', name: 'test-glyph' })
      const fontSettings = createMockFontSettings()

      const { ContourConverter } = await import('@/core/font/converter')
      ;(ContourConverter.componentsToContours as any).mockReturnValue([
        [{ type: 0, start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }],
      ])

      const result = await GlyphRenderer.renderPreview(canvas, glyph, fontSettings)

      expect(result).toBe(true)
    })

    it('should return false for invalid canvas or glyph', async () => {
      const result1 = await GlyphRenderer.renderPreview(null as any, null as any)
      expect(result1).toBe(false)

      const canvas = createMockCanvas(100, 100)
      const result2 = await GlyphRenderer.renderPreview(canvas, null as any)
      expect(result2).toBe(false)
    })

    it('should load preview from IndexedDB when available', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        previewRef: 'preview_glyph-1',
      })
      const previewData = [[{ type: 0, start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }]]

      const { indexedDBManager } = await import('@/core/storage/IndexedDBManager')
      ;(indexedDBManager.get as any).mockResolvedValue(previewData)

      const { CanvasManager } = await import('@/core/canvas/CanvasManager')
      ;(CanvasManager.needsRerender as any).mockReturnValue(true)

      const result = await GlyphRenderer.renderPreview(canvas, glyph)

      expect(result).toBe(true)
      expect(indexedDBManager.get).toHaveBeenCalledWith('preview_glyph-1')
    })

    it('should execute script when glyph has script but no components', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        components: [],
        script: `
          function script_glyph_1(glyph, constantsMap, FP) {
            // Empty script for testing
          }
        `,
      })

      const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
      const { ContourConverter } = await import('@/core/font/converter')
      ;(ContourConverter.componentsToContours as any).mockReturnValue([])

      await GlyphRenderer.renderPreview(canvas, glyph)

      expect(executeGlyphScript).toHaveBeenCalled()
    })

    it('should clear canvas when no contours', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyph = createMockGlyph({ uuid: 'glyph-1', components: [] })

      const { ContourConverter } = await import('@/core/font/converter')
      ;(ContourConverter.componentsToContours as any).mockReturnValue([])

      const { RenderEngine } = await import('@/core/font/renderer')
      const result = await GlyphRenderer.renderPreview(canvas, glyph)

      expect(result).toBe(true)
      expect(RenderEngine.clearCanvas).toHaveBeenCalledWith(canvas)
    })
  })
})
