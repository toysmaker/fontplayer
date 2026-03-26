/**
 * 导出 TrueType + gvar 可变字体（对齐原版 exportHandlers.createVarFont）
 */

import * as R from 'ramda'
import type { IFile, ICharacterFileLite, IFontSettings, IConstant } from '@/core/types'
import type { IContours } from '@/core/font/types'
import { create, toArrayBuffer, type ICharacter } from '@/fontManager'
import { convertContoursToQuadratic } from '@/fontManager/utils/cubicToQuadratic'
import { setFixedCurvesExportMode } from '@/core/utils/fitCurve'
import {
  contoursForCharacterFile,
  loadCharacterLiteForExport,
  type ExportFontMessageApi,
} from '@/features/editor/services/ExportFontService'
import { isTauri } from '@/utils/env'

type ProjectStore = ReturnType<typeof import('@/stores/project').useProjectStore>

export interface VarFontAxis {
  uuid: string
  name: string
  axisName?: string
  defaultValue: number
  minValue: number
  maxValue: number
  axisTag: string
  tag?: string
}

/** peakTuple 组合（不含全零默认主控）；与原版 generateAllAxisCombinations 一致 */
export function generateAllAxisCombinations(axisCount: number): Array<{ tuple: number[]; overlapRemovedContours: unknown }> {
  if (axisCount === 0) return []

  const combinations: Array<{ tuple: number[]; overlapRemovedContours: unknown }> = []

  if (axisCount === 1) {
    combinations.push({ tuple: [-1.0], overlapRemovedContours: null })
    combinations.push({ tuple: [1.0], overlapRemovedContours: null })
    return combinations
  }

  const totalCombinations = Math.pow(3, axisCount)
  for (let i = 1; i < totalCombinations; i++) {
    const tuple: number[] = []
    let tempI = i
    for (let j = 0; j < axisCount; j++) {
      const digit = tempI % 3
      tempI = Math.floor(tempI / 3)
      tuple.push(digit === 0 ? -1.0 : digit === 1 ? 0.0 : 1.0)
    }
    if (tuple.every((v) => v === 0.0)) continue
    combinations.push({ tuple, overlapRemovedContours: null })
  }
  return combinations
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
    : {
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
      }
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

function normalizedAxisValue(axis: VarFontAxis, normalized: number): number {
  if (normalized >= 0) {
    return axis.defaultValue + (axis.maxValue - axis.defaultValue) * normalized
  }
  return axis.defaultValue + (axis.defaultValue - axis.minValue) * normalized
}

async function getVarFontContourRows(
  file: IFile,
  fs: IFontSettings,
  removeOverlap: boolean,
  containSpace: boolean,
  editingUUID: string,
  editing: ICharacterFileLite | null,
  onAfterChar?: () => void
): Promise<Array<{ unicode: number; contours: IContours }>> {
  const list = file.characterList
  const out: Array<{ unicode: number; contours: IContours }> = []

  if (!containSpace) {
    out.push({ unicode: 0x20, contours: [[]] })
  }

  for (let i = 0; i < list.length; i++) {
    const meta = list[i]
    const ch = await loadCharacterLiteForExport(file, meta.uuid, editingUUID, editing)
    let contours: IContours = [[]]
    if (ch) {
      contours = contoursForCharacterFile(ch, file, fs, removeOverlap)
    }
    out.push({
      unicode: parseInt(meta.character.unicode.replace(/^U\+/i, ''), 16),
      contours,
    })
    onAfterChar?.()
    if (i % 50 === 0) {
      await new Promise((r) => requestAnimationFrame(r))
    }
  }

  out.sort((a, b) => a.unicode - b.unicode)
  return out
}

function axisToCreateShape(a: VarFontAxis): VarFontAxis & { tag: string } {
  return {
    ...a,
    tag: a.tag || a.axisTag,
    name: a.name || a.axisName || '',
  }
}

/**
 * 构建可变字库 ArrayBuffer（ glyf + gvar ）；不负责写盘。
 */
export async function buildExportVarFontBuffer(
  file: IFile,
  ctx: {
    axes: VarFontAxis[]
    instances?: unknown[]
    editingCharacterUUID: string
    editingCharacter: ICharacterFileLite | null
    removeOverlap: boolean
    projectStore: ProjectStore
  }
): Promise<ArrayBuffer> {
  const { axes, instances = [], editingCharacterUUID, editingCharacter, removeOverlap, projectStore } = ctx
  const fs = resolveFontSettings(file)
  const { unitsPerEm, ascender, descender } = fs
  const _width = file.width
  const _height = file.height
  const list = file.characterList

  const originConstants: IConstant[] = R.clone(file.constants || [])
  const cm = projectStore.constantsMap
  const constantsLive = file.constants
  if (!constantsLive) {
    throw new Error('export var font: file.constants missing')
  }

  const axesForCreate = axes.map(axisToCreateShape)

  setFixedCurvesExportMode(true)

  try {
    const combinations = generateAllAxisCombinations(axes.length)
    const n = list.length
    projectStore.loadingTotal = Math.max(1, n * 3 + combinations.length * n)
    projectStore.loadingProgress = 0
    const bump = () => {
      projectStore.loadingProgress = Math.min(projectStore.loadingProgress + 1, projectStore.loadingTotal)
    }

    // ----- 基础字集（默认主控轮廓） -----
    const fontCharacters: ICharacter[] = []
    let notdefMeta: (typeof list)[0] | null = null
    for (const meta of list) {
      if (meta.character.text === '.notdef') {
        notdefMeta = meta
        break
      }
    }

    if (notdefMeta) {
      const ch = await loadCharacterLiteForExport(file, notdefMeta.uuid, editingCharacterUUID, editingCharacter)
      let contours: IContours = [[]]
      if (ch) {
        contours = contoursForCharacterFile(ch, file, fs, removeOverlap)
      }
      const ndMetrics = ch?.info?.metrics
      fontCharacters.push({
        unicode: 0,
        name: '.notdef',
        contours: contours as ICharacter['contours'],
        contourNum: contours.length,
        advanceWidth: ndMetrics?.advanceWidth ?? Math.max(_width, _height),
        leftSideBearing: ndMetrics?.lsb ?? 0,
      })
    } else {
      fontCharacters.push({
        unicode: 0,
        name: '.notdef',
        contours: [[]],
        contourNum: 0,
        advanceWidth: Math.max(_width, _height),
        leftSideBearing: 0,
      })
    }

    let containSpace = false
    for (let i = 0; i < list.length; i++) {
      bump()
      const meta = list[i]
      if (meta.character.text === '.notdef') continue

      const ch = await loadCharacterLiteForExport(file, meta.uuid, editingCharacterUUID, editingCharacter)
      let contours: IContours = [[]]
      if (ch) {
        contours = contoursForCharacterFile(ch, file, fs, removeOverlap)
      }
      const { text, unicode } = meta.character
      const uc = parseInt(unicode.replace(/^U\+/i, ''), 16)
      fontCharacters.push({
        name: text,
        unicode: uc,
        advanceWidth: ch?.info?.metrics?.advanceWidth ?? unitsPerEm,
        leftSideBearing: ch?.info?.metrics?.lsb,
        contours: contours as ICharacter['contours'],
        contourNum: contours.length,
      })
      if (text === ' ') containSpace = true

      if (i % 50 === 0) await new Promise((r) => requestAnimationFrame(r))
    }

    if (!containSpace) {
      fontCharacters.push({
        name: ' ',
        unicode: 0x20,
        advanceWidth: unitsPerEm,
        leftSideBearing: 0,
        contours: [[]],
        contourNum: 0,
      })
    }

    fontCharacters.sort((a, b) => a.unicode - b.unicode)

    // ----- 主控对齐：轴常量设为 defaultValue 并重算默认字形 -----
    for (const axis of axesForCreate) {
      const c = constantsLive.find((x) => x.uuid === axis.uuid)
      if (c) c.value = axis.defaultValue
    }
    cm?.update(constantsLive)

    const defaultRows = await getVarFontContourRows(
      file,
      fs,
      removeOverlap,
      containSpace,
      editingCharacterUUID,
      editingCharacter,
      bump
    )
    for (const row of defaultRows) {
      const idx = fontCharacters.findIndex((fc) => fc.unicode === row.unicode)
      if (idx !== -1 && fontCharacters[idx].unicode !== 0 && fontCharacters[idx].unicode !== 0x20) {
        fontCharacters[idx].contours = row.contours as ICharacter['contours']
        fontCharacters[idx].contourNum = row.contours.length
      }
    }

    // ----- 各 tuple 变体 -----
    for (let ci = 0; ci < combinations.length; ci++) {
      const combination = combinations[ci] as {
        tuple: number[]
        overlapRemovedContours: unknown
      }
      const tuple = combination.tuple

      for (let j = 0; j < tuple.length; j++) {
        const axis = axesForCreate[j]
        const value = normalizedAxisValue(axis, tuple[j])
        const c = constantsLive.find((x) => x.uuid === axis.uuid)
        if (c) c.value = value
      }
      cm?.update(constantsLive)

      const rawContours = await getVarFontContourRows(
        file,
        fs,
        removeOverlap,
        containSpace,
        editingCharacterUUID,
        editingCharacter,
        bump
      )

      combination.overlapRemovedContours = rawContours.map((char) => ({
        ...char,
        contours: convertContoursToQuadratic(char.contours, 0.5),
      })) as unknown
    }

    // 恢复常量（与原版一致：create 前关闭 fixed curves）
    projectStore.updateFile(file.uuid, { constants: R.clone(originConstants) })
    cm?.update(file.constants || [])

    setFixedCurvesExportMode(false)

    const font = await create(fontCharacters, {
      familyName: file.name,
      styleName: 'Regular',
      unitsPerEm,
      ascender,
      descender,
      variants: {
        axes: axesForCreate,
        instances,
        combinations,
      },
      tables: file.fontSettings?.tables ?? null,
    })

    return toArrayBuffer(font) as ArrayBuffer
  } catch (e) {
    setFixedCurvesExportMode(false)
    projectStore.updateFile(file.uuid, { constants: R.clone(originConstants) })
    cm?.update(file.constants || [])
    throw e
  } finally {
    setFixedCurvesExportMode(false)
  }
}

export async function exportVariableFontLibrary(params: {
  file: IFile
  axes: VarFontAxis[]
  removeOverlap: boolean
  editingCharacterUUID: string
  editingCharacter: ICharacterFileLite | null
  message: ExportFontMessageApi
  t: (k: string) => string
  projectStore: ProjectStore
}): Promise<boolean> {
  const {
    file,
    axes,
    removeOverlap,
    editingCharacterUUID,
    editingCharacter,
    message,
    t,
    projectStore,
  } = params
  const instances = (file.variants as { instances?: unknown[] } | undefined)?.instances ?? []
  const defaultFileName = `${file.name}.otf`

  projectStore.loading = true
  projectStore.loadingProgress = 0
  projectStore.loadingTotal = 1
  projectStore.loadingMessage = t('dialogs.exportVarFontDialog.exportingProgress')

  try {
    const buffer = await buildExportVarFontBuffer(file, {
      axes,
      instances: instances as unknown[],
      removeOverlap,
      editingCharacterUUID,
      editingCharacter,
      projectStore,
    })

    projectStore.loadingMessage = t('dialogs.exportVarFontDialog.generating')

    if (isTauri()) {
      const filePath = await resolveTauriSavePath(defaultFileName)
      if (!filePath) {
        message.warning(t('dialogs.exportVarFontDialog.cancelled'))
        return false
      }
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      await writeFile(filePath, new Uint8Array(buffer))
    } else {
      downloadBuffer(buffer, defaultFileName)
    }

    message.success(t('dialogs.exportVarFontDialog.exportSuccess'))
    return true
  } catch (e) {
    console.error('export variable font failed', e)
    message.error(t('dialogs.exportVarFontDialog.exportFailed'))
    return false
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }
}
