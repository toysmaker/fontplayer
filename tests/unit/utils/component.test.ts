/**
 * 组件工具函数测试
 */

import { describe, it, expect } from 'vitest'
import { selectedItemByUUID } from '@/core/utils/component'

describe('component utils', () => {
  describe('selectedItemByUUID', () => {
    it('should find item by UUID', () => {
      const items = [
        { uuid: '1', name: 'Item 1' },
        { uuid: '2', name: 'Item 2' },
        { uuid: '3', name: 'Item 3' },
      ]
      const result = selectedItemByUUID(items, '2')
      expect(result).toEqual({ uuid: '2', name: 'Item 2' })
    })

    it('should return null if item not found', () => {
      const items = [
        { uuid: '1', name: 'Item 1' },
        { uuid: '2', name: 'Item 2' },
      ]
      const result = selectedItemByUUID(items, '3')
      expect(result).toBeNull()
    })

    it('should return null if items is null', () => {
      const result = selectedItemByUUID(null, '1')
      expect(result).toBeNull()
    })

    it('should return null if items is undefined', () => {
      const result = selectedItemByUUID(undefined, '1')
      expect(result).toBeNull()
    })

    it('should return null if items is empty array', () => {
      const result = selectedItemByUUID([], '1')
      expect(result).toBeNull()
    })

    it('should work with different item types', () => {
      interface TestItem {
        uuid: string
        value: number
      }
      const items: TestItem[] = [
        { uuid: '1', value: 10 },
        { uuid: '2', value: 20 },
      ]
      const result = selectedItemByUUID(items, '2')
      expect(result).toEqual({ uuid: '2', value: 20 })
    })
  })
})
