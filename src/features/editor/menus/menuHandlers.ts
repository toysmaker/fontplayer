import type { MenuHandlerContext, MenuHandlersMap, MenuDisabledRuleMap } from './menuHandlerTypes'
import { createFileHandlers } from './fileHandlers'
import { createEditHandlers } from './editHandlers'
import { createImportHandlers } from './importHandlers'
import { createExportHandlers } from './exportHandlers'
import { createCharacterHandlers } from './characterHandlers'
import { createSettingsHandlers } from './settingsHandlers'
import { createTemplateMenuHandlers } from './templateMenuHandlers'
import { createToolsHandlers } from './toolsHandlers'
import { EditStatus } from '@/core/types'

/**
 * 聚合所有 root 菜单的 handlers。
 * 后续会在这里继续引入 edit/import/export/character/settings/templates/tools 等模块。
 */
export function createMenuHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  return {
    ...createFileHandlers(ctx),
    ...createEditHandlers(ctx),
    ...createImportHandlers(ctx),
    ...createExportHandlers(ctx),
    ...createCharacterHandlers(ctx),
    ...createSettingsHandlers(ctx),
    ...createTemplateMenuHandlers(ctx),
    ...createToolsHandlers(ctx),
  }
}

/**
 * 统一的菜单启用/禁用规则。
 * 返回 true 表示菜单在当前状态下“可用”（不禁用）。
 */
export function createDisabledRules(ctx: {
  editorStore: MenuHandlerContext['editorStore']
  projectStore: MenuHandlerContext['projectStore']
}): MenuDisabledRuleMap {
  const { editorStore, projectStore } = ctx

  const enable = () => true

  const enableWithConstants = () => {
    const n = projectStore.selectedFile?.constants?.length ?? 0
    return n > 0
  }

  const enableAtEdit = () => {
    return editorStore.editStatus === EditStatus.Edit || editorStore.editStatus === EditStatus.Glyph
  }

  const enableAtCharacterEdit = () => {
    return editorStore.editStatus === EditStatus.Edit
  }

  const enableAtList = () => {
    return (
      editorStore.editStatus === EditStatus.CharacterList ||
      editorStore.editStatus === EditStatus.GlyphList ||
      editorStore.editStatus === EditStatus.StrokeGlyphList ||
      editorStore.editStatus === EditStatus.RadicalGlyphList ||
      editorStore.editStatus === EditStatus.CompGlyphList
    )
  }

  /** 仅字形类列表（导出字形）；排除字符列表 */
  const enableAtGlyphListOnly = () => {
    return (
      editorStore.editStatus === EditStatus.GlyphList ||
      editorStore.editStatus === EditStatus.StrokeGlyphList ||
      editorStore.editStatus === EditStatus.RadicalGlyphList ||
      editorStore.editStatus === EditStatus.CompGlyphList
    )
  }

  const templateEnable = () => {
    return (
      editorStore.editStatus !== EditStatus.Edit &&
      editorStore.editStatus !== EditStatus.Glyph &&
      editorStore.editStatus !== EditStatus.Pic
    )
  }

  const enableAtListNoProject = () => enableAtList() && !projectStore.hasFiles

  return {
    // file
    'create-file': enableAtList,
    'open-file': enableAtListNoProject,
    'save-file': enable,
    'clear-cache': enable,
    'sync-data': enableAtListNoProject,
    'save-as-json': enable,

    // edit
    'undo': enableAtEdit,
    'redo': enableAtEdit,
    'cut': enableAtEdit,
    'copy': enableAtEdit,
    'paste': enableAtEdit,
    'delete': enableAtEdit,

    // import
    'import-font-file': enableAtList,
    'import-glyphs': enableAtList,
    'import-pic': enableAtEdit,
    'import-svg': enableAtEdit,

    // export
    'export-font-file': enable,
    'export-var-font-file': enableWithConstants,
    'export-color-font': enable,
    'export-glyphs': enableAtGlyphListOnly,
    'export-jpeg': enableAtEdit,
    'export-png': enableAtEdit,
    'export-svg': enableAtEdit,

    // character
    'add-character': enableAtList,
    'add-icon': enableAtList,

    // settings
    'font-settings': enable,
    'preference-settings': enable,
    'language-settings': enable,

    // templates
    'template-2': templateEnable,
    'template-3': templateEnable,
    'template-5': templateEnable,
    'template-6': templateEnable,
    'template-7': templateEnable,
    'template-8': templateEnable,
    'template-digits': templateEnable,
    'template-letters': templateEnable,
    'template-symbols': templateEnable,
    'template-test': templateEnable,

    // tools
    'remove_overlap': enableAtEdit,
    'format-all-characters': enableAtList,
    'format-current-character': enableAtCharacterEdit,
  }
}

