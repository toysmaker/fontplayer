/**
 * 工程流程集成测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ProjectCreator } from '@/features/editor/services/ProjectCreator'
import { ProjectLoader } from '@/features/editor/services/ProjectLoader'
import { useProjectStore } from '@/stores/project'
import { createMockFile } from '../helpers/mock-helpers'

describe('Project Flow Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('create and load project', () => {
    it('should create project and add to store', async () => {
      const creator = ProjectCreator.getInstance()
      const projectStore = useProjectStore()

      const project = await creator.createProject({
        name: 'Test Project',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        useDefaultTemplate: false,
      })

      expect(projectStore.files).toHaveLength(1)
      expect(projectStore.selectedFileUUID).toBe(project.uuid)
      expect(projectStore.selectedFile?.name).toBe('Test Project')
    })

    it('should load project and update store', async () => {
      const loader = new ProjectLoader()
      const projectStore = useProjectStore()
      const data = {
        version: '2.0',
        file: createMockFile({
          uuid: 'file-1',
          name: 'Loaded Project',
        }),
        glyphs: [],
        stroke_glyphs: [],
        radical_glyphs: [],
        comp_glyphs: [],
        constants: [],
      }

      const file = await loader.loadProject(data)

      expect(file.name).toBe('Loaded Project')
      expect(projectStore.loading).toBe(false)
    })
  })
})
