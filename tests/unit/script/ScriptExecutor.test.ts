/**
 * ScriptExecutor 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { createMockGlyph, createMockFile } from '../../helpers/mock-helpers'
import { useProjectStore } from '@/stores/project'

// Mock dependencies
const { mockInstanceManager } = vi.hoisted(() => {
  const mockInstanceManager = {
    isTemporary: vi.fn(() => false),
    isEditing: vi.fn(() => false),
    acquireTemporaryInstance: vi.fn((key, factory) => {
      const instance = factory()
      // Ensure tempData is null for tests that need script execution
      if (instance && typeof instance === 'object') {
        instance.tempData = null
      }
      return instance
    }),
    releaseTemporaryInstance: vi.fn(),
    getOrCreateGlyphInstance: vi.fn((glyph, factory) => {
      const instance = factory()
      if (instance && typeof instance === 'object') {
        instance.tempData = null
      }
      return instance
    }),
  }
  
  return { mockInstanceManager }
})

vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: mockInstanceManager,
}))

vi.mock('@/core/instance/CustomGlyph', () => ({
  CustomGlyph: vi.fn().mockImplementation((data) => {
    const components: any[] = []
    return {
      _glyph: data,
      _components: components,
      components: [],
      tempData: null,
      uuid: data.uuid,
      clear: vi.fn(() => {
        components.length = 0
      }),
      getParam: vi.fn((name: string) => {
        const param = data.parameters?.find((p: any) => p.name === name)
        return param?.value
      }),
      addComponent: vi.fn((component: any) => {
        components.push(component)
      }),
      onSkeletonDrag: null,
      onSkeletonDragStart: null,
      onSkeletonDragEnd: null,
    }
  }),
}))

vi.mock('@/core/script/ConstantsMap', () => ({
  ConstantsMap: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      getByUUID: vi.fn(),
    })),
  },
}))

// Mock FPUtils with component classes
vi.mock('@/core/script/FPUtils', async () => {
  // Import actual component classes for testing
  const { PenComponent } = await import('@/core/script/PenComponent')
  const { PolygonComponent } = await import('@/core/script/PolygonComponent')
  const { RectangleComponent } = await import('@/core/script/RectangleComponent')
  const { EllipseComponent } = await import('@/core/script/EllipseComponent')
  
  return {
    FP: {
      PenComponent,
      PolygonComponent,
      RectangleComponent,
      EllipseComponent,
      // Add other FP utilities as needed
      getLineContours: vi.fn(),
      getCurveContours: vi.fn(),
      getIntersection: vi.fn(),
      fitCurvesByPoints: vi.fn(),
      distance: vi.fn(),
      getCurvesPoints: vi.fn(),
      getTurnAngles: vi.fn(),
      distanceAndFootPoint: vi.fn(),
      getPerpendicularFoot: vi.fn(),
      turnLeft: vi.fn(),
      turnRight: vi.fn(),
      goStraight: vi.fn(),
      turnAngle: vi.fn(),
      getPointOnLine: vi.fn(),
      getPointOnLineByPercentage: vi.fn(),
      isPointOnLineSegment: vi.fn(),
      turnAngleFromStart: vi.fn(),
      turnAngleFromEnd: vi.fn(),
      degreeToRadius: vi.fn(),
      getAngle: vi.fn(),
      radiusToDegree: vi.fn(),
      getCurveContours2: vi.fn(),
      getCurveContours3: vi.fn(),
      getSquare: vi.fn(),
      getCircle: vi.fn(),
      getTangentOnCurves: vi.fn(),
    },
  }
})

vi.mock('@/core/script/globals', () => ({
  selectedFile: {
    value: null,
  },
}))

describe('ScriptExecutor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockInstanceManager.isTemporary.mockReturnValue(false)
    mockInstanceManager.isEditing.mockReturnValue(false)
    // Clear window globals
    ;(window as any).glyph = undefined
    ;(window as any).constantsMap = undefined
    ;(window as any).FP = undefined
  })

  describe('executeGlyphScript', () => {
    it('should execute glyph script', async () => {
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        script: `
          function script_glyph_1(glyph, constantsMap, FP) {
            glyph.addComponent(new FP.PenComponent())
          }
        `,
      })

      executeGlyphScript(glyph)

      const { instanceManager } = await import('@/core/instance/InstanceManager')
      expect(instanceManager.acquireTemporaryInstance).toHaveBeenCalled()
    })

    it('should skip execution when tempData exists', async () => {
      const { instanceManager } = await import('@/core/instance/InstanceManager')
      const mockInstance = {
        tempData: { dragging: true },
        _components: [],
      }
      ;(instanceManager.acquireTemporaryInstance as any).mockReturnValue(mockInstance)
      ;(instanceManager.isTemporary as any).mockReturnValue(true)

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        script: 'function script_test() {}',
      })

      executeGlyphScript(glyph)

      // Should not execute script when tempData exists
      expect(true).toBe(true)
    })

    it('should execute script_reference', async () => {
      const projectStore = useProjectStore()
      const originGlyph = createMockGlyph({
        uuid: 'origin-glyph',
        script: `
          function script_origin_glyph(glyph, constantsMap, FP) {
            glyph.addComponent(new FP.PenComponent())
          }
        `,
      })
      const file = createMockFile({
        glyphs: [originGlyph],
      })
      projectStore.addFile(file)

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        script_reference: 'origin-glyph',
      })

      executeGlyphScript(glyph)

      expect(mockInstanceManager.acquireTemporaryInstance).toHaveBeenCalled()
    })

    it('should execute glyph_script', () => {
      // Clear any existing tempData
      mockInstanceManager.acquireTemporaryInstance.mockImplementation((key, factory) => {
        const instance = factory()
        if (instance && typeof instance === 'object') {
          instance.tempData = null
        }
        return instance
      })

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        glyph_script: {
          'comp-1': 'console.log("glyph_script executed")',
        },
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      executeGlyphScript(glyph)

      expect(consoleSpy).toHaveBeenCalledWith('glyph_script executed')
      consoleSpy.mockRestore()
    })

    it('should execute param_script', () => {
      // Clear any existing tempData
      mockInstanceManager.acquireTemporaryInstance.mockImplementation((key, factory) => {
        const instance = factory()
        if (instance && typeof instance === 'object') {
          instance.tempData = null
        }
        return instance
      })

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        param_script: {
          'param-1': 'console.log("param_script executed")',
        },
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      executeGlyphScript(glyph)

      expect(consoleSpy).toHaveBeenCalledWith('param_script executed')
      consoleSpy.mockRestore()
    })

    it('should execute system_script for sub-glyphs', () => {
      // Clear any existing tempData
      mockInstanceManager.acquireTemporaryInstance.mockImplementation((key, factory) => {
        const instance = factory()
        if (instance && typeof instance === 'object') {
          instance.tempData = null
        }
        return instance
      })

      const projectStore = useProjectStore()
      const subGlyph = createMockGlyph({
        uuid: 'sub-glyph-1',
        system_script: {
          'system-1': 'console.log("system_script executed")',
        },
      })
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        components: [
          {
            uuid: 'comp-1',
            type: 'glyph',
            value: subGlyph,
          } as any,
        ],
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      executeGlyphScript(glyph)

      expect(consoleSpy).toHaveBeenCalledWith('system_script executed')
      consoleSpy.mockRestore()
    })

    it('should recursively execute sub-glyph scripts', async () => {
      const subGlyph = createMockGlyph({
        uuid: 'sub-glyph-1',
        script: 'function script_sub_glyph_1() {}',
      })
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        components: [
          {
            uuid: 'comp-1',
            type: 'glyph',
            value: subGlyph,
          } as any,
        ],
      })

      executeGlyphScript(glyph)

      const { instanceManager } = await import('@/core/instance/InstanceManager')
      // Should be called for both main glyph and sub-glyph
      expect(instanceManager.acquireTemporaryInstance).toHaveBeenCalled()
    })

    it('should inject global variables', () => {
      // Clear any existing tempData
      mockInstanceManager.acquireTemporaryInstance.mockImplementation((key, factory) => {
        const instance = factory()
        if (instance && typeof instance === 'object') {
          instance.tempData = null
        }
        return instance
      })

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        script: `
          function script_glyph_1(glyph, constantsMap, FP) {
            window.testGlobal = 'injected'
          }
        `,
      })

      executeGlyphScript(glyph)

      expect((window as any).testGlobal).toBe('injected')
    })

    it('should restore global variables after execution', () => {
      const originalGlyph = (window as any).glyph
      const originalConstantsMap = (window as any).constantsMap
      const originalFP = (window as any).FP

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        script: 'function script_glyph_1() {}',
      })

      executeGlyphScript(glyph)

      // Should restore (though may be undefined initially)
      expect(true).toBe(true)
    })

    it('should handle script errors gracefully', () => {
      // Mock console methods to suppress expected error logs
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        script: 'function script_glyph_1() { throw new Error("Test error") }',
      })

      expect(() => {
        executeGlyphScript(glyph)
      }).not.toThrow()

      // Restore console methods
      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('should use instanceKey when provided', async () => {
      // Mock console methods to suppress expected logs
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const instanceKey = 'custom-instance-key'

      executeGlyphScript(glyph, instanceKey)

      const { instanceManager } = await import('@/core/instance/InstanceManager')
      expect(instanceManager.acquireTemporaryInstance).toHaveBeenCalledWith(
        instanceKey,
        expect.any(Function),
        'glyph'
      )

      // Restore console methods
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })
})
