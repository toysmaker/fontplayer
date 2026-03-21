/**
 * 导出 COLR/CPAL 彩色字体（对齐原版 createColorFont + generateLayers）
 */

import type { IFile, ICharacterFileLite, IFontSettings, IComponent } from '@/core/types'
import type { IContours } from '@/core/font/types'
import { ContourConverter } from '@/core/font/converter'
import { create, toArrayBuffer, type ICharacter } from '@/fontManager'
import {
  contoursForCharacterFile,
  loadCharacterLiteForExport,
  type ExportFontMessageApi,
} from '@/features/editor/services/ExportFontService'
import { isTauri } from '@/utils/env'

type ProjectStore = ReturnType<typeof import('@/stores/project').useProjectStore>

function defaultFontSettings(): IFontSettings {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
  }
}

function resolveFontSettings(file: IFile): IFontSettings {
  return file.fontSettings
    ? {
        unitsPerEm: file.fontSettings.unitsPerEm ?? 1000,
        ascender: file.fontSettings.ascender ?? 800,
        descender: file.fontSettings.descender ?? -200,
        advanceWidth: file.fontSettings.advanceWidth,
        tables: file.fontSettings.tables,
      }
    : defaultFontSettings()
}

/** 与原版一致：任意组件存在分色 fillColor（value 或组件自身）则视为彩色分层字 */
export function characterUsesColorLayers(char: ICharacterFileLite): boolean {
  const components = ContourConverter.getComponentsForCharacter(char)
  return components.some((c) => {
    const v = c.value as { fillColor?: string } | undefined
    const onValue = !!(v && v.fillColor)
    const onComp = !!(c as { fillColor?: string }).fillColor
    return onValue || onComp
  })
}

function generateColorFontLayers(
  char: ICharacterFileLite,
  fs: IFontSettings
): NonNullable<ICharacter['layers']> {
  const components = ContourConverter.getComponentsForCharacter(char)
  const layers: NonNullable<ICharacter['layers']> = []
  const opts = {
    unitsPerEm: fs.unitsPerEm,
    descender: fs.descender,
    advanceWidth: fs.unitsPerEm,
    preview: false,
    forceUpdate: false,
  }
  for (const component of components) {
    const contours = ContourConverter.componentsToContours(
      [component] as IComponent[],
      opts,
      { x: 0, y: 0 }
    )
    const componentFillColor =
      (component as { fillColor?: string }).fillColor ||
      (component.value as { fillColor?: string } | undefined)?.fillColor
    const fillColor = componentFillColor || 'rgba(0, 0, 0, 1)'
    layers.push({
      fillColor,
      contours: contours as ICharacter['contours'],
      contourNum: contours.length,
    })
  }
  return layers
}

export async function buildExportColorFontBuffer(
  file: IFile,
  ctx: {
    editingCharacterUUID: string
    editingCharacter: ICharacterFileLite | null
    onProgress?: (done: number, total: number) => void
    onGenerating?: () => void
  },
  options: { removeOverlap: boolean }
): Promise<ArrayBuffer> {
  const fs = resolveFontSettings(file)
  const { unitsPerEm, ascender, descender } = fs
  const list = file.characterList
  const totalSteps = list.length
  let notdefMeta: (typeof list)[0] | null = null
  for (const meta of list) {
    if (meta.character.text === '.notdef') {
      notdefMeta = meta
      break
    }
  }

  const fontChars: ICharacter[] = []

  if (notdefMeta) {
    const ch = await loadCharacterLiteForExport(
      file,
      notdefMeta.uuid,
      ctx.editingCharacterUUID,
      ctx.editingCharacter
    )
    let contours: IContours = [[]]
    let layers: ICharacter['layers'] = []
    if (ch) {
      const usesColor = characterUsesColorLayers(ch)
      const effectiveRO = options.removeOverlap && !usesColor
      contours = contoursForCharacterFile(ch, file, fs, effectiveRO)
      layers = usesColor ? generateColorFontLayers(ch, fs) : []
    }
    const ndMetrics = ch?.info?.metrics
    fontChars.push({
      unicode: 0,
      name: '.notdef',
      contours: contours as ICharacter['contours'],
      contourNum: contours.length,
      advanceWidth: ndMetrics?.advanceWidth ?? Math.max(file.width, file.height),
      leftSideBearing: ndMetrics?.lsb ?? 0,
      layers,
    })
  } else {
    fontChars.push({
      unicode: 0,
      name: '.notdef',
      contours: [[]],
      contourNum: 0,
      advanceWidth: Math.max(file.width, file.height),
      leftSideBearing: 0,
      layers: [],
    })
  }

  let containSpace = false
  let idx = 0
  for (const meta of list) {
    ctx.onProgress?.(idx + 1, totalSteps)
    idx++

    if (meta.character.text === '.notdef') continue

    const ch = await loadCharacterLiteForExport(
      file,
      meta.uuid,
      ctx.editingCharacterUUID,
      ctx.editingCharacter
    )
    if (!ch) continue

    const usesColor = characterUsesColorLayers(ch)
    const effectiveRO = options.removeOverlap && !usesColor
    const contours = contoursForCharacterFile(ch, file, fs, effectiveRO)
    const layers = usesColor ? generateColorFontLayers(ch, fs) : []

    const { text, unicode } = meta.character
    const uc = parseInt(unicode, 16)

    fontChars.push({
      name: text,
      unicode: uc,
      advanceWidth: ch.info?.metrics?.advanceWidth ?? unitsPerEm,
      leftSideBearing: ch.info?.metrics?.lsb,
      contours: contours as ICharacter['contours'],
      contourNum: contours.length,
      layers,
    })

    if (text === ' ') containSpace = true
  }

  if (!containSpace) {
    fontChars.push({
      name: ' ',
      unicode: 0x20,
      advanceWidth: unitsPerEm,
      leftSideBearing: 0,
      contours: [[]],
      contourNum: 0,
      layers: [],
    })
  }

  fontChars.sort((a, b) => a.unicode - b.unicode)

  ctx.onGenerating?.()

  const font = await create(fontChars, {
    familyName: file.name,
    styleName: 'Regular',
    unitsPerEm,
    ascender,
    descender,
    tables: file.fontSettings?.tables ?? null,
    isColorFont: true,
    contourStorage: 'cff',
  })

  return toArrayBuffer(font) as ArrayBuffer
}

async function resolveTauriSavePath(defaultName: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'OpenType', extensions: ['otf'] }],
  })
  if (path == null) return null
  return typeof path === 'string' ? path : (path as { path: string }).path
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'font/otf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportColorFontLibrary(params: {
  file: IFile
  removeOverlap: boolean
  editingCharacterUUID: string
  editingCharacter: ICharacterFileLite | null
  message: ExportFontMessageApi
  t: (k: string) => string
  projectStore: ProjectStore
}): Promise<boolean> {
  const { file, removeOverlap, editingCharacterUUID, editingCharacter, message, t, projectStore } = params
  const defaultFileName = `${file.name}.otf`

  projectStore.loading = true
  projectStore.loadingTotal = file.characterList.length
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = t('dialogs.exportColorFontDialog.exportingProgress')

  try {
    const buffer = await buildExportColorFontBuffer(
      file,
      {
        editingCharacterUUID,
        editingCharacter,
        onProgress: (done, total) => {
          projectStore.loadingProgress = done
          projectStore.loadingTotal = total
        },
        onGenerating: () => {
          projectStore.loadingMessage = t('dialogs.exportColorFontDialog.generating')
        },
      },
      { removeOverlap }
    )

    if (isTauri()) {
      const filePath = await resolveTauriSavePath(defaultFileName)
      if (!filePath) {
        message.warning(t('dialogs.exportColorFontDialog.cancelled'))
        return false
      }
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      await writeFile(filePath, new Uint8Array(buffer))
    } else {
      downloadBuffer(buffer, defaultFileName)
    }

    message.success(t('dialogs.exportColorFontDialog.exportSuccess'))
    return true
  } catch (e) {
    console.error('export color font failed', e)
    message.error(t('dialogs.exportColorFontDialog.exportFailed'))
    return false
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }
}
