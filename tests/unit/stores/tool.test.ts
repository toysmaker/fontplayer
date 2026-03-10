/**
 * Tool Store 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToolStore } from '@/stores/tool'

describe('Tool Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have empty tool', () => {
      const store = useToolStore()
      expect(store.tool).toBe('')
    })

    it('should have empty coordsText', () => {
      const store = useToolStore()
      expect(store.coordsText).toBe('')
    })
  })

  describe('setTool', () => {
    it('should set tool', () => {
      const store = useToolStore()
      store.setTool('pen')
      expect(store.tool).toBe('pen')
    })

    it('should update tool', () => {
      const store = useToolStore()
      store.setTool('pen')
      store.setTool('rectangle')
      expect(store.tool).toBe('rectangle')
    })
  })

  describe('setCoordsText', () => {
    it('should set coords text', () => {
      const store = useToolStore()
      store.setCoordsText('x: 100, y: 200')
      expect(store.coordsText).toBe('x: 100, y: 200')
    })

    it('should update coords text', () => {
      const store = useToolStore()
      store.setCoordsText('x: 100, y: 200')
      store.setCoordsText('x: 200, y: 300')
      expect(store.coordsText).toBe('x: 200, y: 300')
    })
  })
})
