/**
 * 轮廓生成工具函数测试
 */

import { describe, it, expect } from 'vitest'
import {
  formatPoints,
  genPenContour,
  genPolygonContour,
  genRectangleContour,
  genEllipseContour,
} from '@/core/utils/contour'
import { PathType } from '@/core/font/types'

describe('contour utils', () => {
  describe('formatPoints', () => {
    it('should convert from edit to font coordinates (type 0)', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }]
      const options = {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
      }
      const result = formatPoints(points, options, 0)
      expect(result[0].x).toBe(0) // x + (unitsPerEm - advanceWidth) / 2 = 0 + 0
      expect(result[0].y).toBe(800) // unitsPerEm - y + descender = 1000 - 0 + (-200) = 800
      expect(result[1].x).toBe(100)
      expect(result[1].y).toBe(700) // 1000 - 100 + (-200) = 700
    })

    it('should convert from font to edit coordinates (type 1)', () => {
      const points = [{ x: 0, y: 800 }, { x: 100, y: 700 }]
      const options = {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
      }
      const result = formatPoints(points, options, 1)
      expect(result[0].x).toBe(0) // x - (unitsPerEm - advanceWidth) / 2 = 0 - 0
      expect(result[0].y).toBe(0) // unitsPerEm - (y - descender) = 1000 - (800 - (-200)) = 1000 - 1000 = 0
      expect(result[1].x).toBe(100)
      expect(result[1].y).toBe(100) // 1000 - (700 - (-200)) = 1000 - 900 = 100
    })

    it('should handle advanceWidth offset', () => {
      const points = [{ x: 0, y: 0 }]
      const options = {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 800,
      }
      const result = formatPoints(points, options, 0)
      expect(result[0].x).toBe(100) // (unitsPerEm - advanceWidth) / 2
    })

    it('should return original points for invalid type', () => {
      const points = [{ x: 10, y: 20 }]
      const options = {
        unitsPerEm: 1000,
        descender: -200,
        advanceWidth: 1000,
      }
      const result = formatPoints(points, options, 99)
      expect(result).toEqual(points)
    })
  })

  describe('genPenContour', () => {
    it('should generate pen contour from points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 30, y: 0 },
        { x: 40, y: 10 },
        { x: 50, y: 10 },
        { x: 60, y: 0 },
      ]
      const contour = genPenContour(points)
      // genPenContour processes points in groups of 4 (i+3), so with 7 points:
      // - First group: points[0-3] = 1 bezier
      // - Second group: points[3-6] = 1 bezier (overlaps with previous)
      // Actually it processes i=0,3,6... so with 7 points: i=0 (0-3) and i=3 (3-6)
      expect(contour.length).toBeGreaterThan(0)
      expect(contour[0].type).toBe(PathType.CUBIC_BEZIER)
    })

    it('should use round when useRound is true', () => {
      const points = [
        { x: 0.5, y: 0.5 },
        { x: 10.5, y: 10.5 },
        { x: 20.5, y: 10.5 },
        { x: 30.5, y: 0.5 },
      ]
      const contour = genPenContour(points, true)
      expect(contour[0].start.x).toBe(1) // Rounded
      expect(contour[0].start.y).toBe(1) // Rounded
    })

    it('should use floor when useRound is false', () => {
      const points = [
        { x: 0.5, y: 0.5 },
        { x: 10.5, y: 10.5 },
        { x: 20.5, y: 10.5 },
        { x: 30.5, y: 0.5 },
      ]
      const contour = genPenContour(points, false)
      expect(contour[0].start.x).toBe(0) // Floored
      expect(contour[0].start.y).toBe(0) // Floored
    })

    it('should handle points with less than 4 points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      const contour = genPenContour(points)
      expect(contour.length).toBe(0)
    })
  })

  describe('genPolygonContour', () => {
    it('should generate polygon contour from points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]
      const contour = genPolygonContour(points)
      expect(contour.length).toBe(3) // 3 lines for 4 points
      expect(contour[0].type).toBe(PathType.LINE)
      expect(contour[0].start).toEqual({ x: 0, y: 0 })
      expect(contour[0].end).toEqual({ x: 100, y: 0 })
    })

    it('should use round when useRound is true', () => {
      const points = [
        { x: 0.5, y: 0.5 },
        { x: 100.5, y: 0.5 },
      ]
      const contour = genPolygonContour(points, true)
      expect(contour[0].start.x).toBe(1) // Rounded
    })

    it('should handle single point', () => {
      const points = [{ x: 0, y: 0 }]
      const contour = genPolygonContour(points)
      expect(contour.length).toBe(0)
    })
  })

  describe('genRectangleContour', () => {
    it('should generate rectangle contour from points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]
      const contour = genRectangleContour(points)
      expect(contour.length).toBe(3) // 3 lines for 4 points
      expect(contour[0].type).toBe(PathType.LINE)
    })

    it('should use round when useRound is true', () => {
      const points = [
        { x: 0.5, y: 0.5 },
        { x: 100.5, y: 0.5 },
      ]
      const contour = genRectangleContour(points, true)
      expect(contour[0].start.x).toBe(1) // Rounded
    })
  })

  describe('genEllipseContour', () => {
    it('should generate ellipse contour from points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ]
      const contour = genEllipseContour(points)
      expect(contour.length).toBe(3) // 3 lines for 4 points
      expect(contour[0].type).toBe(PathType.LINE)
    })

    it('should use round when useRound is true', () => {
      const points = [
        { x: 0.5, y: 0.5 },
        { x: 100.5, y: 0.5 },
      ]
      const contour = genEllipseContour(points, true)
      expect(contour[0].start.x).toBe(1) // Rounded
    })
  })
})
