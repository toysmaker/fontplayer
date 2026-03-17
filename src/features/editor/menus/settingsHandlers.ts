import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'

export function createSettingsHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { projectStore, message } = ctx

  const requireFile = () => {
    const file = projectStore.selectedFile
    if (!file) {
      message.warning('请先打开工程')
      return null
    }
    return file
  }

  const handleFontSettings = () => {
    if (!requireFile()) return
    window.dispatchEvent(new CustomEvent('editor-font-settings'))
  }

  const handlePreferenceSettings = () => {
    window.dispatchEvent(new CustomEvent('editor-preference-settings'))
  }

  const handleLanguageSettings = () => {
    window.dispatchEvent(new CustomEvent('editor-language-settings'))
  }

  return {
    'font-settings': handleFontSettings,
    'preference-settings': handlePreferenceSettings,
    'language-settings': handleLanguageSettings,
  }
}

