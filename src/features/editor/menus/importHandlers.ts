import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'

export function createImportHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const handleImportFont = () => {
    console.log('Import font')
  }

  const handleImportGlyphs = () => {
    console.log('Import glyphs')
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

