/**
 * 文件处理服务
 * 处理工程文件的打开、保存等操作
 */

import { projectLoader } from './ProjectLoader'
import { projectCreator } from './ProjectCreator'
import { useProjectStore } from '@/stores/project'
import { isTauri } from '@/utils/env'
import type { ProjectConfig } from './ProjectCreator'
import localForage from 'localforage'

export class FileHandler {
  /** 记住上一次保存路径（Tauri 环境） */
  private lastSavedPath: string | null = null

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

    // 1. 收集所有数据（带进度条）
    const store = this.projectStore
    const total = file.characterList?.length || 0
    store.loadingMessage = '正在保存工程...'
    store.loadingTotal = total
    store.loadingProgress = 0
    store.loading = true

    try {
      const projectData = await this.serializeProjectData(file, (index) => {
        store.loadingProgress = index
      })
      
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
    } finally {
      store.loading = false
      try {
        const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
        characterDataManager.forceCleanupAllCache()
      } catch (e) {
        console.warn('[saveFileWeb] failed to cleanup character cache:', e)
      }
    }
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
   * Tauri：保存工程（记忆上一次保存路径，直接覆盖；首次保存时弹出对话框）
   * 注意：对话框必须在 JS 侧调用，不能在 Tauri command 线程中调用原生对话框（macOS 会崩溃）
   */
  async saveProjectTauriRememberPath(): Promise<void> {
    if (!isTauri()) {
      throw new Error('Not in Tauri environment')
    }

    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    let filePath = this.lastSavedPath

    if (!filePath) {
      // 还没有保存路径，弹出对话框让用户选择
      const { save } = await import('@tauri-apps/plugin-dialog')
      const result = await save({
        defaultPath: `${file.name}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!result) return // 用户取消
      filePath = result
      this.lastSavedPath = filePath
    }

    // 流式写入，避免大工程 JSON.stringify 导致 OOM 崩溃
    await this.writeProjectStream(file, filePath)
    this.projectStore.markFileSaved(file.uuid)
  }

  /**
   * Tauri：另存为（每次弹出保存对话框，并更新记忆路径）
   * 注意：对话框必须在 JS 侧调用，不能在 Tauri command 线程中调用原生对话框（macOS 会崩溃）
   */
  async saveProjectTauriAs(): Promise<void> {
    if (!isTauri()) {
      throw new Error('Not in Tauri environment')
    }

    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    const { save } = await import('@tauri-apps/plugin-dialog')
    const filePath = await save({
      defaultPath: `${file.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!filePath) return // 用户取消

    this.lastSavedPath = filePath

    // 流式写入，避免大工程 JSON.stringify 导致 OOM 崩溃
    await this.writeProjectStream(file, filePath)
    this.projectStore.markFileSaved(file.uuid)
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
   * 将当前工程缓存到 Web（localForage），用于“缓存工程”功能
   */
  async cacheProjectToWeb(): Promise<void> {
    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    const store = this.projectStore
    const total = file.characterList?.length || 0
    store.loadingMessage = '正在缓存工程...'
    store.loadingTotal = total
    store.loadingProgress = 0
    store.loading = true

    try {
      const projectData = await this.serializeProjectData(file, (index) => {
        store.loadingProgress = index
      })
      // 使用 JSON 字符串而不是原始对象，避免 IndexedDB 克隆失败（DataCloneError）
      const json = JSON.stringify(projectData)
      await localForage.setItem('project_cache_v2', json)
      await localForage.setItem('project_cache_v2_timestamp', Date.now())
    } finally {
      store.loading = false
      try {
        const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
        characterDataManager.forceCleanupAllCache()
      } catch (e) {
        console.warn('[cacheProjectToWeb] failed to cleanup character cache:', e)
      }
    }
  }

  /**
   * 清空工程缓存（Web）
   */
  async clearProjectCache(): Promise<void> {
    await localForage.removeItem('project_cache_v2')
    await localForage.removeItem('project_cache_v2_timestamp')
  }

  /**
   * 从 Web 缓存同步工程（如果当前没有打开工程）
   */
  async syncProjectFromCache(): Promise<void> {
    if (this.projectStore.hasFiles) {
      throw new Error('当前已存在打开的工程，请先关闭工程再同步缓存。')
    }

    const json = await localForage.getItem<string | null>('project_cache_v2')
    if (!json) {
      throw new Error('暂无可用的工程缓存。')
    }

    const data = JSON.parse(json)
    const file = await projectLoader.loadProject(data)
    const success = this.projectStore.addFile(file)
    if (success) {
      this.projectStore.selectFile(file.uuid)
    } else {
      throw new Error('Failed to add file from cache')
    }
  }

  /**
   * 导出工程（左侧”导出工程”按钮）
   * - Web：触发浏览器下载（先全量序列化，小工程可接受）
   * - Tauri：流式写入文件（逐字符序列化，避免大工程 OOM 崩溃）
   */
  async exportProject(): Promise<void> {
    const file = this.projectStore.selectedFile
    if (!file) {
      throw new Error('No file selected')
    }

    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const filePath = await save({
        defaultPath: `${file.name}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!filePath) return
      await this.writeProjectStream(file, filePath)
    } else {
      // Web 环境：全量序列化后触发浏览器下载（带进度条）
      const store = this.projectStore
      const total = file.characterList?.length || 0
      store.loadingMessage = '正在导出工程...'
      store.loadingTotal = total
      store.loadingProgress = 0
      store.loading = true

      try {
        const projectData = await this.serializeProjectData(file, (index) => {
          store.loadingProgress = index
        })
        this.logProjectDataSummary(projectData)
        let json: string
        try {
          json = JSON.stringify(projectData)
        } catch (error) {
          console.error('[FileHandler.exportProject] JSON.stringify failed:', error)
          this.logProjectDataDetails(projectData)
          throw error
        }
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${file.name}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } finally {
        store.loading = false
        try {
          const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
          characterDataManager.forceCleanupAllCache()
        } catch (e) {
          console.warn('[exportProject] failed to cleanup character cache:', e)
        }
      }
    }
  }

  /**
   * Tauri 专用：流式写入工程文件
   *
   * 大工程（7000字+）序列化为一个完整 JSON 字符串会消耗数百 MB 内存，
   * 导致 WKWebView 进程 OOM 崩溃。此方法逐字符从 IndexedDB 读取并写入文件，
   * 内存中同时只有一个字符的数据，彻底避免 OOM。
   *
   * 使用 invoke('write_file_chunk') Rust 命令，该命令内部使用 write_all
   * 保证每个 chunk 完整写入，避免 plugin-fs FileHandle.write() 可能的部分写入。
   */
  private async writeProjectStream(file: any, filePath: string): Promise<void> {
    const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const store = this.projectStore

    const characterList: any[] = file.characterList || []
    const total = characterList.length

    // 显示进度条
    store.loadingMessage = '正在保存工程...'
    store.loadingProgress = 0
    store.loadingTotal = total
    store.loading = true

    // 缓冲区：积累到 64KB 再 flush，减少 IPC 往返次数
    // 第一次写入截断创建文件，后续 append: true 追加
    // writeTextFile 内部使用 write_all，保证不会发生部分写入导致 JSON 损坏
    const FLUSH_SIZE = 64 * 1024
    let pending = ''
    let firstChunk = true

    const flush = async () => {
      if (pending.length === 0) return
      if (firstChunk) {
        await writeTextFile(filePath, pending)
        firstChunk = false
      } else {
        await writeTextFile(filePath, pending, { append: true })
      }
      pending = ''
    }

    const write = async (s: string) => {
      pending += s
      if (pending.length >= FLUSH_SIZE) {
        await flush()
      }
    }

    try {
      // 字形数组（通常远少于字符数，一次性序列化即可）
      const glyphs = this.cleanupGlyphArray(file.glyphs)
      const strokeGlyphs = this.cleanupGlyphArray(file.stroke_glyphs)
      const radicalGlyphs = this.cleanupGlyphArray(file.radical_glyphs)
      const compGlyphs = this.cleanupGlyphArray(file.comp_glyphs)

      // 写入 JSON 头部：顶层对象和 file 对象
      await write('{"version":"2.0","file":{')
      await write('"uuid":' + JSON.stringify(file.uuid) + ',')
      await write('"name":' + JSON.stringify(file.name) + ',')
      await write('"width":' + JSON.stringify(file.width ?? null) + ',')
      await write('"height":' + JSON.stringify(file.height ?? null) + ',')
      await write('"saved":true,')
      await write('"iconsCount":' + JSON.stringify(file.iconsCount ?? 0) + ',')
      await write('"fontSettings":' + JSON.stringify(file.fontSettings ?? null) + ',')
      await write('"variants":' + JSON.stringify(file.variants ?? null) + ',')
      await write('"characterList":[')

      // 逐字符流式写入（核心：每个字符序列化后立即写入并释放内存）
      let firstChar = true
      for (let i = 0; i < characterList.length; i++) {
        const metadata = characterList[i]
        const char = await characterDataManager.loadCharacter(file.uuid, metadata.uuid)
        if (!firstChar) await write(',')
        firstChar = false
        if (char) {
          await write(JSON.stringify(this.plainCharacter(char)))
        } else {
          console.warn(`[writeProjectStream] missing character ${metadata.uuid}, using metadata`)
          await write(JSON.stringify(metadata))
        }

        // 更新进度
        store.loadingProgress = i + 1
      }

      // 关闭 characterList 和 file 对象，并准备写顶层其他字段
      await write(']},')

      // 写入字形数组（逐条写入，防止字形数组也过大）
      const glyphGroups: [string, any[]][] = [
        ['glyphs', glyphs],
        ['stroke_glyphs', strokeGlyphs],
        ['radical_glyphs', radicalGlyphs],
        ['comp_glyphs', compGlyphs],
      ]

      for (let gi = 0; gi < glyphGroups.length; gi++) {
        const [key, arr] = glyphGroups[gi]
        await write(`"${key}":[`)
        let firstGlyph = true
        for (const g of arr) {
          if (!firstGlyph) await write(',')
          firstGlyph = false
          await write(JSON.stringify(g))
        }
        await write('],')
      }

      // constants 和 constantGlyphMap（最后一个字段后不再加逗号）
      await write('"constants":' + JSON.stringify(file.constants ?? []))
      await write(',"constantGlyphMap":{}}')

      await flush()
    } finally {
      store.loading = false
    }
  }

  /**
   * 序列化工程数据（适用于小工程或 Web 环境）
   * 大工程在 Tauri 端请改用 writeProjectStream，避免全量 JSON 导致 OOM。
   */
  private async serializeProjectData(
    file: any,
    onCharacterProgress?: (index: number) => void,
  ): Promise<any> {
    const { characterDataManager } = await import('@/core/storage/CharacterDataManager')

    const characterList: any[] = []
    const list: any[] = file.characterList || []
    for (let i = 0; i < list.length; i++) {
      const metadata = list[i]
      const character = await characterDataManager.loadCharacter(file.uuid, metadata.uuid)
      if (character) {
        characterList.push(this.plainCharacter(character))
      } else {
        console.warn(`Failed to load character ${metadata.uuid} from IndexedDB`)
      }
      if (onCharacterProgress) {
        onCharacterProgress(i + 1)
      }
    }

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
      glyphs: this.cleanupGlyphArray(file.glyphs),
      stroke_glyphs: this.cleanupGlyphArray(file.stroke_glyphs),
      radical_glyphs: this.cleanupGlyphArray(file.radical_glyphs),
      comp_glyphs: this.cleanupGlyphArray(file.comp_glyphs),
      constants: file.constants || [],
      constantGlyphMap: {},
    }
  }

  /** 清理组件运行时缓存字段（contour / preview 等） */
  private cleanupGlyphComponents(components: any[]): any[] {
    return (components || []).map((component: any) => {
      if (!component) return component
      const cleanComponent: any = { ...component }
      if (cleanComponent.value) {
        const value = { ...cleanComponent.value }
        delete value.contour
        delete value.preview
        delete value.contour2
        if (cleanComponent.type === 'glyph' && value.components) {
          value.components = this.cleanupGlyphComponents(value.components)
        }
        cleanComponent.value = value
      }
      if ('_o' in cleanComponent) delete cleanComponent._o
      return cleanComponent
    })
  }

  /** 清理字形数组运行时缓存字段 */
  private cleanupGlyphArray(glyphs: any[] | undefined): any[] {
    return (glyphs || []).map((glyph: any) => {
      const cleanGlyph: any = { ...glyph }
      if (cleanGlyph.components) {
        cleanGlyph.components = this.cleanupGlyphComponents(cleanGlyph.components)
      }
      if ('_o' in cleanGlyph) delete cleanGlyph._o
      return cleanGlyph
    })
  }

  /**
   * 调试用：输出工程数据的概要信息（不会打印完整数据）
   */
  private logProjectDataSummary(projectData: any): void {
    try {
      const file = projectData?.file || {}
      const glyphs = projectData?.glyphs || []
      const strokeGlyphs = projectData?.stroke_glyphs || []
      const radicalGlyphs = projectData?.radical_glyphs || []
      const compGlyphs = projectData?.comp_glyphs || []
      const constants = projectData?.constants || []

      const characterList = file.characterList || []

      // 找一个有真实文字的字符（跳过 .notdef / space 等空字符）
      const meaningfulChar = characterList.find((ch: any) => {
        const text = ch?.character?.text
        return text && text.trim() !== '' && text !== '.notdef'
      })
      const sampleGlyph = glyphs[0]

      console.log('[FileHandler.exportProject] project summary:', {
        version: projectData?.version,
        file: {
          uuid: file.uuid,
          name: file.name,
          width: file.width,
          height: file.height,
          iconsCount: file.iconsCount,
          characterCount: characterList.length,
        },
        glyphCounts: {
          glyphs: glyphs.length,
          stroke_glyphs: strokeGlyphs.length,
          radical_glyphs: radicalGlyphs.length,
          comp_glyphs: compGlyphs.length,
        },
        constantsCount: constants.length,
        sampleCharacterText: meaningfulChar?.character?.text,
        sampleCharacterKeys: meaningfulChar ? Object.keys(meaningfulChar) : [],
        sampleGlyphKeys: sampleGlyph ? Object.keys(sampleGlyph) : [],
      })

      // 估算一个小样本 JSON 的长度，帮助判断整体规模
      const sampleData = {
        version: projectData?.version,
        file: {
          ...file,
          characterList: characterList.slice(0, 3),
        },
        glyphs: glyphs.slice(0, 3),
        stroke_glyphs: strokeGlyphs.slice(0, 3),
        radical_glyphs: radicalGlyphs.slice(0, 3),
        comp_glyphs: compGlyphs.slice(0, 3),
        constants: constants.slice(0, 10),
      }
      const sampleJson = JSON.stringify(sampleData)
      console.log('[FileHandler.exportProject] sample JSON length (3 chars / 3 glyphs):', sampleJson.length)
    } catch (e) {
      console.warn('[FileHandler.exportProject] logProjectDataSummary failed:', e)
    }
  }

  /**
   * 调试用：更细致地检查是否还残留 contour / preview / _o 等大字段
   * 只抽样前若干个字符和字形，避免再次触发性能问题
   */
  private logProjectDataDetails(projectData: any): void {
    try {
      const file = projectData?.file || {}
      const characterList = file.characterList || []
      const glyphs = projectData?.glyphs || []

      const checkComponents = (components: any[]) => {
        let hasContour = false
        let hasPreview = false
        let hasO = false

        for (const comp of components || []) {
          if (!comp || !comp.value) continue
          const v = comp.value
          if (v.contour !== undefined) hasContour = true
          if (v.preview !== undefined) hasPreview = true
          if (v.contour2 !== undefined) hasPreview = true
          if ('_o' in comp) hasO = true
          if (comp.type === 'glyph' && v.components) {
            const nested = checkComponents(v.components)
            hasContour = hasContour || nested.hasContour
            hasPreview = hasPreview || nested.hasPreview
            hasO = hasO || nested.hasO
          }
        }

        return { hasContour, hasPreview, hasO }
      }

      // 抽样前若干字符（优先找有文字内容的，例如“测”等）
      const charSampleSize = Math.min(20, characterList.length)
      let charHasContour = false
      let charHasPreview = false
      const charSamples: Array<{ text: string; keys: string[] }> = []
      for (let i = 0; i < charSampleSize; i++) {
        const ch = characterList[i]
        const text = ch?.character?.text
        if (text) {
          charSamples.push({
            text,
            keys: Object.keys(ch),
          })
        }
        if (!ch?.components) continue
        const res = checkComponents(ch.components)
        charHasContour = charHasContour || res.hasContour
        charHasPreview = charHasPreview || res.hasPreview
      }

      // 抽样前若干字形
      const glyphSampleSize = Math.min(20, glyphs.length)
      let glyphHasContour = false
      let glyphHasPreview = false
      let glyphHasO = false
      const glyphSamples: Array<{ name: string; keys: string[] }> = []
      for (let i = 0; i < glyphSampleSize; i++) {
        const g = glyphs[i]
        if (g?.name) {
          glyphSamples.push({
            name: g.name,
            keys: Object.keys(g),
          })
        }
        if (!g?.components) continue
        const res = checkComponents(g.components)
        glyphHasContour = glyphHasContour || res.hasContour
        glyphHasPreview = glyphHasPreview || res.hasPreview
        glyphHasO = glyphHasO || res.hasO
      }

      console.log('[FileHandler.exportProject] detail check:', {
        sampledCharacters: charSampleSize,
        sampledGlyphs: glyphSampleSize,
        characterSamples: charSamples.slice(0, 5),
        glyphSamples: glyphSamples.slice(0, 5),
        characterSampleHasContourField: charHasContour,
        characterSampleHasPreviewField: charHasPreview,
        glyphSampleHasContourField: glyphHasContour,
        glyphSampleHasPreviewField: glyphHasPreview,
        glyphSampleHasOField: glyphHasO,
      })
    } catch (e) {
      console.warn('[FileHandler.exportProject] logProjectDataDetails failed:', e)
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
