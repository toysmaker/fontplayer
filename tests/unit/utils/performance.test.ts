/**
 * 性能工具函数测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { throttle } from '@/utils/performance'

describe('performance utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      throttled()
      throttled()

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should call function after wait time', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      vi.advanceTimersByTime(100)
      throttled()

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should call function immediately with leading option', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100, { leading: true })

      throttled()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should not call function immediately with leading: false', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100, { leading: false })

      throttled()
      expect(fn).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should call function at end with trailing option', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100, { trailing: true })

      throttled()
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should not call function at end with trailing: false', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100, { trailing: false })

      throttled()
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1) // Only leading call
    })

    it('should cancel throttled function', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      throttled.cancel()
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1) // Only the immediate call
    })

    it('should pass arguments correctly', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled('arg1', 'arg2')
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should handle multiple rapid calls', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      for (let i = 0; i < 10; i++) {
        throttled(i)
      }

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith(0) // First call

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(2)
      expect(fn.mock.calls[0]).toEqual([0])
      expect(fn.mock.calls[1]).toEqual([9])
    })
  })
})
