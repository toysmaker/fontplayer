import { parseStrToSvg, parseSvgToComponents, componentsToSvg, type GetGlyphInstanceComponents } from '@/features/svg'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import type { IComponent, ICustomGlyph } from '@/core/types'
import { EditStatus } from '@/core/types'
import { isTauri } from '@/utils/env'
import { saveAs } from 'file-saver'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'

function getCurrentComponentsAndMeta(): {
  components: IComponent[]
  width: number
  height: number
  filename: string
} | null {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const characterStore = useCharacterStore()
  const glyphStore = useGlyphStore()

  const file = projectStore.selectedFile
  if (!file) return null

  const status = editorStore.editStatus

  if (status === EditStatus.Edit) {
    const components = characterStore.orderedListWithItemsForCurrentCharacterFile as IComponent[]
    if (!components || components.length === 0) return null
    const name = characterStore.editingCharacter?.character.text || 'untitled'
    return {
      components,
      width: file.width,
      height: file.height,
      filename: name,
    }
  }

  if (status === EditStatus.Glyph) {
    const editingGlyph = glyphStore.editingGlyph
    const baseList = (glyphStore.orderedListWithItemsForCurrentGlyph || []) as unknown as IComponent[]
    // 合并数据组件与脚本执行产生的 _components（glyph-pen, glyph-polygon 等）
    let components = [...baseList]
    if (editingGlyph && (instanceManager.isEditing(glyphStore.editingGlyphUUID) || instanceManager.isTemporary(glyphStore.editingGlyphUUID))) {
      const instance = instanceManager.getInstance(
        glyphStore.editingGlyphUUID,
        () => new CustomGlyph(editingGlyph),
        'glyph'
      ) as CustomGlyph | null
      if (instance?._components?.length) {
        components = [...baseList, ...instance._components]
      }
    }
    if (components.length === 0) return null
    const name = editingGlyph?.name || 'untitled'
    return {
      components,
      width: file.width,
      height: file.height,
      filename: name,
    }
  }

  return null
}

/** 用于导出时解析嵌套字形实例并返回其脚本生成的 _components。instanceKey 与画布一致（component.uuid）。 */
function createGetGlyphInstanceComponents(): GetGlyphInstanceComponents {
  return (instanceKey: string, glyphData) => {
    const glyph = glyphData as ICustomGlyph
    executeGlyphScript(glyph, instanceKey)
    const instance = instanceManager.acquireTemporaryInstance(
      instanceKey,
      () => new CustomGlyph(glyph),
      'glyph'
    ) as CustomGlyph | null
    return (instance?._components ?? []) as unknown[]
  }
}

async function dataUrlToUint8Array(dataUrl: string): Promise<Uint8Array> {
  const base64 = dataUrl.split(',')[1] || ''
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

export class ImportExportSvgService {
  // ======== 导入 SVG ========

  static async importSvg(): Promise<void> {
    if (isTauri()) {
      return this.importSvgTauri()
    }
    return this.importSvgWeb()
  }

  private static async applyComponents(components: IComponent[]) {
    const projectStore = useProjectStore()
    const characterStore = useCharacterStore()
    const file = projectStore.selectedFile
    if (!file) return
    for (const comp of components) {
      characterStore.addComponent(comp)
    }
    projectStore.markFileUnsaved(file.uuid)
  }

  private static async importSvgWeb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.svg'
      input.style.display = 'none'

      input.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLInputElement
        const files = target.files
        if (!files || files.length === 0) {
          document.body.removeChild(input)
          reject(new Error('No file selected'))
          return
        }

        try {
          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const text = await file.text()
            const doc = parseStrToSvg(text)
            const root = doc.documentElement as HTMLElement
            const components = parseSvgToComponents(root)
            await this.applyComponents(components)
          }
          document.body.removeChild(input)
          resolve()
        } catch (err) {
          document.body.removeChild(input)
          reject(err)
        }
      })

      input.addEventListener('cancel', () => {
        document.body.removeChild(input)
        reject(new Error('File selection cancelled'))
      })

      document.body.appendChild(input)
      input.click()
    })
  }

  private static async importSvgTauri(): Promise<void> {
    if (!isTauri()) return

    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')

    const file = await open({
      filters: [{ name: 'SVG', extensions: ['svg'] }],
      multiple: false,
    })
    if (!file) return

    const filePath = typeof file === 'string' ? file : (file as any).path || file
    if (!filePath) return

    const text = await readTextFile(filePath)
    const doc = parseStrToSvg(text)
    const root = doc.documentElement as HTMLElement
    const components = parseSvgToComponents(root)
    await this.applyComponents(components)
  }

  // ======== 导出 SVG ========

  static async exportCurrentToSvg(): Promise<void> {
    const meta = getCurrentComponentsAndMeta()
    if (!meta) return

    const { components, width, height, filename } = meta
    const svgStr = componentsToSvg(components, width, height, 'default', {
      getGlyphInstanceComponents: createGetGlyphInstanceComponents(),
    })

    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const filePath = await save({
        defaultPath: `${filename}.svg`,
        filters: [{ name: 'SVG', extensions: ['svg'] }],
      })
      if (!filePath) return
      await writeTextFile(filePath, svgStr)
      return
    }

    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    saveAs(blob, `${filename}.svg`)
  }

  // ======== 导出 PNG / JPEG（通过中间 SVG 渲染） ========

  private static async exportRaster(format: 'png' | 'jpeg'): Promise<void> {
    const meta = getCurrentComponentsAndMeta()
    if (!meta) return
    const { components, width, height, filename } = meta

    const svgStr = componentsToSvg(components, width, height, 'default', {
      getGlyphInstanceComponents: createGetGlyphInstanceComponents(),
    })
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' })
    const svgUrl = URL.createObjectURL(svgBlob)

    try {
      const img = new Image()
      const dataUrl: string = await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas context is null'))
            return
          }
          // 对 JPEG 填充白色背景，避免背景为黑色；PNG 保持透明
          ctx.clearRect(0, 0, width, height)
          if (format === 'jpeg') {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
          }
          ctx.drawImage(img, 0, 0, width, height)
          const url = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg')
          resolve(url)
        }
        img.onerror = (err) => reject(err)
        img.src = svgUrl
      })

      const ext = format === 'png' ? 'png' : 'jpg'

      if (isTauri()) {
        const bytes = await dataUrlToUint8Array(dataUrl)
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')
        const filePath = await save({
          defaultPath: `${filename}.${ext}`,
          filters: [{ name: format.toUpperCase(), extensions: [ext] }],
        })
        if (!filePath) return
        await writeFile(filePath, bytes)
      } else {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        saveAs(blob, `${filename}.${ext}`)
      }
    } finally {
      URL.revokeObjectURL(svgUrl)
    }
  }

  static async exportCurrentToPng(): Promise<void> {
    return this.exportRaster('png')
  }

  static async exportCurrentToJpeg(): Promise<void> {
    return this.exportRaster('jpeg')
  }
}

