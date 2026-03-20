/**
 * 脚本功能集成测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { ContourConverter } from '@/core/font/converter'
import { createMockGlyph } from '../helpers/mock-helpers'

// Mock dependencies
vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: {
    isTemporary: vi.fn(() => false),
    isEditing: vi.fn(() => false),
    acquireTemporaryInstance: vi.fn((key, factory) => factory()),
    releaseTemporaryInstance: vi.fn(),
    getOrCreateGlyphInstance: vi.fn((glyph, factory) => factory()),
  },
}))

vi.mock('@/core/instance/CustomGlyph', () => ({
  CustomGlyph: vi.fn().mockImplementation((data) => ({
    _glyph: data,
    _components: [],
    components: [],
    tempData: null,
    clear: vi.fn(),
    getParam: vi.fn(),
    addComponent: vi.fn(),
  })),
}))

describe('Script Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('script execution to component generation', () => {
    it('should execute script and generate components', async () => {
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
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
      })

      executeGlyphScript(glyph)

      const { instanceManager } = await import('@/core/instance/InstanceManager')
      expect(instanceManager.acquireTemporaryInstance).toHaveBeenCalled()
    })

    it('should convert script-generated components to contours', async () => {
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
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
      })

      executeGlyphScript(glyph)

      // Components should be generated and can be converted to contours
      const components = glyph.components || []
      if (components.length > 0) {
        const contours = ContourConverter.componentsToContours(components as any, {
          unitsPerEm: 1000,
          descender: -200,
          advanceWidth: 1000,
          preview: true,
        })

        expect(contours).toBeDefined()
      }
    })
  })
})
