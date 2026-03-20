import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import { EditStatus } from '@/core/types'
import { isTauri } from '@/utils/env'
import { GlyphImportExportService } from '@/features/editor/services/GlyphImportExportService'
import { useDialogsStore } from '@/stores/dialogs'

export function createExportHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, editorStore, message, dialog, t, ImportExportSvgService } = ctx

  const handleExportGlyphs = async () => {
    if (editorStore.editStatus === EditStatus.CharacterList) {
      dialog.warning({
        title: t('dialogs.glyphImportExport.exportBlockedTitle'),
        content: t('dialogs.glyphImportExport.exportBlockedBody'),
        positiveText: t('dialogs.glyphImportExport.exportBlockedConfirm'),
      })
      return
    }

    const file = projectStore.selectedFile
    if (!file) {
      message.warning(t('dialogs.glyphImportExport.needProject'))
      return
    }

    const payload = GlyphImportExportService.buildExportPayload(file, editorStore.editStatus)
    if (!payload) {
      message.warning(t('dialogs.glyphImportExport.needProject'))
      return
    }

    const info = GlyphImportExportService.getGlyphExportInfo(file, editorStore.editStatus)
    const defaultFileName = info?.defaultFileName ?? 'glyphs.json'
    const json = JSON.stringify(payload, null, 2)

    try {
      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const { writeTextFile } = await import('@tauri-apps/plugin-fs')
        const path = await save({
          defaultPath: defaultFileName,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (path == null) return
        const filePath = typeof path === 'string' ? path : (path as { path: string }).path
        if (!filePath) return
        await writeTextFile(filePath, json)
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultFileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      message.success(t('dialogs.glyphImportExport.exportSuccess'))
    } catch (e) {
      console.error('export glyphs failed', e)
      message.error(t('dialogs.glyphImportExport.exportFailed'))
    }
  }

  const handleExportFont = () => {
    if (!projectStore.selectedFile) {
      message.warning(t('dialogs.exportFontDialog.needProject'))
      return
    }
    useDialogsStore().openExportFontDialog()
  }

  const handleExportVarFont = () => {
    const file = projectStore.selectedFile
    if (!file) {
      message.warning(t('dialogs.exportVarFontDialog.needProject'))
      return
    }
    if (!file.constants?.length) {
      message.warning(t('dialogs.exportVarFontDialog.needConstants'))
      return
    }
    useDialogsStore().openExportVarFontDialog()
  }

  const handleExportColorFont = () => {
    console.log('Export color font')
  }

  const requireFile = () => {
    const f = projectStore.selectedFile
    if (!f) {
      message.warning('请先打开工程')
      return null
    }
    return f
  }

  const handleExportJpeg = () => {
    if (!requireFile()) return
    ImportExportSvgService.exportCurrentToJpeg()
      .then(() => {
        message.success('导出 JPEG 成功')
      })
      .catch((err) => {
        console.error('Export JPEG failed:', err)
        message.error('导出 JPEG 失败')
      })
  }

  const handleExportPng = () => {
    if (!requireFile()) return
    ImportExportSvgService.exportCurrentToPng()
      .then(() => {
        message.success('导出 PNG 成功')
      })
      .catch((err) => {
        console.error('Export PNG failed:', err)
        message.error('导出 PNG 失败')
      })
  }

  const handleExportSvg = () => {
    if (!requireFile()) return
    ImportExportSvgService.exportCurrentToSvg()
      .then(() => {
        message.success('导出 SVG 成功')
      })
      .catch((err) => {
        console.error('Export SVG failed:', err)
        message.error('导出 SVG 失败')
      })
  }

  return {
    'export-font-file': handleExportFont,
    'export-var-font-file': handleExportVarFont,
    'export-color-font': handleExportColorFont,
    'export-glyphs': handleExportGlyphs,
    'export-jpeg': handleExportJpeg,
    'export-png': handleExportPng,
    'export-svg': handleExportSvg,
  }
}
