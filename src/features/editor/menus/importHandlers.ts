import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import type { IConstant, ICustomGlyph } from '@/core/types'
import { EditStatus } from '@/core/types'
import { isTauri } from '@/utils/env'
import { GlyphImportExportService } from '@/features/editor/services/GlyphImportExportService'

function readJsonFileWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    input.onchange = async () => {
      try {
        const f = input.files?.[0]
        if (!f) {
          resolve(null)
          return
        }
        resolve(await f.text())
      } catch {
        resolve(null)
      } finally {
        if (input.parentNode) input.parentNode.removeChild(input)
      }
    }
    document.body.appendChild(input)
    input.click()
  })
}

async function readGlyphJsonTauri(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const picked = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (picked == null) return null
  const filePath =
    typeof picked === 'string'
      ? picked
      : Array.isArray(picked)
        ? picked[0] ?? null
        : (picked as { path?: string }).path ?? null
  if (!filePath) return null
  return readTextFile(filePath)
}

export function createImportHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, editorStore, glyphStore, message, dialog, t } = ctx

  const runImportFromText = async (text: string) => {
    const file = projectStore.selectedFile
    if (!file) {
      message.warning(t('dialogs.glyphImportExport.needProject'))
      return
    }

    let parsed
    try {
      parsed = GlyphImportExportService.parseImportedJson(text)
    } catch (e) {
      console.error(e)
      message.error(t('dialogs.glyphImportExport.importInvalid'))
      return
    }

    const bucket = GlyphImportExportService.resolveImportBucket(
      editorStore.editStatus,
      glyphStore.glyphCategory,
    )

    if (!file[bucket]) {
      ;(file as Record<string, unknown>)[bucket] = []
    }
    const targetList = file[bucket] as ICustomGlyph[]
    const existing = GlyphImportExportService.collectAllGlyphUuids(file)

    if (parsed.constants?.length) {
      if (!file.constants) file.constants = []
      for (const c of parsed.constants as IConstant[]) {
        if (!c?.uuid) continue
        const dup = file.constants.some((ex) => ex.uuid === c.uuid)
        if (!dup) file.constants.push(c)
      }
    }

    if (parsed.constantGlyphMap && typeof parsed.constantGlyphMap === 'object') {
      if (!file.constantGlyphMap) file.constantGlyphMap = {}
      for (const [k, v] of Object.entries(parsed.constantGlyphMap)) {
        file.constantGlyphMap[k] = String(v ?? '')
      }
    }

    let repeatMark = false
    for (const plain of parsed.glyphs) {
      let glyph: ICustomGlyph
      try {
        glyph = GlyphImportExportService.hydrateGlyphFromPlain(plain)
      } catch (e) {
        console.warn('[importGlyphs] skip invalid glyph', e)
        continue
      }
      if (!glyph.uuid) continue
      if (existing.has(glyph.uuid)) {
        repeatMark = true
        continue
      }
      existing.add(glyph.uuid)
      targetList.push(glyph)
    }

    glyphStore.glyphCategory = bucket
    projectStore.markFileUnsaved(file.uuid)
    glyphStore.glyphListVersion++

    if (repeatMark) {
      dialog.warning({
        title: t('dialogs.glyphImportExport.duplicateTitle'),
        content: t('dialogs.glyphImportExport.duplicateBody'),
        positiveText: t('dialogs.glyphImportExport.duplicateConfirm'),
      })
    } else {
      message.success(t('dialogs.glyphImportExport.importSuccess'))
    }
  }

  const handleImportGlyphs = async () => {
    if (!projectStore.selectedFile) {
      message.warning(t('dialogs.glyphImportExport.needProject'))
      return
    }

    if (editorStore.editStatus === EditStatus.CharacterList) {
      dialog.warning({
        title: t('dialogs.glyphImportExport.importBlockedTitle'),
        content: t('dialogs.glyphImportExport.importBlockedBody'),
        positiveText: t('dialogs.glyphImportExport.importBlockedConfirm'),
      })
      return
    }

    let text: string | null = null
    try {
      if (isTauri()) {
        text = await readGlyphJsonTauri()
      } else {
        text = await readJsonFileWeb()
      }
    } catch (e) {
      console.error('import glyphs pick/read failed', e)
      message.error(t('dialogs.glyphImportExport.importInvalid'))
      return
    }

    if (text == null || text === '') return
    await runImportFromText(text)
  }

  const handleImportFont = () => {
    console.log('Import font')
  }

  const handleImportPic = () => {
    console.log('Import picture')
  }

  const handleImportSvg = () => {
    if (!ctx.projectStore.selectedFile) {
      ctx.message.warning('请先打开工程')
      return
    }
    ctx.ImportExportSvgService.importSvg()
      .then(() => {
        ctx.message.success('SVG 导入成功')
      })
      .catch((err) => {
        console.error('Import SVG failed:', err)
        ctx.message.error('SVG 导入失败')
      })
  }

  return {
    'import-font-file': handleImportFont,
    'import-glyphs': handleImportGlyphs,
    'import-pic': handleImportPic,
    'import-svg': handleImportSvg,
  }
}
