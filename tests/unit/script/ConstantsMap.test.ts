/**
 * ConstantsMap 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ConstantsMap } from '@/core/script/ConstantsMap'

describe('ConstantsMap', () => {
  beforeEach(() => {
    ConstantsMap.resetInstance()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConstantsMap.getInstance()
      const instance2 = ConstantsMap.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should update instance with new constants', () => {
      const constants1 = [
        { uuid: '1', name: 'const1', value: 10 },
      ]
      const instance1 = ConstantsMap.getInstance(constants1)
      
      const constants2 = [
        { uuid: '2', name: 'const2', value: 20 },
      ]
      const instance2 = ConstantsMap.getInstance(constants2)
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('get', () => {
    it('should get constant by name', () => {
      const constants = [
        { uuid: '1', name: 'const1', value: 10 },
        { uuid: '2', name: 'const2', value: 20 },
      ]
      const map = ConstantsMap.getInstance(constants)
      
      expect(map.get('const1')).toBe(10)
      expect(map.get('const2')).toBe(20)
    })

    it('should return undefined when constant not found', () => {
      const map = ConstantsMap.getInstance([])
      expect(map.get('non-existent')).toBeUndefined()
    })
  })

  describe('getByUUID', () => {
    it('should get constant by UUID', () => {
      const constants = [
        { uuid: 'uuid-1', name: 'const1', value: 10 },
        { uuid: 'uuid-2', name: 'const2', value: 20 },
      ]
      const map = ConstantsMap.getInstance(constants)
      
      expect(map.getByUUID('uuid-1')).toBe(10)
      expect(map.getByUUID('uuid-2')).toBe(20)
    })

    it('should return undefined for invalid UUID', () => {
      const map = ConstantsMap.getInstance([])
      expect(map.getByUUID('')).toBeUndefined()
      expect(map.getByUUID('non-existent')).toBeUndefined()
    })
  })

  describe('updateConstantValue', () => {
    it('should update constant value by UUID', () => {
      const constants = [
        { uuid: 'uuid-1', name: 'const1', value: 10 },
      ]
      const map = ConstantsMap.getInstance(constants)
      
      const result = map.updateConstantValue('uuid-1', 20)
      
      expect(result).toBe(true)
      expect(map.getByUUID('uuid-1')).toBe(20)
    })

    it('should return false when UUID not found', () => {
      const map = ConstantsMap.getInstance([])
      const result = map.updateConstantValue('non-existent', 20)
      expect(result).toBe(false)
    })
  })

  describe('update', () => {
    it('should update constants array', () => {
      const map = ConstantsMap.getInstance([
        { uuid: '1', name: 'const1', value: 10 },
      ])
      
      map.update([
        { uuid: '2', name: 'const2', value: 20 },
      ])
      
      expect(map.get('const2')).toBe(20)
      expect(map.get('const1')).toBeUndefined()
    })
  })
})
