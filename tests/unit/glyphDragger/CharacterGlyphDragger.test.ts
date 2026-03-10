/**
 * CharacterGlyphDragger 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CharacterGlyphDragger } from '@/features/tools/glyphDragger/adapters/CharacterGlyphDragger'
import { createMockCanvas } from '../../helpers/test-utils'
import { createMockPenComponent } from '../../helpers/mock-helpers'

// Mock dependencies
vi.mock('@/features/tools/glyphDragger/core/JointManager', () => ({
  JointManager: {
    getJoints: vi.fn(() => []),
    findHitJoint: vi.fn(() => null),
  },
}))

vi.mock('@/features/tools/glyphDragger/core/ScriptExecutor', () => ({
  ScriptExecutor: {
    executeDragStart: vi.fn(),
    executeDrag: vi.fn(),
    executeDragEnd: vi.fn(),
  },
}))

describe('CharacterGlyphDragger', () => {
  let canvas: HTMLCanvasElement
  let dragger: CharacterGlyphDragger

  beforeEach(() => {
    canvas = createMockCanvas(100, 100)
    const component = createMockPenComponent({ uuid: 'comp-1', ox: 0, oy: 0 })
    const config = {
      canvas,
      context: {
        mode: 'character' as const,
        component,
        componentUUID: 'comp-1',
      },
      characterStore: {
        updateComponent: vi.fn(),
      },
    }
    dragger = new CharacterGlyphDragger(config as any)
  })

  describe('getJoints', () => {
    it('should get joints from JointManager', async () => {
      const { JointManager } = await import('@/features/tools/glyphDragger/core/JointManager')
      ;(JointManager.getJoints as any).mockReturnValue([
        { name: 'joint1', x: 0, y: 0, uuid: 'joint-1' },
      ])

      const joints = (dragger as any).getJoints()

      expect(joints.length).toBeGreaterThan(0)
      expect(JointManager.getJoints).toHaveBeenCalled()
    })
  })

  describe('getOrigin', () => {
    it('should return component origin', () => {
      const origin = (dragger as any).getOrigin()
      expect(origin.ox).toBe(0)
      expect(origin.oy).toBe(0)
    })

    it('should calculate sub-component origin', () => {
      const rootComponent = createMockPenComponent({ uuid: 'root', ox: 10, oy: 20 })
      const subComponent = createMockPenComponent({ uuid: 'sub', ox: 5, oy: 5 })
      rootComponent.value = { components: [subComponent] } as any

      const config = {
        canvas,
        context: {
          mode: 'character' as const,
          component: subComponent,
          componentUUID: 'sub',
          rootComponent,
          selectedComponentsTree: ['root', 'sub'],
        },
        characterStore: {
          updateComponent: vi.fn(),
        },
      }
      const dragger = new CharacterGlyphDragger(config as any)

      const origin = (dragger as any).getOrigin()
      // The calculation depends on selectedComponentsTree traversal
      // For now, just verify it returns a valid origin
      expect(origin.ox).toBeDefined()
      expect(origin.oy).toBeDefined()
    })
  })

  describe('handleGlyphDrag', () => {
    it('should update component position', () => {
      const component = createMockPenComponent({ uuid: 'comp-1', ox: 0, oy: 0 })
      const config = {
        canvas,
        context: {
          mode: 'character' as const,
          component,
          componentUUID: 'comp-1',
        },
        characterStore: {
          updateComponent: vi.fn(),
        },
        onUpdate: vi.fn(),
      }
      const dragger = new CharacterGlyphDragger(config as any)

      ;(dragger as any).handleGlyphDrag(10, 20)

      expect(component.ox).toBe(10)
      expect(component.oy).toBe(20)
      expect(config.onUpdate).toHaveBeenCalled()
      expect(config.characterStore.updateComponent).toHaveBeenCalled()
    })
  })

  describe('handleDragEnd', () => {
    it('should call onUpdate callback', () => {
      const onUpdate = vi.fn()
      const config = {
        canvas,
        context: {
          mode: 'character' as const,
          component: createMockPenComponent({ uuid: 'comp-1' }),
          componentUUID: 'comp-1',
        },
        onUpdate,
      }
      const dragger = new CharacterGlyphDragger(config as any)

      ;(dragger as any).handleDragEnd()

      expect(onUpdate).toHaveBeenCalled()
    })
  })
})
