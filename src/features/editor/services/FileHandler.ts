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
   * 保存工程文件
   */
  async saveFile(): Promise<void> {
    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    // TODO: 实现保存逻辑
    // 1. 收集所有数据
    // 2. 从IndexedDB加载大型数据
    // 3. 序列化为JSON
    // 4. 保存到文件

    console.log('Saving file:', file.name)
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
