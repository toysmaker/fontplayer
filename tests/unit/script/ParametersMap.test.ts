/**
 * ParametersMap 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ParametersMap } from '@/core/script/ParametersMap'
import { ParameterType } from '@/core/script/ParametersMap'
import { ConstantsMap } from '@/core/script/ConstantsMap'

describe('ParametersMap', () => {
  describe('constructor', () => {
    it('should create ParametersMap with parameters', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      expect(map.parameters).toEqual(parameters)
    })
  })

  describe('get', () => {
    it('should get parameter value by name', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      expect(map.get('param1')).toBe(10)
    })

    it('should return undefined when parameter not found', () => {
      const map = new ParametersMap([])
      expect(map.get('non-existent')).toBeUndefined()
    })

    it('should get constant parameter value', async () => {
      ConstantsMap.resetInstance()
      const constants = [
        { uuid: 'const-uuid', name: 'const1', value: 50 },
      ]
      ConstantsMap.getInstance(constants)
      
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Constant, value: 'const-uuid' as any, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      // Mock globalConstantsMap
      const { setGlobalConstantsMap } = await import('@/core/script/ParametersMap')
      setGlobalConstantsMap(ConstantsMap.getInstance())
      
      expect(map.get('param1')).toBe(50)
    })
  })

  describe('set', () => {
    it('should set parameter value', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      map.set('param1', 50)
      
      expect(map.get('param1')).toBe(50)
    })

    it('should clamp value to min', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      map.set('param1', -10)
      
      expect(map.get('param1')).toBe(0)
    })

    it('should clamp value to max', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      map.set('param1', 200)
      
      expect(map.get('param1')).toBe(100)
    })

    it('should convert Constant type to Number when set', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Constant, value: 'const-uuid' as any, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      map.set('param1', 50)
      
      expect(parameters[0].type).toBe(ParameterType.Number)
    })
  })

  describe('getRange', () => {
    it('should get parameter range', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      const range = map.getRange('param1')
      
      expect(range).toEqual({ min: 0, max: 100 })
    })

    it('should use default max when not specified', () => {
      const parameters = [
        { uuid: '1', name: 'param1', type: ParameterType.Number, value: 10, min: 0 },
      ]
      const map = new ParametersMap(parameters)
      
      const range = map.getRange('param1')
      
      expect(range.max).toBe(1000)
    })
  })

  describe('getByUUID', () => {
    it('should get parameter value by UUID', () => {
      const parameters = [
        { uuid: 'uuid-1', name: 'param1', type: ParameterType.Number, value: 10, min: 0, max: 100 },
      ]
      const map = new ParametersMap(parameters)
      
      expect(map.getByUUID('uuid-1')).toBe(10)
    })
  })
})
