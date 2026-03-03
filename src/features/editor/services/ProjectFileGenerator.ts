/**
 * 工程文件生成器
 * 根据原版工程文件生成适用于重构版的新格式文件
 */

import { projectMigrator, ProjectMigrator } from './ProjectMigrator'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'

export class ProjectFileGenerator {
  /**
   * 从原版工程文件生成新版工程文件
   */
  async generateFromOldFormat(oldDataPath: string): Promise<any> {
    try {
      // 读取原版工程文件
      const response = await fetch(oldDataPath)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`)
      }
      
      const oldData = await response.json()
      
      // 检查是否需要迁移
      if (ProjectMigrator.needsMigration(oldData)) {
        // 执行迁移
        const migratedData = await projectMigrator.migrate(oldData)
        return migratedData
      } else {
        // 已经是新格式，直接返回
        return oldData
      }
    } catch (error) {
      console.error('Failed to generate project file:', error)
      throw error
    }
  }

  /**
   * 生成新的工程文件JSON字符串
   */
  async generateJSON(oldData: any): Promise<string> {
    // 执行迁移
    const migratedData = await projectMigrator.migrate(oldData)
    
    // 转换为JSON字符串
    return JSON.stringify(migratedData, null, 2)
  }

  /**
   * 下载生成的工程文件
   */
  async downloadProjectFile(data: any, filename: string = 'project.json'): Promise<void> {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  }
}

// 导出单例
export const projectFileGenerator = new ProjectFileGenerator()
