/**
 * ProjectCreator 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ProjectCreator } from '@/features/editor/services/ProjectCreator'
import { useProjectStore } from '@/stores/project'

describe('ProjectCreator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ProjectCreator.getInstance()
      const instance2 = ProjectCreator.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('createProject', () => {
    it('should create project with valid config', async () => {
      const creator = ProjectCreator.getInstance()
      const config = {
        name: 'Test Project',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      const project = await creator.createProject(config)
      
      expect(project.name).toBe('Test Project')
      expect(project.width).toBe(1000)
      expect(project.height).toBe(1000)
      expect(project.fontSettings.unitsPerEm).toBe(1000)
      expect(project.fontSettings.ascender).toBe(800)
      expect(project.fontSettings.descender).toBe(-200)
      expect(project.saved).toBe(false)
    })

    it('should add project to store', async () => {
      const creator = ProjectCreator.getInstance()
      const projectStore = useProjectStore()
      const config = {
        name: 'Test Project',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      const project = await creator.createProject(config)
      
      expect(projectStore.files).toHaveLength(1)
      expect(projectStore.files[0].uuid).toBe(project.uuid)
    })

    it('should select created project', async () => {
      const creator = ProjectCreator.getInstance()
      const projectStore = useProjectStore()
      const config = {
        name: 'Test Project',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      const project = await creator.createProject(config)
      
      expect(projectStore.selectedFileUUID).toBe(project.uuid)
    })

    it('should throw error for empty name', async () => {
      const creator = ProjectCreator.getInstance()
      const config = {
        name: '',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      await expect(creator.createProject(config)).rejects.toThrow('工程名称不能为空')
    })

    it('should throw error for name too long', async () => {
      const creator = ProjectCreator.getInstance()
      const config = {
        name: 'a'.repeat(101),
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      await expect(creator.createProject(config)).rejects.toThrow('工程名称不能超过100个字符')
    })

    it('should throw error for invalid unitsPerEm', async () => {
      const creator = ProjectCreator.getInstance()
      const config = {
        name: 'Test Project',
        unitsPerEm: 0,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      await expect(creator.createProject(config)).rejects.toThrow('unitsPerEm必须在1-10000之间')
    })

    it('should throw error for unitsPerEm too large', async () => {
      const creator = ProjectCreator.getInstance()
      const config = {
        name: 'Test Project',
        unitsPerEm: 10001,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      }
      
      await expect(creator.createProject(config)).rejects.toThrow('unitsPerEm必须在1-10000之间')
    })
  })
})
