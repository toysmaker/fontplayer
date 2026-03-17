/**
 * 工程创建器
 * 负责创建新工程，包括验证配置、创建工程结构、初始化默认设置等
 */

import type { IFile, IFontSettings } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { useProjectStore } from '@/stores/project'
import { hasChineseChar } from '@/fontManager/utils'
import { convertToPinyin } from 'tiny-pinyin'

/** Name table entry shape for fontSettings.tables.name (matches FontSettingsMoreDialog) */
interface NameTableEntry {
  nameID: number
  nameLabel: string
  platformID: number
  encodingID: number
  langID: number
  value: string
  default?: boolean
}

function getEnName(name: string): string {
  if (hasChineseChar(name)) {
    return convertToPinyin(name)
  }
  return name
}

/**
 * 创建工程时预设的 name 表必须字段（参考原工程 CreateFileDialog）
 */
function createDefaultNameTable(fontName: string): NameTableEntry[] {
  const enName = getEnName(fontName)
  const postScriptValue = (enName + '-Regular').replace(/\s/g, '').slice(0, 63)
  return [
    { nameID: 1, nameLabel: 'fontFamily', platformID: 3, encodingID: 1, langID: 0x804, value: fontName, default: true },
    { nameID: 1, nameLabel: 'fontFamily', platformID: 3, encodingID: 1, langID: 0x409, value: fontName, default: true },
    { nameID: 2, nameLabel: 'fontSubfamily', platformID: 3, encodingID: 1, langID: 0x804, value: '常规体', default: true },
    { nameID: 2, nameLabel: 'fontSubfamily', platformID: 3, encodingID: 1, langID: 0x409, value: 'Regular', default: true },
    { nameID: 4, nameLabel: 'fullName', platformID: 3, encodingID: 1, langID: 0x804, value: fontName + ' 常规体', default: true },
    { nameID: 4, nameLabel: 'fullName', platformID: 3, encodingID: 1, langID: 0x409, value: fontName + ' Regular', default: true },
    { nameID: 5, nameLabel: 'version', platformID: 3, encodingID: 1, langID: 0x804, value: 'Version 1.0', default: true },
    { nameID: 5, nameLabel: 'version', platformID: 3, encodingID: 1, langID: 0x409, value: 'Version 1.0', default: true },
    { nameID: 6, nameLabel: 'postScriptName', platformID: 3, encodingID: 1, langID: 0x804, value: postScriptValue, default: true },
    { nameID: 6, nameLabel: 'postScriptName', platformID: 3, encodingID: 1, langID: 0x409, value: postScriptValue, default: true },
  ]
}

/**
 * 工程配置接口
 */
export interface ProjectConfig {
  name: string
  unitsPerEm: number
  ascender: number
  descender: number
  useDefaultTemplate: boolean
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

    // 2. 创建工程结构（预设 name 表必须字段，参考原工程 CreateFileDialog）
    const project: IFile = {
      uuid: genUUID(),
      name: config.name,
      width: config.unitsPerEm,
      height: config.unitsPerEm,
      saved: false,
      iconsCount: 0,
      fontSettings: {
        unitsPerEm: config.unitsPerEm,
        ascender: config.ascender,
        descender: config.descender,
        tables: {
          name: createDefaultNameTable(config.name),
        },
      },
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

    if (config.unitsPerEm <= 0 || config.unitsPerEm > 10000) {
      throw new Error('unitsPerEm必须在1-10000之间')
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
