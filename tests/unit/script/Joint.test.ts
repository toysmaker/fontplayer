/**
 * Joint 测试
 */

import { describe, it, expect } from 'vitest'
import { Joint } from '@/core/script/Joint'

describe('Joint', () => {
  describe('constructor', () => {
    it('should create Joint instance', () => {
      const joint = new Joint('joint1', { x: 10, y: 20 })
      expect(joint.name).toBe('joint1')
      expect(joint.x).toBe(10)
      expect(joint.y).toBe(20)
      expect(joint.uuid).toBeDefined()
    })

    it('should generate UUID automatically', () => {
      const joint1 = new Joint('joint1', { x: 10, y: 20 })
      const joint2 = new Joint('joint2', { x: 10, y: 20 })
      expect(joint1.uuid).toBeDefined()
      expect(joint2.uuid).toBeDefined()
      expect(joint1.uuid).not.toBe(joint2.uuid)
    })
  })

  describe('getCoords', () => {
    it('should return x and y values', () => {
      const joint = new Joint('joint1', { x: 10, y: 20 })
      const coords = joint.getCoords()
      expect(coords.x).toBe(10)
      expect(coords.y).toBe(20)
    })
  })

  describe('getPlainCoords', () => {
    it('should return plain coordinates', () => {
      const joint = new Joint('joint1', { x: 10, y: 20 })
      const coords = joint.getPlainCoords()
      expect(coords.x).toBe(10)
      expect(coords.y).toBe(20)
    })
  })
})
