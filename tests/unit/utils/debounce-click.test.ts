/**
 * 防抖点击工具测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createDebouncedHandler,
  clearDebounceCache,
  clearAllDebounceCache,
  CLICK_DEBOUNCE_TIME,
} from '@/utils/debounce-click'

describe('debounce-click utils', () => {
  beforeEach(() => {
    clearAllDebounceCache()
    vi.useFakeTimers()
  })

  describe('createDebouncedHandler', () => {
    it('should call function immediately on first call', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(fn, 'test-key')

      handler()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should debounce rapid calls', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(fn, 'test-key')

      handler()
      handler()
      handler()

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should allow call after debounce time', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(fn, 'test-key')

      handler()
      vi.advanceTimersByTime(CLICK_DEBOUNCE_TIME + 1)
      handler()

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should use compareParams to distinguish different calls', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(
        fn,
        'test-key',
        (args: [string]) => args[0]
      )

      handler('item1')
      handler('item2') // Different param, should call

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should skip call with same params within debounce time', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(
        fn,
        'test-key',
        (args: [string]) => args[0]
      )

      handler('item1')
      handler('item1') // Same param, should skip

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should allow call with same params after debounce time', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(
        fn,
        'test-key',
        (args: [string]) => args[0]
      )

      handler('item1')
      vi.advanceTimersByTime(CLICK_DEBOUNCE_TIME + 1)
      handler('item1') // Same param but after debounce time

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should pass arguments correctly', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(fn, 'test-key')

      handler('arg1', 'arg2', 123)
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })

    it('should handle different keys independently', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const handler1 = createDebouncedHandler(fn1, 'key1')
      const handler2 = createDebouncedHandler(fn2, 'key2')

      handler1()
      handler2()

      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearDebounceCache', () => {
    it('should clear cache for specific key', () => {
      const fn = vi.fn()
      const handler = createDebouncedHandler(fn, 'test-key')

      handler()
      clearDebounceCache('test-key')
      vi.advanceTimersByTime(CLICK_DEBOUNCE_TIME - 10)
      handler() // Should be allowed after cache cleared

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearAllDebounceCache', () => {
    it('should clear all cache', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const handler1 = createDebouncedHandler(fn1, 'key1')
      const handler2 = createDebouncedHandler(fn2, 'key2')

      handler1()
      handler2()
      clearAllDebounceCache()
      vi.advanceTimersByTime(CLICK_DEBOUNCE_TIME - 10)
      handler1()
      handler2()

      expect(fn1).toHaveBeenCalledTimes(2)
      expect(fn2).toHaveBeenCalledTimes(2)
    })
  })
})
