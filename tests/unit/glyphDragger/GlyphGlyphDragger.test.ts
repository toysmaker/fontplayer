/**
 * GlyphGlyphDragger 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GlyphGlyphDragger } from '@/features/tools/glyphDragger/adapters/GlyphGlyphDragger'
import { createMockCanvas } from '../../helpers/test-utils'
import { createMockGlyph } from '../../helpers/mock-helpers'

// Mock dependencies
vi.mock('@/features/tools/glyphDragger/core/JointManager', () => ({
  JointManager: {
    getJoints: vi.fn(() => []),
  },
}))

describe('GlyphGlyphDragger', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = createMockCanvas(100, 100)
  })

  describe('getOrigin', () => {
    it('should return component origin', () => {
      const component = {
        uuid: 'comp-1',
        type: 'glyph',
        ox: 10,
        oy: 20,
        value: createMockGlyph({ uuid: 'glyph-1' }),
      }
      const config = {
        canvas,
        context: {
          mode: 'glyph' as const,
          component,
          componentUUID: 'comp-1',
        },
        glyphStore: {
          updateComponent: vi.fn(),
        },
      }
      const dragger = new GlyphGlyphDragger(config as any)

      const origin = (dragger as any).getOrigin()
      expect(origin.ox).toBe(10)
      expect(origin.oy).toBe(20)
    })
  })

  describe('handleGlyphDrag', () => {
    it('should update component position', () => {
      const component = {
        uuid: 'comp-1',
        type: 'glyph',
        ox: 0,
        oy: 0,
        value: createMockGlyph({ uuid: 'glyph-1' }),
      }
      const config = {
        canvas,
        context: {
          mode: 'glyph' as const,
          component,
          componentUUID: 'comp-1',
        },
        glyphStore: {
          updateComponent: vi.fn(),
        },
        onUpdate: vi.fn(),
      }
      const dragger = new GlyphGlyphDragger(config as any)

      ;(dragger as any).handleGlyphDrag(10, 20)

      expect(component.ox).toBe(10)
      expect(component.oy).toBe(20)
      expect(config.onUpdate).toHaveBeenCalled()
    })
  })
})
