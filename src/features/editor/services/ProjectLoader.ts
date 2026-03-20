/**
 * 工程文件加载器
 * 负责加载和解析工程文件，支持7000+字符的大型工程
 */

import type { IFile, ICharacterFileLite, ICharacterFileMetadata, ICustomGlyph, IParameter, IFontSettings } from '@/core/types'
import { ParameterType } from '@/core/types'
import { indexedDBManager, IndexedDBManager } from '@/core/storage/IndexedDBManager'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { useProjectStore } from '@/stores/project'
import { projectMigrator, ProjectMigrator } from './ProjectMigrator'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { ContourConverter } from '@/core/font/converter'

export interface LoadProgress {
  loaded: number
  total: number
  message: string
}

export class ProjectLoader {
  private onProgress?: (progress: LoadProgress) => void

  /**
   * 获取 projectStore（延迟获取，避免在模块加载时调用）
   */
  private get projectStore() {
    return useProjectStore()
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: (progress: LoadProgress) => void) {
    this.onProgress = callback
  }

  /**
   * 加载工程文件
   */
  async loadProject(data: any): Promise<IFile> {
    try {
      const store = this.projectStore
      store.loading = true
      
      // 检查是否需要迁移
      if (ProjectMigrator.needsMigration(data)) {
        this.updateProgress(0, '正在迁移工程文件格式...')
        data = await projectMigrator.migrate(data)
      }
      
      store.loadingTotal = this.calculateTotal(data)
      store.loadingProgress = 0

      // 1. 处理字形数据
      await this.processGlyphs(data)
      
      // 2. 处理字符数据
      await this.processCharacters(data.file)
      
      // 3. 处理常量数据
      const constants = data.constants || []
      if (constants.length > 0) {
        this.updateProgress(0, `加载全局常量: ${constants.length} 个`)
      }

      // 让出主线程，确保UI能够响应
      await this.yieldToMainThread()

      // 4. 创建文件对象
      const file: IFile = {
        uuid: data.file.uuid,
        name: data.file.name,
        width: data.file.width,
        height: data.file.height,
        saved: false,
        iconsCount: data.file.characterList?.length || 0,
        fontSettings: data.file.fontSettings,
        characterList: data.file.characterList || [],
        glyphs: data.glyphs || [],
        stroke_glyphs: data.stroke_glyphs || [],
        radical_glyphs: data.radical_glyphs || [],
        comp_glyphs: data.comp_glyphs || [],
        constants: constants,
        constantGlyphMap:
          data.constantGlyphMap && typeof data.constantGlyphMap === 'object' && !Array.isArray(data.constantGlyphMap)
            ? Object.fromEntries(
                Object.entries(data.constantGlyphMap as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
              )
            : undefined,
        variants: data.file.variants,
      }

      // 再次让出主线程，确保文件对象创建后UI能够更新
      await this.yieldToMainThread()

      // 清理内存：移除组件中的 contour 和 preview 数据（这些可以从组件数据重新计算）
      this.updateProgress(store.loadingTotal - 1, '清理内存...')
      await this.cleanupMemory(file)

      this.updateProgress(store.loadingTotal, '工程加载完成')
      
      // 延迟设置 loading = false，确保进度条能够显示完成状态
      await this.yieldToMainThread()
      store.loading = false

      return file
    } catch (error) {
      const store = this.projectStore
      store.loading = false
      console.error('Failed to load project:', error)
      throw error
    }
  }

  /**
   * 处理字形数据
   */
  private async processGlyphs(data: any): Promise<void> {
    const glyphTypes: Array<keyof IFile> = [
      'glyphs',
      'stroke_glyphs',
      'radical_glyphs',
      'comp_glyphs',
    ]

    let processed = 0
    const total = glyphTypes.reduce((sum, type) => {
      return sum + (data[type]?.length || 0)
    }, 0)

    // 获取字体设置（用于轮廓计算）
    const fontSettings: IFontSettings = data.file?.fontSettings || {
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    }

    for (const type of glyphTypes) {
      const glyphs = data[type] || []
      
      for (const glyph of glyphs) {
        // 处理字形数据
        await this.processSingleGlyph(glyph, fontSettings)
        processed++
        
        // 减少进度更新频率，每10个字形更新一次
        if (processed % 10 === 0 || processed === total) {
          this.updateProgress(processed, `处理字形: ${glyph.name || glyph.uuid} (${processed}/${total})`)
        }
        
        // 每处理50个字形，让出主线程
        if (processed % 50 === 0) {
          await this.yieldToMainThread()
        }
      }
    }
  }

  /**
   * 处理单个字形
   * 1. 创建临时实例
   * 2. 执行脚本（生成组件）
   * 3. 计算轮廓和预览
   * 4. 存储到 IndexedDB
   * 5. 保存引用到字形
   * 6. 释放实例（清理 _o）
   */
  private async processSingleGlyph(glyph: ICustomGlyph, fontSettings: IFontSettings): Promise<void> {
    try {
      // 如果已经有 contourRef 和 previewRef，说明已经处理过，跳过
      if (glyph.contourRef && glyph.previewRef) {
        return
      }

      // 1. 创建临时实例（用于脚本执行和轮廓计算）
      const instanceKey = glyph.uuid
      const glyphInstance = instanceManager.acquireTemporaryInstance(
        instanceKey,
        () => new CustomGlyph(glyph),
        'glyph'
      )

      try {
        // 2. 执行脚本（生成组件）
        executeGlyphScript(glyph, instanceKey)

        // 3. 获取执行脚本后的组件（从实例中获取）
        const components = glyphInstance.components || glyph.components || []
        
        if (components.length === 0) {
          // 没有组件，不需要计算轮廓
          return
        }

        // 4. 计算轮廓和预览
        const unitsPerEm = fontSettings.unitsPerEm || 1000
        const descender = fontSettings.descender || -200

        // 计算轮廓（非预览）
        const contours = ContourConverter.componentsToContours(
          components as any,
          {
            unitsPerEm,
            descender,
            advanceWidth: unitsPerEm,
            preview: false,
            forceUpdate: true, // 强制更新，确保计算最新的轮廓
          },
          { x: 0, y: 0 }
        )

        // 计算预览
        const previews = ContourConverter.componentsToContours(
          components as any,
          {
            unitsPerEm,
            descender,
            advanceWidth: unitsPerEm,
            preview: true,
            forceUpdate: true, // 强制更新，确保计算最新的预览
          },
          { x: 0, y: 0 }
        )

        // 5. 存储到 IndexedDB（并行存储，提高性能）
        const indexDBPromises: Promise<void>[] = []

        if (contours.length > 0) {
          const contourKey = IndexedDBManager.generateContourKey(glyph.uuid)
          indexDBPromises.push(
            indexedDBManager.set(contourKey, contours).then(() => {
              glyph.contourRef = contourKey
            })
          )
        }

        if (previews.length > 0) {
          const previewKey = IndexedDBManager.generatePreviewKey(glyph.uuid)
          indexDBPromises.push(
            indexedDBManager.set(previewKey, previews).then(() => {
              glyph.previewRef = previewKey
            })
          )
        }

        // 等待所有 IndexedDB 操作完成
        if (indexDBPromises.length > 0) {
          await Promise.all(indexDBPromises)
        }
      } finally {
        // 6. 释放临时实例（清理 _o 引用）
        instanceManager.releaseTemporaryInstance(instanceKey)
      }
    } catch (error) {
      console.error(`Error processing glyph ${glyph.uuid}:`, error)
      // 即使出错，也要确保释放实例
      const instanceKey = glyph.uuid
      if (instanceManager.isTemporary(instanceKey)) {
        instanceManager.releaseTemporaryInstance(instanceKey)
      }
      // 不再维护 glyph._o，统一从 InstanceManager 管理
      // 不抛出错误，继续处理其他字形
    }
  }

  /**
   * 处理字符数据
   * 将完整字符数据存储到IndexedDB，只保留元数据在内存中
   */
  private async processCharacters(file: any): Promise<void> {
    const characters = file.characterList || []
    const fontSettings = file.fontSettings
    const fileUUID = file.uuid
    let processed = 0
    const total = characters.length

    // 存储完整字符数据的数组（批量存储到IndexedDB）
    const fullCharacters: ICharacterFileLite[] = []
    // 存储元数据的数组（保留在内存中）
    const metadataList: ICharacterFileMetadata[] = []

    // 使用索引遍历，避免 indexOf 的性能问题
    for (let i = 0; i < characters.length; i++) {
      const character = characters[i]
      
      // 转换为轻量版字符文件
      // 注意：工程文件中不包含 contour/preview，需要后续按需计算
      const characterLite: ICharacterFileLite = await this.convertToCharacterLite(character, fontSettings)
      
      // 保存完整数据（稍后存储到IndexedDB）
      fullCharacters.push(characterLite)
      
      // 只保留元数据在内存中
      const metadata: ICharacterFileMetadata = {
        uuid: characterLite.uuid,
        type: characterLite.type,
        character: characterLite.character,
      }
      metadataList.push(metadata)
      
      processed++
      
      // 减少进度更新频率，每10个字符更新一次，避免UI阻塞
      if (processed % 10 === 0 || processed === total) {
        this.updateProgress(processed, `处理字符: ${character.character?.text || character.uuid} (${processed}/${total})`)
      }
      
      // 每处理50个字符，让出主线程（更频繁地让出，提高响应性）
      if (processed % 50 === 0) {
        await this.yieldToMainThread()
      }
    }

    // 批量存储完整字符数据到IndexedDB
    this.updateProgress(processed, '存储字符数据到IndexedDB...')
    await characterDataManager.storeCharacters(fileUUID, fullCharacters)
    
    // 替换为元数据列表
    file.characterList = metadataList
  }

  /**
   * 转换为轻量版字符文件
   * 注意：工程文件中不包含 contour/preview 数据（导出时已删除），需要重新计算
   */
  private async convertToCharacterLite(character: any, fontSettings?: any): Promise<ICharacterFileLite> {
    const characterLite: ICharacterFileLite = {
      uuid: character.uuid,
      type: character.type,
      character: character.character,
      components: character.components || [],
      groups: character.groups || [],
      orderedList: character.orderedList || [],
      view: character.view || { zoom: 100, translateX: 0, translateY: 0 },
      info: character.info,
      selectedComponentsTree: character.selectedComponentsTree,
      selectedComponentsUUIDs: character.selectedComponentsUUIDs,
      script: character.script,
      glyph_script: character.glyph_script,
    }

    // 工程文件中不包含 contour/preview（导出时已删除），需要重新计算
    // 轮廓计算逻辑已在 ContourConverter.componentsToContours 中实现
    // 计算会在渲染时按需进行，避免加载时阻塞
    
    // 如果有轮廓或预览数据（旧格式工程文件），存储到 IndexedDB
    // 注意：由于工程文件中通常不包含这些数据，这里主要是为了兼容旧格式
    // 使用 Promise.all 并行处理，提高性能
    const indexDBPromises: Promise<void>[] = []
    
    if (character.contour) {
      const contourKey = IndexedDBManager.generateContourKey(character.uuid)
      indexDBPromises.push(
        indexedDBManager.set(contourKey, character.contour).then(() => {
          characterLite.contourRef = contourKey
        })
      )
    }

    if (character.preview) {
      const previewKey = IndexedDBManager.generatePreviewKey(character.uuid)
      indexDBPromises.push(
        indexedDBManager.set(previewKey, character.preview).then(() => {
          characterLite.previewRef = previewKey
        })
      )
    }
    
    // 等待所有 IndexedDB 操作完成
    if (indexDBPromises.length > 0) {
      await Promise.all(indexDBPromises)
    }

    // TODO: 如果需要预计算轮廓（提升首次渲染性能），可以在这里调用轮廓计算
    // 但需要注意：轮廓计算需要完整的工具函数（genPenContour, formatPoints, transformPoints 等）
    // 这些函数需要从原代码迁移到重构代码中
    // 
    // 当前策略：按需计算
    // - 组件中的 contour/preview 字段保留，用于运行时计算的临时缓存
    // - 字符级别的 contourRef/previewRef 用于持久化（如果计算过）
    // - 渲染时，如果组件没有 contour/preview，会触发计算（需要实现计算逻辑）

    return characterLite
  }

  /**
   * 计算总工作量
   */
  private calculateTotal(data: any): number {
    let total = 0
    
    // 字符数量
    total += data.file?.characterList?.length || 0
    
    // 字形数量（每种类型）
    total += data.glyphs?.length || 0
    total += data.stroke_glyphs?.length || 0
    total += data.radical_glyphs?.length || 0
    total += data.comp_glyphs?.length || 0
    
    return total
  }

  /**
   * 更新进度
   * 使用节流机制，避免频繁更新导致UI阻塞
   */
  private lastUpdateTime = 0
  private readonly UPDATE_THROTTLE = 50 // 最多每50ms更新一次

  private updateProgress(loaded: number, message: string): void {
    const now = Date.now()
    
    // 节流：如果距离上次更新不足50ms，跳过本次更新（除非是最后一次）
    if (now - this.lastUpdateTime < this.UPDATE_THROTTLE && loaded < this.projectStore.loadingTotal) {
      return
    }
    
    this.lastUpdateTime = now
    
    const store = this.projectStore
    store.loadingProgress = loaded
    store.loadingMessage = message
    
    // 触发进度回调
    if (this.onProgress) {
      this.onProgress({
        loaded,
        total: store.loadingTotal,
        message,
      })
    }
  }

  /**
   * 让出主线程
   * 使用 requestAnimationFrame 确保UI能够更新
   */
  private yieldToMainThread(): Promise<void> {
    return new Promise(resolve => {
      // 使用 requestAnimationFrame 确保浏览器有机会更新UI
      requestAnimationFrame(() => {
        // 再使用 setTimeout 确保事件循环能够处理其他任务
        setTimeout(() => resolve(), 0)
      })
    })
  }

  /**
   * 清理内存：移除组件中的 contour 和 preview 数据
   * 这些数据可以从组件数据重新计算，不需要一直保存在内存中
   * 注意：字符数据已存储在IndexedDB中，这里只需要清理字形数据
   */
  private async cleanupMemory(file: IFile): Promise<void> {
    // 字符数据已经存储在IndexedDB中，不需要清理
    // 只需要清理字形组件

    // 清理字形组件
    const glyphTypes: Array<keyof IFile> = [
      'glyphs',
      'stroke_glyphs',
      'radical_glyphs',
      'comp_glyphs',
    ]

    for (const type of glyphTypes) {
      const glyphs = file[type] || []
      for (const glyph of glyphs) {
        if (glyph.components) {
          this.cleanupComponents(glyph.components)
        }
      }
    }
  }

  /**
   * 清理组件数组中的 contour 和 preview 数据
   */
  private cleanupComponents(components: any[]): void {
    for (const component of components) {
      if (!component || !component.value) continue

      const value = component.value

      // 清理各种组件类型的 contour 和 preview
      if (value.contour !== undefined) {
        delete value.contour
      }
      if (value.preview !== undefined) {
        delete value.preview
      }
      if (value.contour2 !== undefined) {
        delete value.contour2
      }

      // 如果是 glyph 组件，递归清理子组件
      if (component.type === 'glyph' && value.components) {
        this.cleanupComponents(value.components)
      }
    }
  }
}

// 导出单例
export const projectLoader = new ProjectLoader()
