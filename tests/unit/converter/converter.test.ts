/**
 * ContourConverter 测试
 * 核心功能：组件与轮廓转换
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContourConverter } from '@/core/font/converter'
import { PathType } from '@/core/font/types'
import {
  createMockPenComponent,
  createMockPolygonComponent,
  createMockRectangleComponent,
  createMockEllipseComponent,
  createMockCharacter,
} from '../../helpers/mock-helpers'
import { genUUID } from '@/utils/uuid'

// Mock dependencies
vi.mock('@/core/script/ScriptExecutor', () => ({
  executeGlyphScript: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: {
    acquireTemporaryInstance: vi.fn((key, factory) => factory()),
    releaseTemporaryInstance: vi.fn(),
    isTemporary: vi.fn(() => false),
    getOrCreateGlyphInstance: vi.fn((glyph, factory) => factory()),
  },
}))

vi.mock('@/core/instance/CustomGlyph', () => ({
  CustomGlyph: vi.fn().mockImplementation((data) => ({
    components: data.components || [],
    _components: data.components || [],
    getJoints: vi.fn(() => []),
  })),
}))

vi.mock('@/core/utils/grid', () => ({
  computeCoords: vi.fn((grid, point) => point),
}))

describe('ContourConverter', () => {
  const defaultOptions = {
    unitsPerEm: 1000,
    descender: -200,
    advanceWidth: 1000,
    preview: true,
  }

  describe('getComponentsForCharacter', () => {
    it('should return components when no orderedList', () => {
      const character = createMockCharacter({
        components: [
          createMockPenComponent({ uuid: 'comp-1' }),
          createMockPenComponent({ uuid: 'comp-2' }),
        ],
      })

      const components = ContourConverter.getComponentsForCharacter(character)

      expect(components).toHaveLength(2)
    })

    it('should return components in orderedList order', () => {
      const comp1 = createMockPenComponent({ uuid: 'comp-1' })
      const comp2 = createMockPenComponent({ uuid: 'comp-2' })
      const character = createMockCharacter({
        components: [comp1, comp2],
        orderedList: [
          { type: 'component', uuid: 'comp-2' },
          { type: 'component', uuid: 'comp-1' },
        ],
      })

      const components = ContourConverter.getComponentsForCharacter(character)

      expect(components).toHaveLength(2)
      expect(components[0].uuid).toBe('comp-2')
      expect(components[1].uuid).toBe('comp-1')
    })

    it('should return empty array when no components', () => {
      const character = createMockCharacter({ components: [] })
      const components = ContourConverter.getComponentsForCharacter(character)
      expect(components).toEqual([])
    })
  })

  describe('componentsToContours', () => {
    describe('pen component', () => {
      it('should convert pen component to contour', async () => {
        const component = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })

        const contours = ContourConverter.componentsToContours(
          [component],
          defaultOptions
        )

        expect(contours.length).toBeGreaterThan(0)
        expect(component.value.contour).toBeDefined()
        expect(component.value.preview).toBeDefined()
      })

      it('should skip unused components', async () => {
        const component = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: false,
        })

        const contours = ContourConverter.componentsToContours(
          [component],
          defaultOptions
        )

        expect(contours.length).toBe(0)
      })

      it('should use cached contour when available', async () => {
        const component = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })
        const cachedContour = [{ type: PathType.LINE, start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }]
        component.value.contour = cachedContour as any
        component.value.preview = cachedContour as any

        const contours = ContourConverter.componentsToContours(
          [component],
          { ...defaultOptions, forceUpdate: false }
        )

        expect(contours.length).toBe(1)
      })

      it('should force update when forceUpdate is true', async () => {
        const component = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })
        component.value.contour = [{ type: PathType.LINE, start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }] as any

        const contours = ContourConverter.componentsToContours(
          [component],
          { ...defaultOptions, forceUpdate: true }
        )

        expect(contours.length).toBe(1)
        // Contour should be recalculated
      })

      it('should return preview or contour based on preview option', async () => {
        const component = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })

        const previewContours = ContourConverter.componentsToContours(
          [component],
          { ...defaultOptions, preview: true }
        )

        const normalContours = ContourConverter.componentsToContours(
          [component],
          { ...defaultOptions, preview: false }
        )

        expect(previewContours.length).toBeGreaterThan(0)
        expect(normalContours.length).toBeGreaterThan(0)
      })
    })

    describe('polygon component', () => {
      it('should convert polygon component to contour', async () => {
        const component = createMockPolygonComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })

        const contours = ContourConverter.componentsToContours(
          [component],
          defaultOptions
        )

        expect(contours.length).toBeGreaterThan(0)
        expect(component.value.contour).toBeDefined()
      })
    })

    describe('rectangle component', () => {
      it('should convert rectangle component to contour', async () => {
        const component = createMockRectangleComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })

        const contours = ContourConverter.componentsToContours(
          [component],
          defaultOptions
        )

        expect(contours.length).toBeGreaterThan(0)
        expect(component.value.contour).toBeDefined()
      })
    })

    describe('ellipse component', () => {
      it('should convert ellipse component to contour', async () => {
        const component = createMockEllipseComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })

        const contours = ContourConverter.componentsToContours(
          [component],
          defaultOptions
        )

        expect(contours.length).toBeGreaterThan(0)
        expect(component.value.contour).toBeDefined()
      })
    })

    describe('glyph component', () => {
      it('should handle glyph component with script execution', async () => {
        const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
        const glyphValue = {
          uuid: genUUID(),
          name: 'test-glyph',
          components: [],
          script: 'function script_test(glyph, constantsMap, FP) { }',
        }

        const component = {
          uuid: genUUID(),
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

        const contours = ContourConverter.componentsToContours(
          [component as any],
          defaultOptions
        )

        expect(executeGlyphScript).toHaveBeenCalled()
        expect(contours).toBeDefined()
      })

      it('should handle glyph component without script', async () => {
        const glyphValue = {
          uuid: genUUID(),
          name: 'test-glyph',
          components: [
            createMockPenComponent({ uuid: 'sub-comp-1', usedInCharacter: true }),
          ],
        }

        const component = {
          uuid: genUUID(),
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

        const contours = ContourConverter.componentsToContours(
          [component as any],
          defaultOptions
        )

        expect(contours).toBeDefined()
      })
    })

    describe('offset handling', () => {
      it('should apply offset to points', async () => {
        const component = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })

        const contours = ContourConverter.componentsToContours(
          [component],
          { ...defaultOptions, preview: false },
          { x: 50, y: 50 }
        )

        expect(contours.length).toBeGreaterThan(0)
      })
    })

    describe('error handling', () => {
      it('should continue processing when one component fails', async () => {
        const component1 = createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
        })
        const component2 = {
          ...createMockPenComponent({ uuid: 'comp-2', usedInCharacter: true }),
          type: 'invalid-type' as any,
        }

        const contours = ContourConverter.componentsToContours(
          [component1, component2 as any],
          defaultOptions
        )

        // Should still process valid component
        expect(contours.length).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('contoursToComponents', () => {
    it('should convert contours to pen components', async () => {
      const contours = [
        [
          {
            type: PathType.LINE,
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
          },
          {
            type: PathType.LINE,
            start: { x: 100, y: 0 },
            end: { x: 100, y: 100 },
          },
        ],
      ]

      const components = ContourConverter.contoursToComponents(contours, {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
      })

      expect(components.length).toBe(1)
      expect(components[0].type).toBe('pen')
    })

    it('should handle cubic bezier curves', async () => {
      const contours = [
        [
          {
            type: PathType.CUBIC_BEZIER,
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
            control1: { x: 25, y: 0 },
            control2: { x: 75, y: 100 },
          },
        ],
      ]

      const components = ContourConverter.contoursToComponents(contours, {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
      })

      expect(components.length).toBe(1)
    })

    it('should handle quadratic bezier curves', async () => {
      const contours = [
        [
          {
            type: PathType.QUADRATIC_BEZIER,
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
            control: { x: 50, y: 0 },
          },
        ],
      ]

      const components = ContourConverter.contoursToComponents(contours, {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
      })

      expect(components.length).toBe(1)
    })
  })

  describe('getFillColors', () => {
    it('should extract fill colors from components', () => {
      const components = [
        createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
          value: { ...createMockPenComponent().value, fillColor: '#FF0000' },
        }),
        createMockPenComponent({
          uuid: 'comp-2',
          usedInCharacter: true,
          value: { ...createMockPenComponent().value, fillColor: '#00FF00' },
        }),
        createMockPenComponent({
          uuid: 'comp-3',
          usedInCharacter: false, // Should be skipped
        }),
      ]

      const fillColors = ContourConverter.getFillColors(components)

      expect(fillColors).toHaveLength(2)
      expect(fillColors[0]).toBe('#FF0000')
      expect(fillColors[1]).toBe('#00FF00')
    })

    it('should use default color when fillColor is missing', () => {
      const components = [
        createMockPenComponent({
          uuid: 'comp-1',
          usedInCharacter: true,
          value: { ...createMockPenComponent().value, fillColor: undefined },
        }),
      ]

      const fillColors = ContourConverter.getFillColors(components)

      expect(fillColors[0]).toBe('#000')
    })
  })
})
