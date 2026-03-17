import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'

export function createTemplateMenuHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, templateHandlers, message, t } = ctx

  const runTemplate = async (key: string) => {
    const handler = templateHandlers[key]
    if (!handler) {
      message.warning(t('panels.editorSidebar.templateNotFound') || `未知模板: ${key}`)
      return
    }
    if (!projectStore.selectedFile) {
      message.warning(t('panels.editorSidebar.openProjectFirst') || '请先新建或打开工程')
      return
    }
    try {
      await handler()
      message.success(t('panels.editorSidebar.templateImportSuccess') || '模板导入成功')
    } catch (err) {
      console.error('Template import failed:', err)
      message.error((err as Error).message || '模板导入失败')
    }
  }

  return {
    'template-2': () => runTemplate('template-2'),
    'template-3': () => runTemplate('template-3'),
    'template-5': () => runTemplate('template-5'),
    'template-6': () => runTemplate('template-6'),
    'template-7': () => runTemplate('template-7'),
    'template-8': () => runTemplate('template-8'),
    'template-digits': () => runTemplate('template-digits'),
    'template-letters': () => runTemplate('template-letters'),
    'template-symbols': () => runTemplate('template-symbols'),
    'template-test': () => runTemplate('template-test'),
  }
}

