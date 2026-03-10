/**
 * 文件处理服务
 * 处理工程文件的打开、保存等操作
 */

import { projectLoader } from './ProjectLoader'
import { projectCreator } from './ProjectCreator'
import { useProjectStore } from '@/stores/project'
import { isTauri } from '@/utils/env'
import type { ProjectConfig } from './ProjectCreator'

export class FileHandler {
  /**
   * 获取 projectStore（延迟获取，避免在模块加载时调用）
   */
  private get projectStore() {
    return useProjectStore()
  }

  /**
   * 打开工程文件（Web）
   */
  async openFileWeb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.style.display = 'none'

      input.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLInputElement
        const files = target.files
        if (!files || files.length === 0) {
          reject(new Error('No file selected'))
          return
        }

        const file = files[0]
        const reader = new FileReader()

        reader.onload = async () => {
          try {
            const data = JSON.parse(reader.result as string)
            const projectFile = await projectLoader.loadProject(data)
            
            // 确保 loading 状态已清除
            await new Promise(resolve => {
              requestAnimationFrame(() => {
                setTimeout(() => resolve(undefined), 0)
              })
            })
            
            // 添加到项目列表
            const success = this.projectStore.addFile(projectFile)
            if (success) {
              // 延迟选择文件，确保UI能够响应
              await new Promise(resolve => {
                requestAnimationFrame(() => {
                  setTimeout(() => resolve(undefined), 0)
                })
              })
              
              this.projectStore.selectFile(projectFile.uuid)
              resolve()
            } else {
              reject(new Error('Failed to add file'))
            }
          } catch (error) {
            reject(error)
          }
        }

        reader.onerror = () => {
          document.body.removeChild(input)
          reject(new Error('Failed to read file'))
        }

        reader.readAsText(file)
      })

      input.addEventListener('cancel', () => {
        document.body.removeChild(input)
        reject(new Error('File selection cancelled'))
      })

      document.body.appendChild(input)
      input.click()
    })
  }

  /**
   * 打开工程文件（Tauri）
   */
  async openFileTauri(): Promise<void> {
    if (!isTauri()) {
      throw new Error('Not in Tauri environment')
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const file = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      })

      if (!file) {
        throw new Error('No file selected')
      }

      const filePath = typeof file === 'string' ? file : (file as any).path || file
      if (!filePath) {
        throw new Error('No file path available')
      }

      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const content = await readTextFile(filePath)
      const data = JSON.parse(content)

      const projectFile = await projectLoader.loadProject(data)
      
      // 确保 loading 状态已清除
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          setTimeout(() => resolve(undefined), 0)
        })
      })
      
      const success = this.projectStore.addFile(projectFile)
      
      if (success) {
        // 延迟选择文件，确保UI能够响应
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            setTimeout(() => resolve(undefined), 0)
          })
        })
        
        this.projectStore.selectFile(projectFile.uuid)
      } else {
        throw new Error('Failed to add file')
      }
    } catch (error) {
      console.error('Failed to open file:', error)
      throw error
    }
  }

  /**
   * 打开工程文件（自动选择Web或Tauri）
   */
  async openFile(): Promise<void> {
    if (isTauri()) {
      return this.openFileTauri()
    } else {
      return this.openFileWeb()
    }
  }

  /**
   * 保存工程文件（Web）
   */
  async saveFileWeb(): Promise<void> {
    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    // 1. 收集所有数据
    const projectData = await this.serializeProjectData(file)
    
    // 2. 创建下载链接
    const json = JSON.stringify(projectData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${file.name}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
    
    // 3. 标记为已保存
    this.projectStore.markFileSaved(file.uuid)
  }

  /**
   * 保存工程文件（Tauri）
   */
  async saveFileTauri(): Promise<void> {
    if (!isTauri()) {
      throw new Error('Not in Tauri environment')
    }

    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    try {
      // 1. 收集所有数据
      const projectData = await this.serializeProjectData(file)
      const json = JSON.stringify(projectData, null, 2)

      // 2. 使用 Tauri 对话框选择保存位置
      const { save } = await import('@tauri-apps/plugin-dialog')
      const filePath = await save({
        defaultPath: `${file.name}.json`,
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      })

      if (!filePath) {
        throw new Error('No file path selected')
      }

      // 3. 写入文件
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(filePath, json)

      // 4. 标记为已保存
      this.projectStore.markFileSaved(file.uuid)
    } catch (error) {
      console.error('Failed to save file:', error)
      throw error
    }
  }

  /**
   * 保存工程文件（自动选择Web或Tauri）
   */
  async saveFile(): Promise<void> {
    if (isTauri()) {
      return this.saveFileTauri()
    } else {
      return this.saveFileWeb()
    }
  }

  /**
   * 序列化工程数据
   */
  private async serializeProjectData(file: any): Promise<any> {
    const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
    
    // 1. 从 IndexedDB 加载所有字符数据
    // 注意：重构工程中，内存只保存 metadata（uuid, type, character），完整数据在 IndexedDB
    // characterDataManager.loadCharacter 会从 IndexedDB 加载完整的 ICharacterFileLite，包括：
    // - components（所有组件数据）
    // - groups, orderedList
    // - view, info
    // - script, glyph_script
    // - selectedComponentsTree, selectedComponentsUUIDs
    // - contourRef, previewRef（IndexedDB 引用，保存时需要移除）
    const characterList: any[] = []
    for (const metadata of file.characterList) {
      // 从 IndexedDB 加载完整的字符数据
      const character = await characterDataManager.loadCharacter(file.uuid, metadata.uuid)
      if (character) {
        // 确认：此时 character 已经是完整的 ICharacterFileLite，包含所有必要数据
        // plainCharacter 的作用是清理运行时缓存数据（contour/preview），移除 IndexedDB 引用
        const plainCharacter = this.plainCharacter(character)
        characterList.push(plainCharacter)
      } else {
        console.warn(`Failed to load character ${metadata.uuid} from IndexedDB`)
      }
    }

    // 2. 构建工程数据
    return {
      version: '2.0',
      file: {
        uuid: file.uuid,
        name: file.name,
        width: file.width,
        height: file.height,
        saved: true,
        iconsCount: file.iconsCount,
        fontSettings: file.fontSettings,
        characterList,
        variants: file.variants,
      },
      glyphs: file.glyphs || [],
      stroke_glyphs: file.stroke_glyphs || [],
      radical_glyphs: file.radical_glyphs || [],
      comp_glyphs: file.comp_glyphs || [],
      constants: file.constants || [],
      constantGlyphMap: {}, // TODO: 如果需要，从 store 获取
    }
  }

  /**
   * 清理字符数据中的运行时缓存（contour/preview）和 IndexedDB 引用
   * 
   * 注意：
   * 1. 调用此方法时，character 参数应该是完整的 ICharacterFileLite（已从 IndexedDB 加载）
   * 2. ICharacterFileLite 包含所有必要数据：components, groups, orderedList, view, info, script 等
   * 3. 但组件中可能包含运行时计算的 contour/preview 缓存（临时数据，不应保存）
   * 4. contourRef/previewRef 是 IndexedDB 引用，不应保存到工程文件
   * 
   * @param character 完整的 ICharacterFileLite（从 IndexedDB 加载）
   * @returns 清理后的字符数据（可序列化）
   */
  private plainCharacter(character: any): any {
    // 深拷贝字符数据，避免修改原始数据
    const data: any = {
      uuid: character.uuid,
      type: character.type,
      character: character.character,
      components: (character.components || []).map((component: any) => {
        // 清理组件中的运行时缓存数据
        const cleanComponent = { ...component }
        
        // 清理组件 value 中的 contour 和 preview（运行时计算的缓存）
        if (cleanComponent.value) {
          const cleanValue = { ...cleanComponent.value }
          
          // 移除所有组件类型中可能存在的 contour/preview
          if ('contour' in cleanValue) {
            delete cleanValue.contour
          }
          if ('preview' in cleanValue) {
            delete cleanValue.preview
          }
          
          // 对于图片组件，移除运行时数据
          if (cleanValue.img) {
            delete cleanValue.img
          }
          if (cleanValue.originImg) {
            delete cleanValue.originImg
          }
          if (cleanValue.pixels) {
            delete cleanValue.pixels
          }
          
          cleanComponent.value = cleanValue
        }
        
        return cleanComponent
      }),
      groups: character.groups || [],
      orderedList: character.orderedList || [],
      view: character.view || { zoom: 100, translateX: 0, translateY: 0 },
      selectedComponentsUUIDs: character.selectedComponentsUUIDs || [],
    }

    // 可选字段
    if (character.script) {
      data.script = character.script
    }
    if (character.info) {
      data.info = character.info
    }
    if (character.glyph_script) {
      data.glyph_script = character.glyph_script
    }
    if (character.selectedComponentsTree) {
      data.selectedComponentsTree = character.selectedComponentsTree
    }

    // 注意：不保存 contourRef/previewRef，这些是 IndexedDB 的引用
    // 保存时，工程文件应该只包含可序列化的数据，不包含 IndexedDB 引用

    return data
  }

  /**
   * 创建新工程
   * @param config 工程配置
   * @returns 创建的工程文件
   */
  async createProject(config: ProjectConfig) {
    // 检查是否已有工程打开
    if (this.projectStore.hasFiles) {
      throw new Error('目前字玩仅支持同时编辑一个工程，请关闭当前工程再新建。注意，关闭工程前请保存工程以避免数据丢失。')
    }

    // 创建工程
    const project = await projectCreator.createProject(config)
    return project
  }
}

// 导出单例
export const fileHandler = new FileHandler()
