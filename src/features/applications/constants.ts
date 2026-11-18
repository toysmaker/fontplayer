import type { ApplicationType } from './types'

/** 每种应用类型最多保存的应用数量 */
export const MAX_APPS_PER_TYPE = 20

/** 应用文档当前 schema 版本 */
export const APP_DOC_SCHEMA_VERSION = 1

/** 卡片应用默认画布分辨率（1920x1080） */
export const DEFAULT_CARD_CANVAS = { width: 1920, height: 1080 }

/** 卡片应用默认背景色 */
export const DEFAULT_CARD_BACKGROUND = '#ffffff'

/** logo 图标/文本字号默认值 */
export const DEFAULT_LOGO_ICON_FONT_SIZE = 72
export const DEFAULT_LOGO_TEXT_FONT_SIZE = 72

/** 头像默认尺寸 */
export const DEFAULT_AVATAR_SIZE = 500

/** IndexedDB 键前缀 */
export const APP_DOC_KEY_PREFIX = 'application_doc_'

export function applicationDocKey(type: ApplicationType, id: string): string {
  return `${APP_DOC_KEY_PREFIX}${type}_${id}`
}

export const APPLICATION_TYPES: ApplicationType[] = ['card', 'logo', 'avatar']
