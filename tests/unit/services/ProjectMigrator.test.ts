/**
 * ProjectMigrator 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectMigrator } from '@/features/editor/services/ProjectMigrator'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'

// Mock IndexedDBManager
vi.mock('@/core/storage/IndexedDBManager', () => ({
  indexedDBManager: {
    set: vi.fn().mockResolvedValue(undefined),
  },
  IndexedDBManager: {
    generateContourKey: vi.fn((uuid: string) => `contour_${uuid}`),
    generatePreviewKey: vi.fn((uuid: string) => `preview_${uuid}`),
  },
}))

describe('ProjectMigrator', () => {
  const migrator = new ProjectMigrator()

  describe('needsMigration', () => {
    it('should return false for version 2.0', () => {
      const data = { version: '2.0' }
      expect(ProjectMigrator.needsMigration(data)).toBe(false)
    })

    it('should return true when character has contour data', () => {
      const data = {
        file: {
          characterList: [
            {
              uuid: 'char-1',
              contour: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }],
            },
          ],
        },
      }
      expect(ProjectMigrator.needsMigration(data)).toBe(true)
    })

    it('should return false when character has contourRef', () => {
      const data = {
        file: {
          characterList: [
            {
              uuid: 'char-1',
              contourRef: 'contour_char-1',
            },
          ],
        },
      }
      expect(ProjectMigrator.needsMigration(data)).toBe(false)
    })
  })

  describe('migrate', () => {
    it('should migrate project data', async () => {
      const oldData = {
        version: '1.0',
        file: {
          uuid: 'file-1',
          name: 'Test Project',
          width: 1000,
          height: 1000,
          fontSettings: {
            unitsPerEm: 1000,
            ascender: 800,
            descender: -200,
          },
          characterList: [
            {
              uuid: 'char-1',
              type: 'character',
              character: { text: '测试' },
              components: [],
            },
          ],
        },
        glyphs: [],
        stroke_glyphs: [],
        radical_glyphs: [],
        comp_glyphs: [],
        constants: [],
      }

      const migrated = await migrator.migrate(oldData)

      expect(migrated.version).toBe('2.0')
      expect(migrated.file.uuid).toBe('file-1')
      expect(migrated.file.name).toBe('Test Project')
      expect(migrated.file.characterList).toHaveLength(1)
    })

    it('should migrate character contour to IndexedDB', async () => {
      const oldData = {
        file: {
          uuid: 'file-1',
          name: 'Test',
          width: 1000,
          height: 1000,
          characterList: [
            {
              uuid: 'char-1',
              type: 'character',
              character: { text: '测试' },
              contour: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }],
            },
          ],
        },
        glyphs: [],
        stroke_glyphs: [],
        radical_glyphs: [],
        comp_glyphs: [],
        constants: [],
      }

      const migrated = await migrator.migrate(oldData)

      expect(indexedDBManager.set).toHaveBeenCalled()
      expect(migrated.file.characterList[0].contourRef).toBeDefined()
    })

    it('should migrate character preview to IndexedDB', async () => {
      const oldData = {
        file: {
          uuid: 'file-1',
          name: 'Test',
          width: 1000,
          height: 1000,
          characterList: [
            {
              uuid: 'char-1',
              type: 'character',
              character: { text: '测试' },
              preview: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }],
            },
          ],
        },
        glyphs: [],
        stroke_glyphs: [],
        radical_glyphs: [],
        comp_glyphs: [],
        constants: [],
      }

      const migrated = await migrator.migrate(oldData)

      expect(indexedDBManager.set).toHaveBeenCalled()
      expect(migrated.file.characterList[0].previewRef).toBeDefined()
    })
  })
})
