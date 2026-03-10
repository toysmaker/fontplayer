/**
 * UUID工具函数测试
 */

import { describe, it, expect } from 'vitest'
import { genUUID } from '@/utils/uuid'

describe('uuid utils', () => {
  describe('genUUID', () => {
    it('should generate UUID string', () => {
      const uuid = genUUID()
      expect(typeof uuid).toBe('string')
      expect(uuid.length).toBeGreaterThan(0)
    })

    it('should generate unique UUIDs', () => {
      const uuid1 = genUUID()
      // Wait a bit to ensure different timestamp
      const uuid2 = genUUID()
      expect(uuid1).not.toBe(uuid2)
    })

    it('should generate UUIDs with timestamp and random part', () => {
      const uuid = genUUID()
      const parts = uuid.split('-')
      expect(parts.length).toBeGreaterThanOrEqual(2)
      // First part should be timestamp (number)
      expect(Number(parts[0])).toBeGreaterThan(0)
    })

    it('should generate multiple unique UUIDs', () => {
      const uuids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        uuids.add(genUUID())
      }
      // All UUIDs should be unique
      expect(uuids.size).toBe(100)
    })
  })
})
