/**
 * ProjectFileGenerator 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectFileGenerator } from '@/features/editor/services/ProjectFileGenerator'
import { projectMigrator, ProjectMigrator } from '@/features/editor/services/ProjectMigrator'

// Mock fetch
global.fetch = vi.fn()

// Mock ProjectMigrator
const { mockMigrate, mockNeedsMigration } = vi.hoisted(() => {
  const mockMigrate = vi.fn()
  const mockNeedsMigration = vi.fn()
  return { mockMigrate, mockNeedsMigration }
})

vi.mock('@/features/editor/services/ProjectMigrator', () => ({
  projectMigrator: {
    migrate: mockMigrate,
  },
  ProjectMigrator: {
    needsMigration: mockNeedsMigration,
  },
}))

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock document.createElement and appendChild
const mockAnchor = {
  href: '',
  download: '',
  click: vi.fn(),
}
document.createElement = vi.fn((tag: string) => {
  if (tag === 'a') {
    return mockAnchor as any
  }
  return {} as any
})
document.body.appendChild = vi.fn()
document.body.removeChild = vi.fn()

describe('ProjectFileGenerator', () => {
  const generator = new ProjectFileGenerator()

  beforeEach(() => {
    vi.clearAllMocks()
    mockMigrate.mockClear()
    mockNeedsMigration.mockClear()
  })

  describe('generateFromOldFormat', () => {
    it('should generate project file from old format', async () => {
      const oldData = { version: '1.0', file: { uuid: 'file-1' } }
      const migratedData = { version: '2.0', file: { uuid: 'file-1' } }
      
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => oldData,
      })
      mockMigrate.mockResolvedValue(migratedData)
      mockNeedsMigration.mockReturnValue(true)

      const result = await generator.generateFromOldFormat('/path/to/file.json')

      expect(result).toEqual(migratedData)
      expect(projectMigrator.migrate).toHaveBeenCalledWith(oldData)
    })

    it('should return data directly if already new format', async () => {
      const newData = { version: '2.0', file: { uuid: 'file-1' } }
      
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => newData,
      })
      mockNeedsMigration.mockReturnValue(false)

      const result = await generator.generateFromOldFormat('/path/to/file.json')

      expect(result).toEqual(newData)
      expect(projectMigrator.migrate).not.toHaveBeenCalled()
    })

    it('should throw error when fetch fails', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })

      await expect(generator.generateFromOldFormat('/path/to/file.json')).rejects.toThrow()
    })
  })

  describe('generateJSON', () => {
    it('should generate JSON string from old data', async () => {
      const oldData = { version: '1.0' }
      const migratedData = { version: '2.0', file: { uuid: 'file-1' } }
      
      mockMigrate.mockResolvedValue(migratedData)

      const json = await generator.generateJSON(oldData)

      expect(json).toBe(JSON.stringify(migratedData, null, 2))
      expect(projectMigrator.migrate).toHaveBeenCalledWith(oldData)
    })
  })

  describe('downloadProjectFile', () => {
    it('should download project file', async () => {
      const data = { version: '2.0', file: { uuid: 'file-1' } }
      
      await generator.downloadProjectFile(data, 'test-project.json')

      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(mockAnchor.href).toBe('blob:mock-url')
      expect(mockAnchor.download).toBe('test-project.json')
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(document.body.appendChild).toHaveBeenCalled()
      expect(document.body.removeChild).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('should use default filename', async () => {
      const data = { version: '2.0' }
      
      await generator.downloadProjectFile(data)

      expect(mockAnchor.download).toBe('project.json')
    })
  })
})
