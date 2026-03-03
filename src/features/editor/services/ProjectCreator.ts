/**
 * 工程创建器
 * 负责创建新工程，包括验证配置、创建工程结构、初始化默认设置等
 */

import type { IFile, IFontSettings } from '@/core/types'
import { genUUID } from '@/core/script/adapters'
import { useProjectStore } from '@/stores/project'

/**
 * 工程配置接口
 */
export interface ProjectConfig {
  name: string
  width?: number
  height?: number
}

/**
 * 工程创建器类
 * 使用单例模式，确保全局只有一个实例
 */
export class ProjectCreator {
  private static instance: ProjectCreator | null = null

  /**
   * 获取单例实例
   */
  static getInstance(): ProjectCreator {
    if (!ProjectCreator.instance) {
      ProjectCreator.instance = new ProjectCreator()
    }
    return ProjectCreator.instance
  }

  /**
   * 私有构造函数，防止外部实例化
   */
  private constructor() {
    // 单例模式，不允许外部实例化
  }

  /**
   * 创建新工程
   * @param config 工程配置
   * @returns 创建的工程文件
   */
  async createProject(config: ProjectConfig): Promise<IFile> {
    // 1. 验证配置
    this.validateConfig(config)

    // 2. 创建工程结构
    const project: IFile = {
      uuid: genUUID(),
      name: config.name,
      width: config.width || 1000,
      height: config.height || 1000,
      saved: false,
      iconsCount: 0,
      fontSettings: this.createDefaultFontSettings(),
      characterList: [],
      glyphs: [],
      stroke_glyphs: [],
      radical_glyphs: [],
      comp_glyphs: [],
      constants: [],
    }

    // 3. 添加到Store
    const projectStore = useProjectStore()
    const success = projectStore.addFile(project)
    if (!success) {
      throw new Error('Failed to add project to store')
    }

    // 4. 选择新创建的工程
    projectStore.selectFile(project.uuid)

    return project
  }

  /**
   * 验证配置
   * @param config 工程配置
   */
  private validateConfig(config: ProjectConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('工程名称不能为空')
    }

    if (config.name.length > 100) {
      throw new Error('工程名称不能超过100个字符')
    }

    if (config.width !== undefined && (config.width <= 0 || config.width > 10000)) {
      throw new Error('工程宽度必须在1-10000之间')
    }

    if (config.height !== undefined && (config.height <= 0 || config.height > 10000)) {
      throw new Error('工程高度必须在1-10000之间')
    }
  }

  /**
   * 创建默认字体设置
   */
  private createDefaultFontSettings(): IFontSettings {
    return {
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    }
  }
}

// 导出单例实例
export const projectCreator = ProjectCreator.getInstance()
