/**
 * Glyph Store 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { createMockFile, createMockGlyph } from '../../helpers/mock-helpers'

// Mock instanceManager
vi.mock('@/core/instance', () => ({
  instanceManager: {
    markEditing: vi.fn(),
    unmarkEditing: vi.fn(),
    getInstance: vi.fn(),
  },
}))

describe('Glyph Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty editingGlyphUUID', () => {
      const store = useGlyphStore()
      expect(store.editingGlyphUUID).toBe('')
    })

    it('should have empty selectedComponentUUID', () => {
      const store = useGlyphStore()
      expect(store.selectedComponentUUID).toBe('')
    })

    it('should have null editingGlyph', () => {
      const store = useGlyphStore()
      expect(store.editingGlyph).toBeNull()
    })

    it('should have glyphs category by default', () => {
      const store = useGlyphStore()
      expect(store.glyphCategory).toBe('glyphs')
    })
  })

  describe('setEditingGlyphUUID', () => {
    it('should set editing glyph UUID', () => {
      const store = useGlyphStore()
      store.setEditingGlyphUUID('glyph-1')
      expect(store.editingGlyphUUID).toBe('glyph-1')
    })
  })

  describe('setEditGlyphByUUID', () => {
    it('should set editing glyph from project file', () => {
      const projectStore = useProjectStore()
      const glyphStore = useGlyphStore()
      
      const glyph = createMockGlyph({ uuid: 'glyph-1', name: 'test-glyph' })
      const file = createMockFile({
        glyphs: [glyph],
      })
      projectStore.addFile(file)
      
      glyphStore.setEditGlyphByUUID('glyph-1', 'glyphs')
      
      expect(glyphStore.editingGlyphUUID).toBe('glyph-1')
      expect(glyphStore.editingGlyph).not.toBeNull()
      expect(glyphStore.editingGlyph?.name).toBe('test-glyph')
    })

    it('should handle different glyph categories', () => {
      const projectStore = useProjectStore()
      const glyphStore = useGlyphStore()
      
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const file = createMockFile({
        stroke_glyphs: [glyph],
      })
      projectStore.addFile(file)
      
      glyphStore.setEditGlyphByUUID('glyph-1', 'stroke_glyphs')
      
      expect(glyphStore.glyphCategory).toBe('stroke_glyphs')
    })

    it('should initialize missing properties', () => {
      const projectStore = useProjectStore()
      const glyphStore = useGlyphStore()
      
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      delete (glyph as any).components
      delete (glyph as any).orderedList
      
      const file = createMockFile({
        glyphs: [glyph],
      })
      projectStore.addFile(file)
      
      glyphStore.setEditGlyphByUUID('glyph-1')
      
      expect(glyphStore.editingGlyph?.components).toEqual([])
      expect(glyphStore.editingGlyph?.orderedList).not.toBeUndefined()
    })
  })

  describe('resetEditGlyph', () => {
    it('should reset editing glyph', () => {
      const store = useGlyphStore()
      store.editingGlyph = createMockGlyph()
      store.editingGlyphUUID = 'glyph-1'
      store.selectedComponentUUID = 'comp-1'
      
      store.resetEditGlyph()
      
      expect(store.editingGlyph).toBeNull()
      expect(store.editingGlyphUUID).toBe('')
      expect(store.selectedComponentUUID).toBe('')
    })
  })

  describe('updateGlyphParameter', () => {
    it('should update glyph parameter', () => {
      const projectStore = useProjectStore()
      const glyphStore = useGlyphStore()
      
      const glyph = createMockGlyph({
        uuid: 'glyph-1',
        parameters: [
          { name: 'weight', value: 100 },
          { name: 'width', value: 50 },
        ],
      })
      const file = createMockFile({
        glyphs: [glyph],
      })
      projectStore.addFile(file)
      
      glyphStore.setEditGlyphByUUID('glyph-1')
      const result = glyphStore.updateGlyphParameter('glyph-1', 'weight', 200)
      
      expect(result).toBe(true)
      const param = glyphStore.editingGlyph?.parameters?.find(p => p.name === 'weight')
      expect(param?.value).toBe(200)
    })

    it('should return false when parameter not found', () => {
      const projectStore = useProjectStore()
      const glyphStore = useGlyphStore()
      
      const glyph = createMockGlyph({ uuid: 'glyph-1' })
      const file = createMockFile({
        glyphs: [glyph],
      })
      projectStore.addFile(file)
      
      glyphStore.setEditGlyphByUUID('glyph-1')
      const result = glyphStore.updateGlyphParameter('glyph-1', 'non-existent', 100)
      
      expect(result).toBe(false)
    })
  })

  describe('selectComponent', () => {
    it('should select component', () => {
      const store = useGlyphStore()
      store.selectComponent('comp-1', ['glyph-1'])
      
      expect(store.selectedComponentUUID).toBe('comp-1')
      expect(store.selectedComponentsTree).toEqual(['glyph-1'])
    })
  })

  describe('clearSelection', () => {
    it('should clear selection', () => {
      const store = useGlyphStore()
      store.selectedComponentUUID = 'comp-1'
      store.selectedComponentsTree = ['glyph-1']
      
      store.clearSelection()
      
      expect(store.selectedComponentUUID).toBe('')
      expect(store.selectedComponentsTree).toEqual([])
    })
  })
})
