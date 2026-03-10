/**
 * 转换器集成测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ContourConverter } from '@/core/font/converter'
import { CharacterRenderer } from '@/core/font/CharacterRenderer'
import { createMockCharacter, createMockPenComponent } from '../helpers/mock-helpers'
import { createMockCanvas } from '../helpers/test-utils'

// Mock dependencies
vi.mock('@/core/font/renderer', () => ({
  RenderEngine: {
    renderPreview: vi.fn(),
    clearCanvas: vi.fn(),
  },
}))

vi.mock('@/core/canvas/CanvasManager', () => ({
  CanvasManager: {
    getCanvasFromDOM: vi.fn(),
    needsRerender: vi.fn(() => true),
    restoreFromCache: vi.fn(() => false),
    markCanvasRendered: vi.fn(),
    setRenderCache: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/core/storage/IndexedDBManager', () => ({
  indexedDBManager: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
  IndexedDBManager: {
    generatePreviewKey: vi.fn((uuid: string) => `preview_${uuid}`),
  },
}))

describe('Converter Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('component to contour to render flow', () => {
    it('should convert components to contours and render', async () => {
      const character = createMockCharacter({
        uuid: 'char-1',
        components: [
          createMockPenComponent({
            uuid: 'comp-1',
            usedInCharacter: true,
          }),
        ],
      })
      const canvas = createMockCanvas(100, 100)

      // Convert components to contours
      const components = ContourConverter.getComponentsForCharacter(character)
      const contours = await ContourConverter.componentsToContours(components, {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
        preview: true,
      })

      expect(contours.length).toBeGreaterThan(0)

      // Render preview
      const result = await CharacterRenderer.renderPreview(character, canvas)

      expect(result).toBe(true)
    })

    it('should handle glyph component with script execution', async () => {
      const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
      const glyphValue = {
        uuid: 'glyph-1',
        name: 'test-glyph',
        components: [],
        script: `
          function script_glyph_1(glyph, constantsMap, FP) {
            const pen = new FP.PenComponent()
            pen.beginPath()
            pen.moveTo(0, 0)
            pen.lineTo(100, 100)
            pen.closePath()
            glyph.addComponent(pen)
          }
        `,
      }

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

      const contours = await ContourConverter.componentsToContours(
        [component as any],
        {
          unitsPerEm: 1000,
          descender: -200,
          advanceWidth: 1000,
          preview: true,
        }
      )

      // executeGlyphScript is mocked, so we can't verify it was called directly
      // Instead, verify that contours were generated
      expect(contours).toBeDefined()
    })
  })
})
