/**
 * Editor Store 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'

describe('Editor Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have CharacterList as initial editStatus', () => {
      const store = useEditorStore()
      expect(store.editStatus).toBe(EditStatus.CharacterList)
    })

    it('should have all panels hidden initially', () => {
      const store = useEditorStore()
      expect(store.showLeftPanel).toBe(false)
      expect(store.showRightPanel).toBe(false)
      expect(store.showToolbar).toBe(false)
      expect(store.showBottomBar).toBe(false)
    })

    it('should have search disabled initially', () => {
      const store = useEditorStore()
      expect(store.isCharacterSearching).toBe(false)
      expect(store.characterSearchKeyword).toBe('')
    })

    it('should have all filters set to all', () => {
      const store = useEditorStore()
      expect(store.editPanelCompFilter).toBe('all')
      expect(store.glyphPanelCompFilter).toBe('all')
    })

    it('should have joints and refLines checked', () => {
      const store = useEditorStore()
      expect(store.checkJoints).toBe(true)
      expect(store.checkRefLines).toBe(true)
    })
  })

  describe('setEditStatus', () => {
    it('should set edit status', () => {
      const store = useEditorStore()
      store.setEditStatus(EditStatus.Edit)
      expect(store.editStatus).toBe(EditStatus.Edit)
    })

    it('should show panels when entering edit mode', () => {
      const store = useEditorStore()
      store.setEditStatus(EditStatus.Edit)
      expect(store.showLeftPanel).toBe(true)
      expect(store.showRightPanel).toBe(true)
      expect(store.showToolbar).toBe(true)
      expect(store.showBottomBar).toBe(true)
    })

    it('should hide panels when entering list mode', () => {
      const store = useEditorStore()
      store.setEditStatus(EditStatus.Edit)
      store.setEditStatus(EditStatus.CharacterList)
      expect(store.showLeftPanel).toBe(false)
      expect(store.showRightPanel).toBe(false)
      expect(store.showToolbar).toBe(false)
      expect(store.showBottomBar).toBe(false)
    })

    it('should save prevStatus when entering edit from list', () => {
      const store = useEditorStore()
      store.setEditStatus(EditStatus.CharacterList)
      store.setEditStatus(EditStatus.Edit)
      expect(store.prevStatus).toBe(EditStatus.CharacterList)
    })

    it('should save prevStatus when entering glyph edit from list', () => {
      const store = useEditorStore()
      store.setEditStatus(EditStatus.GlyphList)
      store.setEditStatus(EditStatus.Glyph)
      expect(store.prevStatus).toBe(EditStatus.GlyphList)
    })
  })

  describe('toggleLeftPanel', () => {
    it('should toggle left panel', () => {
      const store = useEditorStore()
      store.toggleLeftPanel()
      expect(store.showLeftPanel).toBe(true)
      store.toggleLeftPanel()
      expect(store.showLeftPanel).toBe(false)
    })
  })

  describe('toggleRightPanel', () => {
    it('should toggle right panel', () => {
      const store = useEditorStore()
      store.toggleRightPanel()
      expect(store.showRightPanel).toBe(true)
      store.toggleRightPanel()
      expect(store.showRightPanel).toBe(false)
    })
  })

  describe('toggleToolbar', () => {
    it('should toggle toolbar', () => {
      const store = useEditorStore()
      store.toggleToolbar()
      expect(store.showToolbar).toBe(true)
      store.toggleToolbar()
      expect(store.showToolbar).toBe(false)
    })
  })

  describe('toggleBottomBar', () => {
    it('should toggle bottom bar', () => {
      const store = useEditorStore()
      store.toggleBottomBar()
      expect(store.showBottomBar).toBe(true)
      store.toggleBottomBar()
      expect(store.showBottomBar).toBe(false)
    })
  })

  describe('setCharacterSearchKeyword', () => {
    it('should set search keyword', () => {
      const store = useEditorStore()
      store.setCharacterSearchKeyword('test')
      expect(store.characterSearchKeyword).toBe('test')
    })
  })

  describe('setIsCharacterSearching', () => {
    it('should set searching state', () => {
      const store = useEditorStore()
      store.setIsCharacterSearching(true)
      expect(store.isCharacterSearching).toBe(true)
    })

    it('should clear keyword when stopping search', () => {
      const store = useEditorStore()
      store.setCharacterSearchKeyword('test')
      store.setIsCharacterSearching(true)
      store.setIsCharacterSearching(false)
      expect(store.characterSearchKeyword).toBe('')
    })
  })

  describe('setEditPanelCompFilter', () => {
    it('should set edit panel filter', () => {
      const store = useEditorStore()
      store.setEditPanelCompFilter('font')
      expect(store.editPanelCompFilter).toBe('font')
    })
  })

  describe('setGlyphPanelCompFilter', () => {
    it('should set glyph panel filter', () => {
      const store = useEditorStore()
      store.setGlyphPanelCompFilter('font')
      expect(store.glyphPanelCompFilter).toBe('font')
    })
  })
})
