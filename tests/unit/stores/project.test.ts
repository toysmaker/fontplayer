/**
 * Project Store 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { createMockFile } from '../../helpers/mock-helpers'

describe('Project Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have empty files array', () => {
      const store = useProjectStore()
      expect(store.files).toEqual([])
    })

    it('should have empty selectedFileUUID', () => {
      const store = useProjectStore()
      expect(store.selectedFileUUID).toBe('')
    })

    it('should have loading false', () => {
      const store = useProjectStore()
      expect(store.loading).toBe(false)
    })

    it('should have null selectedFile', () => {
      const store = useProjectStore()
      expect(store.selectedFile).toBeNull()
    })

    it('should have hasFiles false', () => {
      const store = useProjectStore()
      expect(store.hasFiles).toBe(false)
    })
  })

  describe('addFile', () => {
    it('should add file to files array', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1', name: 'Test File' })
      
      const result = store.addFile(file)
      
      expect(result).toBe(true)
      expect(store.files).toHaveLength(1)
      expect(store.files[0]).toEqual(file)
    })

    it('should set selectedFileUUID when adding first file', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1' })
      
      store.addFile(file)
      
      expect(store.selectedFileUUID).toBe('file-1')
      expect(store.selectedFile).toEqual(file)
    })

    it('should not change selectedFileUUID when adding subsequent files', () => {
      const store = useProjectStore()
      const file1 = createMockFile({ uuid: 'file-1' })
      const file2 = createMockFile({ uuid: 'file-2' })
      
      store.addFile(file1)
      store.addFile(file2)
      
      expect(store.selectedFileUUID).toBe('file-1')
    })

    it('should not add duplicate file', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1' })
      
      store.addFile(file)
      const result = store.addFile(file)
      
      expect(result).toBe(false)
      expect(store.files).toHaveLength(1)
    })
  })

  describe('removeFile', () => {
    it('should remove file from files array', () => {
      const store = useProjectStore()
      const file1 = createMockFile({ uuid: 'file-1' })
      const file2 = createMockFile({ uuid: 'file-2' })
      
      store.addFile(file1)
      store.addFile(file2)
      
      const result = store.removeFile('file-1')
      
      expect(result).toBe(true)
      expect(store.files).toHaveLength(1)
      expect(store.files[0].uuid).toBe('file-2')
    })

    it('should switch to another file when removing selected file', () => {
      const store = useProjectStore()
      const file1 = createMockFile({ uuid: 'file-1' })
      const file2 = createMockFile({ uuid: 'file-2' })
      
      store.addFile(file1)
      store.addFile(file2)
      store.selectFile('file-1')
      
      store.removeFile('file-1')
      
      expect(store.selectedFileUUID).toBe('file-2')
    })

    it('should clear selectedFileUUID when removing last file', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1' })
      
      store.addFile(file)
      store.removeFile('file-1')
      
      expect(store.selectedFileUUID).toBe('')
      expect(store.selectedFile).toBeNull()
    })

    it('should return false when file not found', () => {
      const store = useProjectStore()
      
      const result = store.removeFile('non-existent')
      
      expect(result).toBe(false)
    })
  })

  describe('selectFile', () => {
    it('should select file by UUID', () => {
      const store = useProjectStore()
      const file1 = createMockFile({ uuid: 'file-1' })
      const file2 = createMockFile({ uuid: 'file-2' })
      
      store.addFile(file1)
      store.addFile(file2)
      
      const result = store.selectFile('file-2')
      
      expect(result).toBe(true)
      expect(store.selectedFileUUID).toBe('file-2')
      expect(store.selectedFile).toEqual(file2)
    })

    it('should return false when file not found', () => {
      const store = useProjectStore()
      
      const result = store.selectFile('non-existent')
      
      expect(result).toBe(false)
      expect(store.selectedFileUUID).toBe('')
    })
  })

  describe('updateFile', () => {
    it('should update file properties', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1', name: 'Old Name' })
      
      store.addFile(file)
      const result = store.updateFile('file-1', { name: 'New Name' })
      
      expect(result).toBe(true)
      expect(store.files[0].name).toBe('New Name')
    })

    it('should return false when file not found', () => {
      const store = useProjectStore()
      
      const result = store.updateFile('non-existent', { name: 'New Name' })
      
      expect(result).toBe(false)
    })
  })

  describe('markFileSaved', () => {
    it('should mark file as saved', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1', saved: false })
      
      store.addFile(file)
      const result = store.markFileSaved('file-1')
      
      expect(result).toBe(true)
      expect(store.files[0].saved).toBe(true)
    })
  })

  describe('markFileUnsaved', () => {
    it('should mark file as unsaved', () => {
      const store = useProjectStore()
      const file = createMockFile({ uuid: 'file-1', saved: true })
      
      store.addFile(file)
      const result = store.markFileUnsaved('file-1')
      
      expect(result).toBe(true)
      expect(store.files[0].saved).toBe(false)
    })
  })

  describe('clearFiles', () => {
    it('should clear all files', () => {
      const store = useProjectStore()
      const file1 = createMockFile({ uuid: 'file-1' })
      const file2 = createMockFile({ uuid: 'file-2' })
      
      store.addFile(file1)
      store.addFile(file2)
      store.clearFiles()
      
      expect(store.files).toEqual([])
      expect(store.selectedFileUUID).toBe('')
      expect(store.selectedFile).toBeNull()
    })
  })

  describe('constantsMap', () => {
    it('should update constantsMap when selectedFile constants change', async () => {
      const store = useProjectStore()
      const file = createMockFile({
        uuid: 'file-1',
        constants: [
          { name: 'const1', value: 10 },
          { name: 'const2', value: 20 },
        ],
      })
      
      store.addFile(file)
      
      // Wait for watch to trigger
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(store.constantsMap).not.toBeNull()
    })

    it('should create empty constantsMap when constants is empty', async () => {
      const store = useProjectStore()
      const file = createMockFile({
        uuid: 'file-1',
        constants: [],
      })
      
      store.addFile(file)
      
      // Wait for watch to trigger
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(store.constantsMap).not.toBeNull()
    })
  })
})
