import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { genUUID } from '@/utils/uuid'
import { useProjectStore } from '@/stores/project'
import { APP_DOC_SCHEMA_VERSION, MAX_APPS_PER_TYPE } from './constants'
import { applicationStorage } from './applicationStorage'
import { getRestoredFileUUID, restoreApplicationProject } from './applicationWindowBridge'
import {
  buildFontLibrary,
  disposeFontLibrary,
  getCachedApplicationFont,
  loadFontLibraryFromBuffer,
  getCurrentFontLibrary,
} from './fontLibraryService'
import type { ApplicationType, IApplicationDocument } from './types'

/**
 * 应用编辑页共享逻辑：
 * - 加载/新建应用文档（新建时检查数量上限）
 * - 编辑已有应用：用其保存的字体副本注册字库（旧应用旧字体）；
 *   保存时从当前工程重建字库并固化进 doc.fontBuffer
 * - 页面卸载释放字库（仅内存，不落盘）
 */
export function useAppEditorPage(
  type: ApplicationType,
  createDefaultData: () => IApplicationDocument['data'],
  options?: {
    /**
     * 是否需要字库（默认 true）。
     * 头像直接用轮廓渲染生成，不经过 FontFace/字体文件——设为 false 后
     * 进入不构建字库、无入口字体选择、保存也不重建字库。
     */
    needsFontLibrary?: boolean
  }
) {
  const needsFontLibrary = options?.needsFontLibrary ?? true
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const message = useMessage()
  const projectStore = useProjectStore()

  const appId = (route.params.appId as string | undefined) || null
  const doc = ref<IApplicationDocument | null>(null)
  const initializing = ref(true)
  const building = ref(false)
  const progressDone = ref(0)
  const progressTotal = ref(0)
  /** 构建阶段：characters=逐字符生成, assembling=封装字库数据 */
  const buildPhase = ref<'characters' | 'assembling'>('characters')
  const errorText = ref('')
  /** 字库每次（重新）构建/注册后 +1，供画布强制重渲染 */
  const libraryVersion = ref(0)
  /** 进入时的字体选择（参照排版预览：已有缓存时可选复用上次缓存字体） */
  const showEntryModal = ref(false)
  const useLastFont = ref(true)

  const familySuffix = `${type}-${appId ?? 'new'}`

  const onProgress = (done: number, total: number) => {
    progressDone.value = done
    progressTotal.value = total
  }

  const onAssembling = (done: number, total: number) => {
    buildPhase.value = 'assembling'
    progressDone.value = done
    progressTotal.value = total
  }

  async function registerLibraryForDoc(d: IApplicationDocument) {
    if (d.fontBuffer && d.fontBuffer.byteLength > 0) {
      await loadFontLibraryFromBuffer(d.fontBuffer, `${type}-${d.id}`)
      libraryVersion.value++
    }
  }

  /** 构建中的单飞 Promise（避免入口后台构建与保存同时触发两次构建） */
  let inflightBuild: Promise<void> | null = null
  /** 当前字库是否为彩色构建（logo 彩色模式保存时据此判断是否需要生成彩色字体） */
  let lastBuildWasColor = false

  /** 从当前工程构建字库并写入 doc（不落盘，调用方决定是否保存） */
  async function rebuildLibraryIntoDoc(d: IApplicationDocument, colorFont = false) {
    if (inflightBuild) {
      await inflightBuild
      return
    }
    building.value = true
    buildPhase.value = 'characters'
    inflightBuild = (async () => {
      try {
        const lib = await buildFontLibrary({
          colorFont,
          familySuffix: `${type}-${d.id}`,
          onProgress,
          onAssembling,
        })
        d.fontBuffer = lib.buffer
        d.fontFamily = lib.family
        lastBuildWasColor = colorFont
        libraryVersion.value++
      } finally {
        building.value = false
        inflightBuild = null
      }
    })()
    await inflightBuild
  }

  /** 入口复用时使用的缓存 buffer（IDB 缓存优先，其次文档保存的字体副本） */
  let pendingReuseBuffer: ArrayBuffer | null = null

  async function initialize() {
    // 应用窗口是独立 JS 上下文：先从 IndexedDB 快照恢复工程（参照排版预览）。
    const fileUUID = (route.query.file as string | undefined) || getRestoredFileUUID()
    const restored = await restoreApplicationProject(fileUUID)
    if (!restored || !projectStore.hasFiles) {
      errorText.value = t('applications.listPage.noProject')
      initializing.value = false
      return
    }

    // 无 appId = 创建新应用：先检查数量上限
    if (!appId) {
      const countFile = projectStore.selectedFile
      if (!countFile) return
      const count = await applicationStorage.countDocs(countFile, type)
      if (count >= MAX_APPS_PER_TYPE) {
        message.warning(t('applications.listPage.maxReached', { max: MAX_APPS_PER_TYPE }))
        router.replace(`/applications/${type}`)
        return
      }
      // 显式「新建应用」= 干净开始，不恢复历史草稿
      //（草稿恢复仅用于「编辑已有应用」，防止误触返回丢失内容）
      const draft: IApplicationDocument = {
        schemaVersion: APP_DOC_SCHEMA_VERSION,
        type,
        id: genUUID(),
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fontBuffer: new ArrayBuffer(0),
        fontFamily: '',
        videos: [],
        micros: [],
        data: createDefaultData(),
      }
      doc.value = draft
    } else {
      // 编辑已有应用
      const editFile = projectStore.selectedFile
      if (!editFile) return
      const stored = await applicationStorage.getDoc(editFile, type, appId)
      const unsavedDraft = await applicationStorage.loadDraft(editFile, type, appId)
      // 草稿比已保存版本新（上次编辑未保存）→ 恢复草稿
      if (unsavedDraft && (!stored || unsavedDraft.updatedAt > stored.updatedAt)) {
        doc.value = unsavedDraft
      } else if (stored) {
        doc.value = JSON.parse(JSON.stringify(stored)) as IApplicationDocument
      } else {
        errorText.value = t('applications.listPage.loadFailed')
        initializing.value = false
        return
      }
    }

    // 先渲染页面（initializing 立即结束）
    initializing.value = false

    // 不需要字库（如头像）：直接完成，不构建、不弹入口选择
    if (!needsFontLibrary) {
      return
    }

    // 字体加载（参照排版预览入口）：有缓存 → 弹「使用上次缓存字体」选择；
    // 无缓存 → 从当前工程重建（全屏进度可见）。
    const cached = await getCachedApplicationFont(fileUUID)
    const docBuffer = doc.value?.fontBuffer
    if (cached) {
      pendingReuseBuffer = cached
      showEntryModal.value = true
    } else if (docBuffer && docBuffer.byteLength > 0) {
      pendingReuseBuffer = docBuffer
      showEntryModal.value = true
    } else {
      void rebuildLibraryIntoDoc(doc.value!).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[applications] initial library build failed:', err)
        }
      })
    }
  }

  /** 入口选择确认：复用上次缓存字体（快）或 从当前工程重建 */
  async function confirmEntry() {
    const d = doc.value
    showEntryModal.value = false
    if (!d) return
    if (useLastFont.value && pendingReuseBuffer) {
      // 复用上次缓存字体（快）；同时固化进文档，保存时无需重建
      d.fontBuffer = pendingReuseBuffer
      try {
        await registerLibraryForDoc(d)
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[applications] register saved font failed:', err)
        }
      }
      return
    }
    // 从当前工程重建字库（全屏进度可见）
    try {
      await rebuildLibraryIntoDoc(d)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[applications] initial library build failed:', err)
      }
    }
  }

  /**
   * 保存应用：**不在保存时重建字库**（字库在进入时生成一次，含复用选项）。
   * - 入口构建未完成则等待；失败/从未构建才兜底构建一次
   * - 例外：logo 彩色模式（colorFont=true）且当前字库非彩色 → 生成彩色字体（按需求）
   * - 不需要字库的应用（头像）直接保存
   */
  async function saveApp(colorFont = false): Promise<boolean> {
    const d = doc.value
    if (!d) return false
    try {
      if (needsFontLibrary) {
        if (inflightBuild) await inflightBuild
        const needBuild =
          (colorFont && !lastBuildWasColor) ||
          !d.fontBuffer ||
          d.fontBuffer.byteLength === 0
        if (needBuild) {
          await rebuildLibraryIntoDoc(d, colorFont)
        }
      }
      const saveFile = projectStore.selectedFile
      if (!saveFile) throw new Error('no project')
      await applicationStorage.saveDoc(saveFile, d)
      // 保存成功后清除草稿
      await applicationStorage.clearDraft(saveFile, type, appId ?? 'new')
      message.success(t('applications.cardEditor.saved'))
      return true
    } catch (err) {
      if ((err as Error)?.name === 'QuotaExceededError') {
        message.error(t('applications.listPage.quotaExceeded'))
      } else {
        message.error(t('applications.cardEditor.saveFailed'))
        if (import.meta.env.DEV) {
          console.error('[applications] save failed:', err)
        }
      }
      return false
    }
  }

  /** 返回 = 回到该子选项的应用列表（窗口内路由） */
  function backToList() {
    router.push(`/applications/${type}`)
  }

  // ---- 编辑草稿自动持久化：路由跳转/滑动返回/关窗不丢编辑内容 ----
  let draftTimer: number | null = null

  function flushDraftNow() {
    if (draftTimer !== null) {
      clearTimeout(draftTimer)
      draftTimer = null
    }
    const d = doc.value
    const file = projectStore.selectedFile
    if (d && file) {
      const draftAppKey = appId ?? 'new'
      void applicationStorage.saveDraft(file, d, draftAppKey)
    }
  }

  watch(
    doc,
    () => {
      if (draftTimer !== null) clearTimeout(draftTimer)
      draftTimer = window.setTimeout(flushDraftNow, 800)
    },
    { deep: true }
  )

  onMounted(() => {
    initialize()
  })

  onUnmounted(() => {
    flushDraftNow()
    disposeFontLibrary()
  })

  return {
    appId,
    doc,
    initializing,
    building,
    progressDone,
    progressTotal,
    buildPhase,
    errorText,
    libraryVersion,
    showEntryModal,
    useLastFont,
    confirmEntry,
    saveApp,
    backToList,
    rebuildLibraryIntoDoc,
    getCurrentFontLibrary,
  }
}
