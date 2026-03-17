import type { Router } from 'vue-router'
import type { DialogApi, MessageApi } from 'naive-ui'
import type { FileHandler } from '@/features/editor/menus/FileHandler'
import type { ImportExportSvgService } from '@/features/editor/services/ImportExportSvgService'
import type { formatContainerGlyphComponents as formatGlyphFn } from '@/features/editor/services/FormatGlyphService'
import type { templateHandlers as templateHandlersMap } from '@/features/editor/menus/templatesHandlers'
import type { useProjectStore } from '@/stores/project'
import type { useEditorStore } from '@/stores/editor'
import type { useCharacterStore } from '@/stores/character'

/**
 * 菜单处理器上下文
 * 由外层（例如 EditorSidebar）在运行时组装后传入各个 handlers 工厂函数使用。
 */
export interface MenuHandlerContext {
  projectStore: ReturnType<typeof useProjectStore>
  editorStore: ReturnType<typeof useEditorStore>
  characterStore: ReturnType<typeof useCharacterStore>
  message: MessageApi
  dialog: DialogApi
  /**
   * i18n 文本函数，等价于 useI18n().t
   */
  t: (key: string, ...args: any[]) => string
  router: Router
  fileHandler: FileHandler
  ImportExportSvgService: typeof ImportExportSvgService
  formatContainerGlyphComponents: typeof formatGlyphFn
  templateHandlers: typeof templateHandlersMap
}

/**
 * 菜单 key -> 执行函数 映射
 */
export type MenuHandlersMap = Record<string, () => any | Promise<any>>

/**
 * 菜单 key -> 是否启用的判定函数 映射
 * 返回 true 表示“允许启用”（即不禁用）。
 */
export type MenuDisabledRuleMap = Record<string, () => boolean>

