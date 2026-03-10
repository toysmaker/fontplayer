/**
 * 渲染器集成测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { CharacterRenderer } from '@/core/font/CharacterRenderer'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { render } from '@/core/canvas/EditorCanvasRenderer'
import { ContourConverter } from '@/core/font/converter'
import { createMockCharacter, createMockGlyph, createMockPenComponent } from '../helpers/mock-helpers'
import { createMockCanvas } from '../helpers/test-utils'

// Mock Pinia store
vi.mock('@/stores/editor', () => ({
  useEditorStore: vi.fn(() => ({
    // Mock store methods if needed
  })),
}))

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

describe('Renderer Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('character preview rendering flow', () => {
    it('should render character preview from components', async () => {
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

      const result = await CharacterRenderer.renderPreview(character, canvas)

      expect(result).toBe(true)
    })
  })

  describe('glyph preview rendering flow', () => {
    it('should render glyph preview', async () => {
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const canvas = createMockCanvas(100, 100)

      const result = await GlyphRenderer.renderPreview(canvas, glyph)

      expect(result).toBe(true)
    })
  })

  describe('editor canvas rendering flow', () => {
    it('should render character in editor mode', async () => {
      const canvas = createMockCanvas(100, 100)
      const character = createMockCharacter({
        uuid: 'char-1',
        components: [
          createMockPenComponent({
            uuid: 'comp-1',
            visible: true,
            usedInCharacter: true,
          }),
        ],
      })

      await render(canvas, true, false, {
        mode: 'character',
        character,
        components: character.components,
      })

      // Should not throw
      expect(true).toBe(true)
    })

    it('should render glyph in editor mode', async () => {
      const canvas = createMockCanvas(100, 100)
      const glyph = createMockGlyph({ uuid: 'glyph-1' })

      await render(canvas, true, false, {
        mode: 'glyph',
        glyph,
      })

      // Should not throw
      expect(true).toBe(true)
    })
  })
})
