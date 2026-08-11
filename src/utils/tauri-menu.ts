/**
 * Tauri 原生菜单初始化
 * 仅在 Tauri 环境中使用
 */

import { isTauri } from '@/utils/env'

/**
 * 初始化 Tauri 原生菜单
 * 注意：在 Tauri 2.x 中，菜单在 Rust 端直接初始化
 * 前端只需要监听菜单事件即可
 */
export async function initTauriMenu() {
  if (!isTauri()) {
    console.warn('initTauriMenu: Not in Tauri environment')
    return
  }

  try {
    // 同步菜单语言（确保菜单语言与前端 i18n 一致）
    const { invoke } = await import('@tauri-apps/api/core')
    const { i18n } = await import('@/i18n')
    // 访问 i18n 的 locale，vue-i18n 的 locale 是一个 Ref<string>
    const localeRef = i18n.global.locale
    const currentLocale = typeof localeRef === 'string' ? localeRef : (localeRef as { value: string }).value || 'zh'
    await invoke('update_menu_language', { language: currentLocale })
    
    // 监听菜单事件
    const { listen } = await import('@tauri-apps/api/event')
    
    // 监听文件菜单事件
    // 注意：这些事件名称需要与 Rust 端发送的事件名称匹配
    // 在 Tauri 2.x 中，菜单事件通过 app.emit() 发送
    listen('create-file', async () => {
      console.log('File -> New')
      try {
        const { useProjectStore } = await import('@/stores/project')
        const projectStore = useProjectStore()
        
        // 检查是否已有工程打开
        if (projectStore.hasFiles) {
          // 通过事件通知 UI 层显示警告消息
          window.dispatchEvent(new CustomEvent('show-warning-message', {
            detail: {
              message: '目前字玩仅支持同时编辑一个工程，请关闭当前工程再新建。注意，关闭工程前请保存工程以避免数据丢失。'
            }
          }))
          return
        }
        
        // 显示新建工程对话框
        // 注意：在 Tauri 环境中，需要通过事件或全局状态来触发对话框显示
        // 这里可以通过 window 对象或事件总线来通知 UI 显示对话框
        window.dispatchEvent(new CustomEvent('show-new-project-dialog'))
      } catch (error) {
        console.error('Failed to handle create-file event:', error)
      }
    })
    
    listen('open-file', async () => {
      console.log('File -> Open')
      try {
        const { useProjectStore } = await import('@/stores/project')
        const projectStore = useProjectStore()
        if (projectStore.hasFiles) {
          const { i18n } = await import('@/i18n')
          const t = i18n.global.t
          window.dispatchEvent(new CustomEvent('show-warning-message', {
            detail: { message: t('panels.editorSidebar.openProjectDisabled') }
          }))
          return
        }
        const { fileHandler } = await import('@/features/editor/menus/FileHandler')
        await fileHandler.openFile()
      } catch (error) {
        console.error('Failed to handle open-file event:', error)
      }
    })
    
    listen('save-file', async () => {
      console.log('File -> Save')
      try {
        const { fileHandler } = await import('@/features/editor/menus/FileHandler')
        await fileHandler.saveProjectTauriRememberPath()
      } catch (error) {
        console.error('Failed to handle save-file event:', error)
      }
    })
    
    listen('save-as', async () => {
      console.log('File -> Save As')
      try {
        const { fileHandler } = await import('@/features/editor/menus/FileHandler')
        await fileHandler.saveProjectTauriAs()
      } catch (error) {
        console.error('Failed to handle save-as event:', error)
      }
    })
    
    listen('export-font-file', () => {
      window.dispatchEvent(new CustomEvent('editor-export-font-native'))
    })

    listen('import-font-file', () => {
      window.dispatchEvent(new CustomEvent('editor-import-font-native'))
    })

    listen('export-var-font-file', () => {
      window.dispatchEvent(new CustomEvent('editor-export-var-font-native'))
    })

    listen('export-color-font', () => {
      window.dispatchEvent(new CustomEvent('editor-export-color-font-native'))
    })
    
    listen('export-svg', () => {
      console.log('File -> Export SVG')
      // TODO: 实现导出 SVG 逻辑
    })

    listen('export-metrics-ref', () => {
      window.dispatchEvent(new CustomEvent('editor-export-metrics-ref-native'))
    })

    listen('export-jpeg', () => {
      window.dispatchEvent(new CustomEvent('editor-export-jpeg-native'))
    })

    listen('export-png', () => {
      window.dispatchEvent(new CustomEvent('editor-export-png-native'))
    })
    
    // 监听编辑菜单事件
    listen('undo', () => {
      console.log('Edit -> Undo')
      // TODO: 实现撤销逻辑
    })
    
    listen('redo', () => {
      console.log('Edit -> Redo')
      // TODO: 实现重做逻辑
    })
    
    listen('cut', () => {
      window.dispatchEvent(new CustomEvent('editor-cut'))
    })
    
    listen('copy', () => {
      window.dispatchEvent(new CustomEvent('editor-copy'))
    })
    
    listen('paste', () => {
      window.dispatchEvent(new CustomEvent('editor-paste'))
    })
    
    listen('delete', () => {
      window.dispatchEvent(new CustomEvent('editor-delete'))
    })

    listen('remove_overlap', () => {
      window.dispatchEvent(new CustomEvent('editor-remove-overlap'))
    })

    listen('component-union', () => {
      window.dispatchEvent(new CustomEvent('editor-component-boolean', { detail: { operation: 'union' } }))
    })
    listen('component-intersect', () => {
      window.dispatchEvent(new CustomEvent('editor-component-boolean', { detail: { operation: 'intersect' } }))
    })
    listen('save-char-pngs', async () => {
      if (import.meta.env.DEV) console.warn('[tauri-menu] save-char-pngs event received!')
      try {
        const { useProjectStore } = await import('@/stores/project')
        const file = useProjectStore().selectedFile
        if (!file || !file.characterList?.length) { alert('当前工程没有字符'); return }

        // 通过事件弹出 Vue 对话框（和新建工程一样）
        const count: number = await new Promise((resolve) => {
          const handler = (e: Event) => {
            window.removeEventListener('save-char-pngs-count', handler)
            resolve((e as CustomEvent).detail || 0)
          }
          window.addEventListener('save-char-pngs-count', handler)
          window.dispatchEvent(new CustomEvent('show-save-char-pngs-dialog', {
            detail: { total: file!.characterList.length }
          }))
        })
        if (count <= 0) return

        const { open } = await import('@tauri-apps/plugin-dialog')
        const folderPath = await open({ directory: true, title: '选择导出文件夹' })
        if (!folderPath) return

        const { mkdir } = await import('@tauri-apps/plugin-fs')
        const exportDir = `${folderPath}/char_pngs`
        await mkdir(exportDir, { recursive: true })

        const { ContourConverter } = await import('@/core/font/converter')
        const { RenderEngine } = await import('@/core/font/renderer')
        const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
        const { executeCharacterScript } = await import('@/core/script/ScriptExecutor')
        const { writeFile } = await import('@tauri-apps/plugin-fs')

        const SIZE = 1000
        const fs = file.fontSettings || { unitsPerEm: 1000, descender: -200 }

        for (let i = 0; i < count; i++) {
          const meta = file.characterList[i]
          const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
          if (!ch) continue

          // 执行脚本重新生成组件
          try { executeCharacterScript(ch, ch.uuid) } catch {}

          const components = (ch.orderedList?.length
            ? ch.orderedList.map((o: any) => ch.components.find((c: any) => c.uuid === o.uuid)).filter(Boolean)
            : ch.components) || []

          // 用编辑坐标（canvas 坐标系，不做 OpenType 转换）
          const allContours = ContourConverter.componentsToContoursEditing(
            components,
            { x: 0, y: 0 }
          )

          const canvas = document.createElement('canvas')
          canvas.width = SIZE; canvas.height = SIZE
          RenderEngine.renderPreview(canvas, allContours, {
            fillColor: '#000',
            backgroundColor: 'rgba(0,0,0,0)',
            previewStyle: 'black',
            scale: 1, offset: { x: 0, y: 0 },
          })

          const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
          const arr = new Uint8Array(await blob.arrayBuffer())
          const name = ch.character?.text || meta.character?.text || ''
          if (!name || name === '.notdef') continue
          const safeName = name.replace(/[\/\\:*?"<>|]/g, '_')
          await writeFile(`${exportDir}/${safeName}.png`, arr)
        }
        alert(`已导出 ${count} 个字符 PNG 到 ${exportDir}`)
      } catch (err) {
        console.error('Save char PNGs failed:', err)
        alert('导出失败: ' + (err as Error).message)
      }
    })

    listen('component-subtract', () => {
      window.dispatchEvent(new CustomEvent('editor-component-boolean', { detail: { operation: 'subtract' } }))
    })

    listen('test-export-json', async () => {
      const { useProjectStore } = await import('@/stores/project')
      const file = useProjectStore().selectedFile
      if (!file) return
      const json = JSON.stringify(file, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${file.name || 'project'}.json`; a.click()
      URL.revokeObjectURL(url)
    })

    // 生成训练数据 v1
    listen('generate-training-data-v1', async () => {
      if (import.meta.env.DEV) console.log('[tauri-menu] generate-training-data-v1 triggered')
      try {
        const { generateTrainingDataV1 } = await import(
          '@/features/advancedEdit/scripts/trainingDataV1'
        )
        await generateTrainingDataV1()
      } catch (err) {
        console.error('generate-training-data-v1 failed:', err)
        alert('生成训练数据失败: ' + (err as Error).message)
      }
    })

    // 生成训练数据 v2（宋体/仿宋字重强制改为 50）
    listen('generate-training-data-v2', async () => {
      if (import.meta.env.DEV) console.log('[tauri-menu] generate-training-data-v2 triggered')
      try {
        const { generateTrainingDataV2 } = await import(
          '@/features/advancedEdit/scripts/trainingDataV2'
        )
        await generateTrainingDataV2()
      } catch (err) {
        console.error('generate-training-data-v2 failed:', err)
        alert('生成训练数据v2失败: ' + (err as Error).message)
      }
    })

    listen('export-stroke-pngs', async () => {
      try {
        const { useProjectStore } = await import('@/stores/project')
        const file = useProjectStore().selectedFile
        if (!file || !file.stroke_glyphs?.length) {
          alert('当前工程没有笔画字形')
          return
        }

        // 弹出文件夹选择对话框
        const { open } = await import('@tauri-apps/plugin-dialog')
        const folderPath = await open({ directory: true, title: '选择导出文件夹' })
        if (!folderPath) return

        const { mkdir } = await import('@tauri-apps/plugin-fs')

        // 创建子文件夹
        const exportDir = `${folderPath}/stroke_glyphs`
        await mkdir(exportDir, { recursive: true })

        // 渲染每个笔画到 canvas 并导出（1000x1000，透明背景）
        const { RenderEngine } = await import('@/core/font/renderer')
        const { ContourConverter } = await import('@/core/font/converter')
        const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
        const { instanceManager } = await import('@/core/instance')
        const { CustomGlyph } = await import('@/core/instance/CustomGlyph')
        const { writeFile } = await import('@tauri-apps/plugin-fs')

        const SIZE = 1000

        for (const glyph of file.stroke_glyphs) {
          // 创建离屏 canvas，1000x1000
          const canvas = document.createElement('canvas')
          canvas.width = SIZE
          canvas.height = SIZE
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          // 执行脚本生成组件
          const instance = instanceManager.acquireTemporaryInstance(
            glyph.uuid,
            () => new CustomGlyph(glyph),
            'glyph'
          ) as any
          try {
            executeGlyphScript(glyph, glyph.uuid, { ignoreTempDataGuard: true })
            const components = (instance as any).components || []
            // 直接用编辑坐标（不做 OpenType 转换），1000×1000 透明背景黑色填充
            const allContours = ContourConverter.componentsToContoursEditing(
              components,
              { x: 0, y: 0 }
            )

            RenderEngine.renderPreview(canvas, allContours, {
              fillColor: '#000',
              backgroundColor: 'rgba(0,0,0,0)',
              previewStyle: 'black',
              scale: 1,
              offset: { x: 0, y: 0 },
            })

            const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
            const arr = new Uint8Array(await blob.arrayBuffer())
            const pngPath = `${exportDir}/${glyph.name}.png`
            await writeFile(pngPath, arr)
          } finally {
            instanceManager.releaseTemporaryInstance(glyph.uuid)
          }
        }

        alert(`已导出 ${file.stroke_glyphs.length} 个笔画字形到 ${exportDir}`)
      } catch (err) {
        console.error('Export stroke PNGs failed:', err)
        alert('导出失败: ' + (err as Error).message)
      }
    })

    // 保存笔画训练数据：按风格标签分组，使用指定字重
    listen('save-stroke-training-data', async () => {
      if (import.meta.env.DEV) console.log('[tauri-menu] save-stroke-training-data triggered')
      try {
        const { useProjectStore } = await import('@/stores/project')
        const file = useProjectStore().selectedFile
        if (!file || !file.stroke_glyphs?.length) {
          alert('当前工程没有笔画字形')
          return
        }

        // 弹出字重输入对话框
        const weight: number = await new Promise((resolve) => {
          const handler = (e: Event) => {
            window.removeEventListener('stroke-training-data-weight', handler)
            resolve((e as CustomEvent).detail || 50)
          }
          window.addEventListener('stroke-training-data-weight', handler)
          window.dispatchEvent(new CustomEvent('show-stroke-training-data-dialog'))
        })
        if (weight <= 0) return

        // 选择输出根目录
        const { open } = await import('@tauri-apps/plugin-dialog')
        const rootPath = await open({ directory: true, title: '选择笔画训练数据输出根目录' })
        if (!rootPath) return

        const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
        const { RenderEngine } = await import('@/core/font/renderer')
        const { ContourConverter } = await import('@/core/font/converter')
        const { executeGlyphScript } = await import('@/core/script/ScriptExecutor')
        const { instanceManager } = await import('@/core/instance')
        const { CustomGlyph } = await import('@/core/instance/CustomGlyph')
        const { parameterRowsForGlyph } = await import('@/core/utils/glyph')

        // 按风格标签分组
        const styleGroups = new Map<string, typeof file.stroke_glyphs>()
        for (const glyph of file.stroke_glyphs) {
          const tag = glyph.style || '未分类'
          if (!styleGroups.has(tag)) styleGroups.set(tag, [])
          styleGroups.get(tag)!.push(glyph)
        }

        const SIZE = 1000
        let totalProcessed = 0
        const totalGlyphs = file.stroke_glyphs.length

        if (import.meta.env.DEV) {
          console.log('[save-stroke-training-data] style groups:', Array.from(styleGroups.keys()))
          console.log('[save-stroke-training-data] weight:', weight)
        }

        for (const [styleTag, glyphs] of styleGroups) {
          // 为每个风格标签创建子目录
          const safeTag = styleTag.replace(/[\/\\:*?"<>|]/g, '_')
          const styleDir = `${rootPath}/${safeTag}`
          await mkdir(styleDir, { recursive: true })

          for (const glyph of glyphs) {
            // 克隆字形，避免修改原数据
            const clonedGlyph = JSON.parse(JSON.stringify(glyph))

            // 强制设置字重
            const params = parameterRowsForGlyph(clonedGlyph)
            if (params) {
              const weightParam = params.find((p: any) => p.name === '字重')
              if (weightParam) {
                weightParam.value = weight
              }
            }

            // 释放旧实例（清除 tempData 缓存）
            instanceManager.releaseTemporaryInstance(clonedGlyph.uuid)

            const canvas = document.createElement('canvas')
            canvas.width = SIZE
            canvas.height = SIZE

            try {
              // 执行脚本（使用指定字重）
              executeGlyphScript(clonedGlyph, clonedGlyph.uuid)

              const inst = instanceManager.acquireTemporaryInstance(
                clonedGlyph.uuid,
                () => new CustomGlyph(clonedGlyph),
                'glyph',
              ) as any

              const components = inst?.components || clonedGlyph.components || []
              const allContours = ContourConverter.componentsToContoursEditing(
                components,
                { x: 0, y: 0 },
              )

              RenderEngine.renderPreview(canvas, allContours, {
                fillColor: '#000',
                backgroundColor: 'rgba(0,0,0,0)',
                previewStyle: 'black',
                scale: 1,
                offset: { x: 0, y: 0 },
              })

              const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
              const arr = new Uint8Array(await blob.arrayBuffer())
              await writeFile(`${styleDir}/${glyph.name}.png`, arr)
            } finally {
              // 及时释放实例，避免内存堆积
              instanceManager.releaseTemporaryInstance(clonedGlyph.uuid)
            }

            totalProcessed++
          }
        }

        alert(
          `笔画训练数据导出完成！\n` +
          `字重: ${weight}\n` +
          `共 ${totalProcessed} 个笔画字形\n` +
          `风格分组: ${styleGroups.size} 组\n` +
          `输出目录: ${rootPath}`,
        )
      } catch (err) {
        console.error('Save stroke training data failed:', err)
        alert('保存笔画训练数据失败: ' + (err as Error).message)
      }
    })

    listen('font-settings', () => {
      window.dispatchEvent(new CustomEvent('editor-font-settings'))
    })

    listen('preference-settings', () => {
      window.dispatchEvent(new CustomEvent('editor-preference-settings'))
    })

    listen('language-settings', () => {
      window.dispatchEvent(new CustomEvent('editor-language-settings'))
    })

    // 监听字符菜单事件
    listen('add-character', () => {
      console.log('Character -> Add Character')
      window.dispatchEvent(new CustomEvent('editor-add-character'))
    })

    listen('add-icon', () => {
      console.log('Character -> Add Icon')
      window.dispatchEvent(new CustomEvent('editor-add-icon'))
    })

    listen('import-glyphs', () => {
      window.dispatchEvent(new CustomEvent('editor-import-glyphs'))
    })

    listen('export-glyphs', () => {
      window.dispatchEvent(new CustomEvent('editor-export-glyphs'))
    })

    listen('import-pic', () => {
      window.dispatchEvent(new CustomEvent('editor-import-pic'))
    })

    // 模板菜单事件：Rust 端 emit 的为 template-2, template-3 等，转发为 editor-template
    const templateKeys = ['template-2', 'template-3', 'template-5', 'template-6', 'template-7', 'template-8', 'template-digits', 'template-letters', 'template-symbols', 'template-test']
    for (const key of templateKeys) {
      listen(key, () => {
        window.dispatchEvent(new CustomEvent('editor-template', { detail: { templateKey: key } }))
      })
    }
    
    console.log('Tauri menu event listeners initialized')
  } catch (error) {
    console.error('Failed to initialize Tauri menu listeners:', error)
  }
}
