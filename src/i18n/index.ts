import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

// 简单的 i18n 配置，后续可以扩展
const messages = {
  zh: {
    common: {
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      open: '打开',
      close: '关闭',
      delete: '删除',
      edit: '编辑',
      add: '添加',
    },
    menu: {
      file: '文件',
      edit: '编辑',
      view: '视图',
      tools: '工具',
      help: '帮助',
    },
  },
  en: {
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      open: 'Open',
      close: 'Close',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
    },
    menu: {
      file: 'File',
      edit: 'Edit',
      view: 'View',
      tools: 'Tools',
      help: 'Help',
    },
  },
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'en',
  messages,
})

export function setupI18n(app: App) {
  app.use(i18n)
}

export default i18n
