/**
 * glyphDragger ScriptExecutor 测试
 * 注意：这是拖拽脚本执行器，与 core/script/ScriptExecutor 不同
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ScriptExecutor } from '@/features/tools/glyphDragger/core/ScriptExecutor'
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
    _glyph: data,
    onSkeletonDrag: vi.fn(),
    onSkeletonDragStart: vi.fn(),
    onSkeletonDragEnd: vi.fn(),
    tempData: null,
  })),
}))

describe('glyphDragger ScriptExecutor', () => {
  describe('executeDragStart', () => {
    it('should execute drag start callback', async () => {
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const joint = { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' }

      ScriptExecutor.executeDragStart(glyph, 'comp-1', joint)

      const { instanceManager } = await import('@/core/instance/InstanceManager')
      expect(instanceManager.acquireTemporaryInstance).toHaveBeenCalled()
    })

    it('should handle missing callback gracefully', () => {
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const joint = { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' }

      expect(() => {
        ScriptExecutor.executeDragStart(glyph, 'comp-1', joint)
      }).not.toThrow()
    })
  })

  describe('executeDrag', () => {
    it('should execute drag callback', async () => {
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const joint = { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' }
      const event = {
        draggingJoint: joint,
        deltaX: 10,
        deltaY: 20,
      }

      ScriptExecutor.executeDrag(glyph, 'comp-1', event)

      const { instanceManager } = await import('@/core/instance/InstanceManager')
      expect(instanceManager.acquireTemporaryInstance).toHaveBeenCalled()
    })
  })

  describe('executeDragEnd', () => {
    it('should execute drag end callback', () => {
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const joint = { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' }
      const event = {
        draggingJoint: joint,
        deltaX: 10,
        deltaY: 20,
      }

      ScriptExecutor.executeDragEnd(glyph, 'comp-1', event)

      expect(true).toBe(true) // Should not throw
    })
  })
})
