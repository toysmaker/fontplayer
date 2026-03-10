/**
 * PenComponent 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PenComponent } from '@/core/script/PenComponent'

describe('PenComponent', () => {
  let component: PenComponent

  beforeEach(() => {
    component = new PenComponent()
  })

  describe('constructor', () => {
    it('should create PenComponent instance', () => {
      expect(component).toBeInstanceOf(PenComponent)
      expect(component.type).toBe('glyph-pen')
      expect(component.usedInCharacter).toBe(true)
    })
  })

  describe('beginPath', () => {
    it('should start path and clear points', () => {
      component.points = [{ uuid: '1', x: 0, y: 0, type: 'anchor', origin: null }] as any
      
      component.beginPath()
      
      expect((component as any).hasPathBegan).toBe(true)
      expect(component.points).toEqual([])
    })
  })

  describe('closePath', () => {
    it('should close path', () => {
      component.beginPath()
      component.closePath()
      
      expect((component as any).hasPathBegan).toBe(false)
    })
  })

  describe('moveTo', () => {
    it('should add first point when path began', () => {
      component.beginPath()
      component.moveTo(10, 20)
      
      expect(component.points.length).toBe(1)
      expect(component.points[0].x).toBe(10)
      expect(component.points[0].y).toBe(20)
      expect(component.points[0].type).toBe('anchor')
    })

    it('should not add point when path not began', () => {
      // Initialize points array to avoid undefined error
      component.points = []
      component.moveTo(10, 20)
      
      // Should not add point when hasPathBegan is false
      expect(component.points.length).toBe(0)
    })
  })

  describe('bezierTo', () => {
    it('should add bezier curve points', () => {
      component.beginPath()
      component.moveTo(0, 0)
      component.bezierTo(10, 10, 20, 20, 30, 30)
      
      expect(component.points.length).toBe(4) // moveTo point + 3 bezier points
    })

    it('should not add points when path not began', () => {
      component.bezierTo(10, 10, 20, 20, 30, 30)
      
      expect(component.points).toBeUndefined()
    })
  })

  describe('quadraticBezierTo', () => {
    it('should add quadratic bezier curve points', () => {
      component.beginPath()
      component.moveTo(0, 0)
      component.quadraticBezierTo(10, 10, 20, 20)
      
      expect(component.points.length).toBeGreaterThan(1)
    })
  })

  describe('lineTo', () => {
    it('should add line points', () => {
      component.beginPath()
      component.moveTo(0, 0)
      component.lineTo(10, 10)
      
      expect(component.points.length).toBeGreaterThan(1)
    })
  })

  describe('updateData', () => {
    it('should update contour data', () => {
      component.beginPath()
      component.moveTo(0, 0)
      component.lineTo(10, 10)
      component.closePath()
      
      component.updateData(true, { x: 0, y: 0 })
      
      expect(component.contour.length).toBeGreaterThan(0)
      expect(component.preview.length).toBeGreaterThan(0)
    })
  })
})
