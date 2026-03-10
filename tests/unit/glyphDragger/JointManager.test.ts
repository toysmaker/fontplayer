/**
 * JointManager 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JointManager } from '@/features/tools/glyphDragger/core/JointManager'
import { createMockGlyph } from '../../helpers/mock-helpers'

// Mock dependencies
vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: {
    isTemporary: vi.fn(() => false),
    acquireTemporaryInstance: vi.fn((key, factory) => factory()),
    getOrCreateGlyphInstance: vi.fn((glyph, factory) => factory()),
  },
}))

vi.mock('@/core/instance/CustomGlyph', () => ({
  CustomGlyph: vi.fn().mockImplementation((data) => ({
    getJoints: vi.fn(() => [
      { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' },
      { name: 'joint2', x: 100, y: 100, uuid: 'joint-2' },
    ]),
  })),
}))

describe('JointManager', () => {
  describe('getJoints', () => {
    it('should return empty array for non-glyph component', () => {
      const component = {
        uuid: 'comp-1',
        type: 'pen',
        value: {},
      }

      const joints = JointManager.getJoints(component as any, 'comp-1')

      expect(joints).toEqual([])
    })

    it('should return joints for glyph component', () => {
      const glyphValue = createMockGlyph({ uuid: 'glyph-1' })
      const component = {
        uuid: 'comp-1',
        type: 'glyph',
        value: glyphValue,
        ox: 10,
        oy: 20,
      }

      const joints = JointManager.getJoints(component as any, 'comp-1')

      expect(joints.length).toBeGreaterThan(0)
    })

    it('should apply component offset to joints', () => {
      const glyphValue = createMockGlyph({ uuid: 'glyph-1' })
      const component = {
        uuid: 'comp-1',
        type: 'glyph',
        value: glyphValue,
        ox: 10,
        oy: 20,
      }

      const joints = JointManager.getJoints(component as any, 'comp-1', 10, 20)

      // Joints should have offset applied
      expect(joints.length).toBeGreaterThan(0)
    })

    it('should return empty array when glyph instance not available', async () => {
      const { instanceManager } = await import('@/core/instance/InstanceManager')
      ;(instanceManager.acquireTemporaryInstance as any).mockReturnValue(null)

      const glyphValue = createMockGlyph({ uuid: 'glyph-1' })
      const component = {
        uuid: 'comp-1',
        type: 'glyph',
        value: glyphValue,
      }

      const joints = JointManager.getJoints(component as any, 'comp-1')

      expect(joints).toEqual([])
    })
  })

  describe('findHitJoint', () => {
    it('should find joint near mouse position', () => {
      const joints = [
        { name: 'joint1', x: 10, y: 10, uuid: 'joint-1' },
        { name: 'joint2', x: 100, y: 100, uuid: 'joint-2' },
      ]

      const hit = JointManager.findHitJoint(joints, 12, 12, 5)

      expect(hit).toEqual(joints[0])
    })

    it('should return null when no joint near', () => {
      const joints = [
        { name: 'joint1', x: 10, y: 10, uuid: 'joint-1' },
      ]

      const hit = JointManager.findHitJoint(joints, 100, 100, 5)

      expect(hit).toBeNull()
    })

    it('should skip ref joints', () => {
      const joints = [
        { name: 'joint1_ref', x: 10, y: 10, uuid: 'joint-1' },
        { name: 'joint2', x: 100, y: 100, uuid: 'joint-2' },
      ]

      const hit = JointManager.findHitJoint(joints, 12, 12, 5)

      expect(hit).toBeNull() // Should skip ref joint
    })

    it('should handle function x/y values', () => {
      const joints = [
        { name: 'joint1', x: () => 10, y: () => 10, uuid: 'joint-1' },
      ]

      const hit = JointManager.findHitJoint(joints, 12, 12, 5)

      expect(hit).toEqual(joints[0])
    })
  })

  describe('findHoverJoint', () => {
    it('should find hover joint', () => {
      const joints = [
        { name: 'joint1', x: 10, y: 10, uuid: 'joint-1' },
      ]

      const hover = JointManager.findHoverJoint(joints, 12, 12, 5)

      expect(hover).toEqual(joints[0])
    })
  })

  describe('isFirstJoint', () => {
    it('should identify first joint', () => {
      const joints = [
        { name: 'joint1', x: 10, y: 10, uuid: 'joint-1' },
        { name: 'joint2', x: 100, y: 100, uuid: 'joint-2' },
      ]

      expect(JointManager.isFirstJoint(joints[0], joints)).toBe(true)
      expect(JointManager.isFirstJoint(joints[1], joints)).toBe(false)
    })

    it('should skip ref joints when determining first', () => {
      const joints = [
        { name: 'joint1_ref', x: 10, y: 10, uuid: 'joint-1' },
        { name: 'joint2', x: 100, y: 100, uuid: 'joint-2' },
      ]

      expect(JointManager.isFirstJoint(joints[1], joints)).toBe(true)
    })
  })
})
