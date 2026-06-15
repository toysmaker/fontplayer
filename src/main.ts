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
	faLayerGroup,
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
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
	faArrowUp,
	faArrowDown,
	faChevronLeft,
	faChevronRight,
	faEllipsisVertical,
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
	faLayerGroup,
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
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
	faArrowUp,
	faArrowDown,
	faChevronLeft,
	faChevronRight,
	faEllipsisVertical,
	faTrash,
)

app.use(pinia)
app.use(router)
setupNaiveUI(app)
setupI18n(app)

// 注册 FontAwesome 全局组件
app.component('font-awesome-icon', FontAwesomeIcon)

app.mount('#app')

// ---- 全局修复 WKWebView 双击问题（macOS Tauri） ----
// 根因：WKWebView 在 mousedown 后触发 input blur，导致后续 click 事件丢失
// 修复：capture 阶段检测 input 聚焦时点击按钮，用微任务在 blur 完成后补发 click
document.addEventListener('mousedown', (e) => {
  const target = (e.target as HTMLElement)?.closest?.('.n-base-close') as HTMLElement | null
  if (!target) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    Promise.resolve().then(() => { target.click() })
  }
}, true)

// ---- 心跳保活：防止长期最小化后被 macOS 标记为空闲挂起 Web 进程 ----
setInterval(() => { void Date.now() }, 600_000) // 每10分钟一次心跳，防止 Web 进程被 macOS 标记为空闲

// ---- 窗口恢复 / 页面可见性变化处理（修复长期最小化后 WKWebView 白屏） ----

/** 检测 WebKit 合成器是否正常：创建 1x1 canvas 填充红色并读回像素 */
function isCompositorHealthy(): boolean {
  let c: HTMLCanvasElement | null = null
  try {
    c = document.createElement('canvas')
    c.width = 1; c.height = 1
    const ctx = c.getContext('2d')
    if (!ctx) return false
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 1, 1)
    const pixel = ctx.getImageData(0, 0, 1, 1).data
    return pixel[0] > 200 && pixel[1] < 50
  } catch { return false }
  finally { c?.remove() }
}

async function handleAppRestored() {
  // 仅当合成器异常时才刷新，避免正常情况下的不必要重绘
  if (isCompositorHealthy()) return
  if (import.meta.env.DEV) console.log('[app] compositor broken, forcing re-render')
  try {
    const { CanvasManager } = await import('@/core/canvas/CanvasManager')
    CanvasManager.forceCleanupAllCache()
  } catch {}
  window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
  window.dispatchEvent(new CustomEvent('force-glyph-list-refresh'))
}

// Tauri 端：窗口聚焦恢复事件（仅 Tauri 环境有效）
try {
  const { listen } = await import('@tauri-apps/api/event')
  listen('window-focus-restored', () => { handleAppRestored() }).catch(() => {})
} catch {}

// Web 端兜底：页面可见性变化 + bfcache 恢复
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') handleAppRestored()
})
window.addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) handleAppRestored()
})

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
