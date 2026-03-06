import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupNaiveUI } from './plugins/naive-ui'
import { setupI18n } from './i18n'
import './assets/main.css'

import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// 按需导入图标 - 从 @fortawesome/free-solid-svg-icons
import {
	faArrowPointer,
	faPenNib,
	faDrawPolygon,
	faImage,
	faFont,
	faTerminal,
	faSliders,
	faTableCells,
	faTextWidth,
	faHand as faHandSolid,
	faPercent,
	faArrowDownWideShort,
	faGamepad,
	faMinus,
	faPlus,
	faXmark,
	faMagnifyingGlass,
	faCircleInfo,
	faWrench,
	faCopy,
	faTrash,
	faFolderOpen,
	faArchive,
	faArrowsLeftRight,
	faFile,
	faFileImport,
	faPencil,
	faUpload,
	faDownload,
	faTicket,
	faGear,
	faList,
	faCircleCheck,
	faCircleXmark,
	faLock,
	faLockOpen,
	faEye,
	faEyeSlash,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'

// 按需导入图标 - 从 @fortawesome/free-regular-svg-icons
import {
	faHand,
	faSquare as faSquare_regular,
	faCircle as faCircle_regular,
} from '@fortawesome/free-regular-svg-icons'

import localForage from 'localforage'

// 配置 localForage
localForage.config({
  driver: localForage.INDEXEDDB,
  name: 'fontplayer_refractor',
  version: 1.0,
  size: 4980736,
  storeName: 'keyvaluepairs',
  description: 'fontplayer refactor database'
})

declare global {
  interface Window {
    FP: any
    constantsMap: any
    glyph: any
    comp_glyph: any
    character: any
    __constants: any
    __parameters: any
    __script: any
    __is_web: boolean
    __uuid: string
  }
}

const app = createApp(App)
const pinia = createPinia()

app.config.errorHandler = (err, vm, info) => {
  console.error('全局错误:', err, info)
  // 阻止错误传播，避免页面刷新
  // 在开发环境中，仍然显示错误信息
  if (import.meta.env.DEV) {
    console.error('错误详情:', {
      error: err,
      component: vm,
      info,
      stack: err instanceof Error ? err.stack : undefined
    })
  }
  // 返回 false 表示错误已处理，不会导致页面刷新
  return false
}

// 捕获未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason)
  // 阻止默认行为（页面刷新）
  event.preventDefault()
  // 在开发环境中显示详细信息
  if (import.meta.env.DEV) {
    console.error('Promise 拒绝详情:', {
      reason: event.reason,
      promise: event.promise
    })
  }
})

// 捕获未处理的错误
window.addEventListener('error', (event) => {
  console.error('未处理的错误:', event.error || event.message)
  // 阻止默认行为（页面刷新）
  event.preventDefault()
  // 在开发环境中显示详细信息
  if (import.meta.env.DEV) {
    console.error('错误详情:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
  }
  // 返回 true 表示错误已处理
  return true
})

// 将图标添加到 library
library.add(
  faCircleCheck,
  faLock,
  faEye,
  faEyeSlash,
	faArrowPointer,
	faPenNib,
	faDrawPolygon,
	faImage,
	faFont,
	faTerminal,
	faSliders,
	faTableCells,
	faTextWidth,
	faHandSolid,
	faPercent,
	faArrowDownWideShort,
	faGamepad,
	faMinus,
	faPlus,
	faXmark,
	faMagnifyingGlass,
	faCircleInfo,
	faWrench,
	faCopy,
	faTrash,
	faFolderOpen,
	faArchive,
	faArrowsLeftRight,
	faFile,
	faFileImport,
	faPencil,
	faUpload,
	faDownload,
	faTicket,
	faGear,
	faList,
	faCircleCheck,
	faCircleXmark,
	faLock,
	faLockOpen,
	faEye,
	faEyeSlash,
	faHand,
	faSquare_regular,
	faCircle_regular,
  faPenToSquare,
)

app.use(pinia)
app.use(router)
setupNaiveUI(app)
setupI18n(app)

// 注册 FontAwesome 全局组件
app.component('font-awesome-icon', FontAwesomeIcon)

app.mount('#app')

// 启用 Vite HMR
if (import.meta.hot) {
  import.meta.hot.accept()
  
  // 监听 HMR 更新
  import.meta.hot.on('vite:beforeUpdate', () => {
    console.log('[HMR] 准备更新...')
  })
  
  import.meta.hot.on('vite:afterUpdate', () => {
    console.log('[HMR] 更新完成')
  })
  
  import.meta.hot.on('vite:error', (err) => {
    console.error('[HMR] 更新错误:', err)
  })
}

export { app, pinia }
