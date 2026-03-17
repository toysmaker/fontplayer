import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'

export function createExportHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, ImportExportSvgService, message } = ctx

  const handleExportFont = () => {
    console.log('Export font')
  }

  const handleExportVarFont = () => {
    console.log('Export variable font')
  }

  const handleExportColorFont = () => {
    console.log('Export color font')
  }

  const handleExportGlyphs = () => {
    console.log('Export glyphs')
  }

  const requireFile = () => {
    const file = projectStore.selectedFile
    if (!file) {
      message.warning('请先打开工程')
      return null
    }
    return file
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

