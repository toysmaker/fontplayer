import * as R from 'ramda'
import type { IFile, ICharacterFileLite, IFontSettings, IPenComponent } from '@/core/types'
import type { IContours, IContour } from '@/core/font/types'
import { ContourConverter } from '@/core/font/converter'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { create, toArrayBuffer, type ICharacter } from '@/fontManager'
import { removeOverlapFromContours, pathToEditingPenComponents } from '@/features/editor/services/RemoveOverlapService'
import { isTauri } from '@/utils/env'

type ProjectStore = ReturnType<typeof import('@/stores/project').useProjectStore>

export type ExportFontContourStorage = 'glyf' | 'cff'

export interface ExportFontBuildOptions {
  contourStorage: ExportFontContourStorage
  removeOverlap: boolean
}

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

function normalizeContours(contours: IContours): IContours {
  if (!contours || contours.length === 0) return [[]]
  return contours
}

function applyRemoveOverlap(contours: IContours): IContours {
  const nonEmpty = contours.filter((c) => c && c.length > 0)
  if (nonEmpty.length === 0) return normalizeContours(contours)

  const result = removeOverlapFromContours(nonEmpty)
  if (!result) return normalizeContours(contours)

  const { path, pathsToRemove } = result
  try {
    const pens = pathToEditingPenComponents(path)
    const out: IContours = []
    for (const p of pens) {
      const c = (p.value as IPenComponent).contour as IContour | undefined
      if (c?.length) out.push(c)
    }
    return out.length > 0 ? out : normalizeContours(contours)
  } finally {
    pathsToRemove.forEach((p) => p.remove())
    path.remove()
  }
}

export function contoursForCharacterFile(
  char: ICharacterFileLite,
  file: IFile,
  fs: IFontSettings,
  removeOverlap: boolean
): IContours {
  const components = ContourConverter.getComponentsForCharacter(char)
  const solidFlags: boolean[] = []
  let contours = ContourConverter.componentsToContours(
    components,
    {
      unitsPerEm: fs.unitsPerEm,
      descender: fs.descender,
      advanceWidth: fs.unitsPerEm,
      preview: false,
      forceUpdate: true,
    },
    { x: 0, y: 0 },
    solidFlags
  )

  if (removeOverlap) {
    contours = applyRemoveOverlap(contours)
  } else {
    contours = normalizeContours(contours)
  }
  return contours
}

/** 导出/可变字体：从 IDB 或当前编辑态加载字符 lite（供 ExportVarFontService 复用） */
export async function loadCharacterLiteForExport(
  file: IFile,
  metaUuid: string,
  editingUUID: string,
  editing: ICharacterFileLite | null
): Promise<ICharacterFileLite | null> {
  if (editingUUID === metaUuid && editing) {
    return R.clone(editing) as ICharacterFileLite
  }
  return characterDataManager.loadCharacter(file.uuid, metaUuid)
}

export type ExportFontMessageApi = { success: (s: string) => void; error: (s: string) => void; warning: (s: string) => void }

/**
 * 构建 OTF 二进制；不负责写盘。
 */
export async function buildExportFontBuffer(
  file: IFile,
  ctx: {
    editingCharacterUUID: string
    editingCharacter: ICharacterFileLite | null
    onProgress?: (done: number, total: number) => void
    onGenerating?: () => void
  },
  options: ExportFontBuildOptions
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
    if (ch) {
      contours = contoursForCharacterFile(ch, file, fs, options.removeOverlap)
    }
    const ndMetrics = ch?.info?.metrics
    fontChars.push({
      unicode: 0,
      name: '.notdef',
      contours: contours as ICharacter['contours'],
      contourNum: contours.length,
      advanceWidth: ndMetrics?.advanceWidth ?? Math.max(file.width, file.height),
      leftSideBearing: ndMetrics?.lsb ?? 0,
    })
  } else {
    fontChars.push({
      unicode: 0,
      name: '.notdef',
      contours: [[]],
      contourNum: 0,
      advanceWidth: Math.max(file.width, file.height),
      leftSideBearing: 0,
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

    const contours = contoursForCharacterFile(ch, file, fs, options.removeOverlap)
    const { text, unicode } = meta.character
    const uc = parseInt(unicode, 16)

    fontChars.push({
      name: text,
      unicode: uc,
      advanceWidth: ch.info?.metrics?.advanceWidth ?? unitsPerEm,
      leftSideBearing: ch.info?.metrics?.lsb,
      contours: contours as ICharacter['contours'],
      contourNum: contours.length,
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
    contourStorage: options.contourStorage,
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

export async function exportFontLibrary(params: {
  file: IFile
  editingCharacterUUID: string
  editingCharacter: ICharacterFileLite | null
  options: ExportFontBuildOptions
  message: ExportFontMessageApi
  t: (k: string) => string
  projectStore: ProjectStore
}): Promise<boolean> {
  const { file, editingCharacterUUID, editingCharacter, options, message, t, projectStore } = params
  const defaultFileName = `${file.name}.otf`

  projectStore.loading = true
  projectStore.loadingTotal = file.characterList.length
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = t('dialogs.exportFontDialog.exportingProgress')

  try {
    const buffer = await buildExportFontBuffer(
      file,
      {
        editingCharacterUUID,
        editingCharacter,
        onProgress: (done, total) => {
          projectStore.loadingProgress = done
          projectStore.loadingTotal = total
        },
        onGenerating: () => {
          projectStore.loadingMessage = t('dialogs.exportFontDialog.generating')
        },
      },
      options
    )

    if (isTauri()) {
      const filePath = await resolveTauriSavePath(defaultFileName)
      if (!filePath) {
        message.warning(t('dialogs.exportFontDialog.cancelled'))
        return false
      }
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      await writeFile(filePath, new Uint8Array(buffer))
    } else {
      downloadBuffer(buffer, defaultFileName)
    }

    message.success(t('dialogs.exportFontDialog.exportSuccess'))
    return true
  } catch (e) {
    console.error('export font failed', e)
    message.error(t('dialogs.exportFontDialog.exportFailed'))
    return false
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }
}

/** Tauri 原生菜单：默认 cff、不去重叠，直接弹出保存路径后导出 */
export async function exportFontLibraryNativeDefaults(params: {
  file: IFile
  editingCharacterUUID: string
  editingCharacter: ICharacterFileLite | null
  message: ExportFontMessageApi
  t: (k: string) => string
  projectStore: ProjectStore
}): Promise<boolean> {
  return exportFontLibrary({
    ...params,
    options: { contourStorage: 'cff', removeOverlap: false },
  })
}
