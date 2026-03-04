import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import { dialogs } from './dialogs'
import { panels } from './panels'
import { menus } from './menus'
import { welcome } from './welcome'
import { programming } from './programming'

const messages = {
	zh: {
		menus: menus.zh,
		dialogs: dialogs.zh,
		panels: panels.zh,
		welcome: welcome.zh,
		programming: programming.zh,
  },
  en: {
		menus: menus.en,
		dialogs: dialogs.en,
		panels: panels.en,
		welcome: welcome.en,
		programming: programming.en,
  },
}

const i18nOptions = {
  locale: 'zh',
	fallbackLocale: 'en',
  allowComposition: true,
	messages,
}

const i18n = createI18n(i18nOptions)

export function setupI18n(app: App) {
  app.use(i18n)
}

export {
	i18n,
	i18nOptions,
	menus,
	dialogs,
	panels,
	welcome,
}

export default i18n
