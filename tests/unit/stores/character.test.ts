/**
 * Character Store 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import { createMockFile, createMockCharacter, createMockPenComponent } from '../../helpers/mock-helpers'

// Mock instanceManager
vi.mock('@/core/instance', () => ({
  instanceManager: {
    markEditing: vi.fn(),
    unmarkEditing: vi.fn(),
    getInstance: vi.fn(),
  },
}))

// Mock CharacterDataManager
vi.mock('@/core/storage/CharacterDataManager', () => ({
  characterDataManager: {
    loadCharacter: vi.fn(),
  },
}))

describe('Character Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty editingCharacterUUID', () => {
      const store = useCharacterStore()
      expect(store.editingCharacterUUID).toBe('')
    })

    it('should have empty selectedComponentUUID', () => {
      const store = useCharacterStore()
      expect(store.selectedComponentUUID).toBe('')
    })

    it('should have null editingCharacter', () => {
      const store = useCharacterStore()
      expect(store.editingCharacter).toBeNull()
    })

    it('should have empty clipBoard', () => {
      const store = useCharacterStore()
      expect(store.clipBoard.value).toEqual([])
    })
  })

  describe('setEditingCharacterUUID', () => {
    it('should set editing character UUID', () => {
      const store = useCharacterStore()
      store.setEditingCharacterUUID('char-1')
      expect(store.editingCharacterUUID).toBe('char-1')
    })
  })

  describe('selectComponent', () => {
    it('should select component', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [createMockPenComponent({ uuid: 'comp-1' })],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      characterStore.selectComponent('comp-1', ['char-1'])
      
      expect(characterStore.selectedComponentUUID).toBe('comp-1')
      expect(characterStore.selectedComponentsTree).toEqual(['char-1'])
    })

    it('should enable joints and refLines when selecting glyph component', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      const { useEditorStore } = await import('@/stores/editor')
      const editorStore = useEditorStore()
      
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [
              {
                uuid: 'comp-1',
                type: 'glyph',
                name: 'glyph',
                lock: false,
                visible: true,
                x: 0,
                y: 0,
                w: 100,
                h: 100,
                rotation: 0,
                flipX: false,
                flipY: false,
                usedInCharacter: true,
                ox: 0,
                oy: 0,
                value: {},
              },
            ],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      characterStore.selectComponent('comp-1')
      
      expect(editorStore.checkJoints).toBe(true)
      expect(editorStore.checkRefLines).toBe(true)
    })
  })

  describe('clearSelection', () => {
    it('should clear selection', () => {
      const store = useCharacterStore()
      store.selectedComponentUUID = 'comp-1'
      store.selectedComponentsTree = ['char-1']
      
      store.clearSelection()
      
      expect(store.selectedComponentUUID).toBe('')
      expect(store.selectedComponentsTree).toEqual([])
    })
  })

  describe('updateComponent', () => {
    it('should update component', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const component = createMockPenComponent({ uuid: 'comp-1', x: 0, y: 0 })
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [component],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      const result = characterStore.updateComponent('comp-1', { x: 100, y: 200 })
      
      expect(result).toBe(true)
      expect(characterStore.editingCharacter?.components[0].x).toBe(100)
      expect(characterStore.editingCharacter?.components[0].y).toBe(200)
    })

    it('should return false when component not found', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const file = createMockFile({
        characterList: [createMockCharacter({ uuid: 'char-1' })],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      const result = characterStore.updateComponent('non-existent', { x: 100 })
      
      expect(result).toBe(false)
    })
  })

  describe('removeComponent', () => {
    it('should remove component', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const component = createMockPenComponent({ uuid: 'comp-1' })
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [component],
            orderedList: [{ type: 'component', uuid: 'comp-1' }],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      const result = characterStore.removeComponent('comp-1')
      
      expect(result).toBe(true)
      expect(characterStore.editingCharacter?.components).toHaveLength(0)
    })

    it('should clear selection when removing selected component', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const component = createMockPenComponent({ uuid: 'comp-1' })
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [component],
            orderedList: [{ type: 'component', uuid: 'comp-1' }],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      characterStore.selectComponent('comp-1')
      characterStore.removeComponent('comp-1')
      
      expect(characterStore.selectedComponentUUID).toBe('')
    })
  })

  describe('setClipBoard', () => {
    it('should set clipboard with single component', () => {
      const store = useCharacterStore()
      const component = createMockPenComponent()
      
      store.setClipBoard(component)
      
      expect(store.clipBoard.value).toHaveLength(1)
      expect(store.clipBoard.value[0].uuid).toBe(component.uuid)
    })

    it('should set clipboard with array of components', () => {
      const store = useCharacterStore()
      const components = [
        createMockPenComponent({ uuid: 'comp-1' }),
        createMockPenComponent({ uuid: 'comp-2' }),
      ]
      
      store.setClipBoard(components)
      
      expect(store.clipBoard.value).toHaveLength(2)
    })
  })

  describe('setSelection', () => {
    it('should set selection in single select mode', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [createMockPenComponent({ uuid: 'comp-1' })],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      characterStore.setSelection('comp-1')
      
      expect(characterStore.selectedComponentUUID).toBe('comp-1')
      expect(characterStore.editingCharacter?.selectedComponentsUUIDs).toEqual(['comp-1'])
    })

    it('should toggle selection in multi select mode', async () => {
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      
      const file = createMockFile({
        characterList: [
          createMockCharacter({
            uuid: 'char-1',
            components: [
              createMockPenComponent({ uuid: 'comp-1' }),
              createMockPenComponent({ uuid: 'comp-2' }),
            ],
          }),
        ],
      })
      projectStore.addFile(file)
      
      await characterStore.setEditCharacterFileByUUID('char-1')
      characterStore.enableMultiSelect = true
      characterStore.setSelection('comp-1')
      characterStore.setSelection('comp-2')
      
      expect(characterStore.editingCharacter?.selectedComponentsUUIDs).toContain('comp-1')
      expect(characterStore.editingCharacter?.selectedComponentsUUIDs).toContain('comp-2')
    })
  })
})
