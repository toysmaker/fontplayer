/**
 * CustomGlyph 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CustomGlyph } from '@/core/script/CustomGlyph'
import { createMockGlyph } from '../../helpers/mock-helpers'
import { createMockCanvas } from '../../helpers/test-utils'

// Mock dependencies
vi.mock('@/core/canvas/EditorCanvasRenderer', () => ({
  renderCanvas: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/core/script/globals', () => ({
  fontRenderStyle: {
    value: 'black',
  },
}))

vi.mock('@/core/utils/glyph', () => ({
  orderedListWithItemsForGlyph: vi.fn((glyph) => glyph.components || []),
}))

describe('CustomGlyph', () => {
  let glyph: CustomGlyph

  beforeEach(() => {
    const glyphData = createMockGlyph({ uuid: 'glyph-1', name: 'test-glyph' })
    glyph = new CustomGlyph(glyphData)
  })

  describe('constructor', () => {
    it('should create CustomGlyph instance', () => {
      expect(glyph).toBeInstanceOf(CustomGlyph)
      expect((glyph as any)._glyph.uuid).toBe('glyph-1')
    })
  })

  describe('getJoints', () => {
    it('should return joints from glyph data', () => {
      const glyphData = createMockGlyph({
        uuid: 'glyph-1',
        joints: [
          { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' },
        ] as any,
      })
      const glyph = new CustomGlyph(glyphData)
      
      const joints = glyph.getJoints()
      
      expect(joints.length).toBeGreaterThan(0)
    })

    it('should return empty array when no joints', () => {
      const joints = glyph.getJoints()
      expect(joints).toEqual([])
    })
  })

  describe('addJoint', () => {
    it('should add joint', () => {
      const joint = { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' } as any
      glyph.addJoint(joint)
      
      const joints = glyph.getJoints()
      expect(joints).toContain(joint)
    })
  })

  describe('addComponent', () => {
    it('should add component', async () => {
      const { PenComponent } = await import('@/core/script/PenComponent')
      const component = new PenComponent()
      
      glyph.addComponent(component)
      
      expect((glyph as any)._components).toContain(component)
    })
  })

  describe('clear', () => {
    it('should clear joints and components', async () => {
      const joint = { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' } as any
      glyph.addJoint(joint)
      const { PenComponent } = await import('@/core/script/PenComponent')
      glyph.addComponent(new PenComponent())
      
      glyph.clear()
      
      expect(glyph.getJoints()).toEqual([])
      expect((glyph as any)._components).toEqual([])
    })
  })

  describe('getParam', () => {
    it('should get parameter value', () => {
      const glyphData = createMockGlyph({
        uuid: 'glyph-1',
        parameters: [
          { uuid: '1', name: 'weight', type: 0, value: 100, min: 0, max: 1000 },
        ],
      })
      const glyph = new CustomGlyph(glyphData)
      
      const value = glyph.getParam('weight')
      
      expect(value).toBe(100)
    })

    it('should return undefined when parameter not found', () => {
      const value = glyph.getParam('non-existent')
      expect(value).toBeUndefined()
    })
  })

  describe('render', () => {
    it('should render glyph to canvas', async () => {
      const canvas = createMockCanvas(100, 100)
      const { renderCanvas } = await import('@/core/canvas/EditorCanvasRenderer')
      
      glyph.render(canvas, true, { x: 0, y: 0 }, false, 1, '#000')
      
      expect(renderCanvas).toHaveBeenCalled()
    })
  })
})
