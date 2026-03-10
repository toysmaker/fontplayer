/**
 * DraggerManager 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DraggerManager } from '@/features/tools/glyphDragger/core/DraggerManager'
import { createMockCanvas } from '../../helpers/test-utils'
import { createMockGlyph } from '../../helpers/mock-helpers'

// Mock adapters
vi.mock('@/features/tools/glyphDragger/adapters/CharacterGlyphDragger', () => ({
  CharacterGlyphDragger: vi.fn().mockImplementation((config) => ({
    getMode: () => 'character',
    updateContext: vi.fn(),
    updateConfig: vi.fn(),
    destroy: vi.fn(),
  })),
}))

vi.mock('@/features/tools/glyphDragger/adapters/GlyphGlyphDragger', () => ({
  GlyphGlyphDragger: vi.fn().mockImplementation((config) => ({
    getMode: () => 'glyph',
    updateContext: vi.fn(),
    updateConfig: vi.fn(),
    destroy: vi.fn(),
  })),
}))

describe('DraggerManager', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = createMockCanvas(100, 100)
    vi.clearAllMocks()
  })

  describe('getOrCreate', () => {
    it('should create dragger instance for character mode', () => {
      const config = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      const dragger = DraggerManager.getOrCreate(canvas, 'character', config as any)

      expect(dragger).toBeDefined()
      expect(dragger.getMode()).toBe('character')
    })

    it('should create dragger instance for glyph mode', () => {
      const config = {
        canvas,
        context: {
          mode: 'glyph',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      const dragger = DraggerManager.getOrCreate(canvas, 'glyph', config as any)

      expect(dragger).toBeDefined()
      expect(dragger.getMode()).toBe('glyph')
    })

    it('should return existing instance for same canvas', () => {
      const config = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      const dragger1 = DraggerManager.getOrCreate(canvas, 'character', config as any)
      const dragger2 = DraggerManager.getOrCreate(canvas, 'character', config as any)

      expect(dragger1).toBe(dragger2)
    })

    it('should recreate instance when mode changes', () => {
      const config1 = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }
      const config2 = {
        canvas,
        context: {
          mode: 'glyph',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      const dragger1 = DraggerManager.getOrCreate(canvas, 'character', config1 as any)
      const dragger2 = DraggerManager.getOrCreate(canvas, 'glyph', config2 as any)

      expect(dragger1.getMode()).toBe('character')
      expect(dragger2.getMode()).toBe('glyph')
      expect(dragger1).not.toBe(dragger2)
    })

    it('should update existing instance when mode matches', () => {
      const config = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      const dragger1 = DraggerManager.getOrCreate(canvas, 'character', config as any)
      const newConfig = { ...config, context: { ...config.context, componentUUID: 'comp-2' } }
      const dragger2 = DraggerManager.getOrCreate(canvas, 'character', newConfig as any)

      expect(dragger1).toBe(dragger2)
      expect(dragger1.updateContext).toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('should remove and destroy dragger instance', () => {
      const config = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      const dragger = DraggerManager.getOrCreate(canvas, 'character', config as any)
      DraggerManager.remove(canvas)

      expect(dragger.destroy).toHaveBeenCalled()
      expect(DraggerManager.get(canvas)).toBeUndefined()
    })
  })

  describe('get', () => {
    it('should return dragger instance if exists', () => {
      const config = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      DraggerManager.getOrCreate(canvas, 'character', config as any)
      const dragger = DraggerManager.get(canvas)

      expect(dragger).toBeDefined()
    })

    it('should return undefined if instance not exists', () => {
      const dragger = DraggerManager.get(canvas)
      expect(dragger).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true if instance exists', () => {
      const config = {
        canvas,
        context: {
          mode: 'character',
          component: {} as any,
          componentUUID: 'comp-1',
        },
      }

      DraggerManager.getOrCreate(canvas, 'character', config as any)
      expect(DraggerManager.has(canvas)).toBe(true)
    })

    it('should return false if instance not exists', () => {
      expect(DraggerManager.has(canvas)).toBe(false)
    })
  })
})
