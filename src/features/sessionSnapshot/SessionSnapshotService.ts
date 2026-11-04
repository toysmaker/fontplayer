/**
 * 会话快照服务（模块级单例）
 *
 * 每 30s（空闲时）把会话状态快照到 IndexedDB，供白屏重载后恢复：
 * - 小段（每 tick）：flush 编辑中字符到 IDB；序列化编辑中字形与编辑态
 * - 大段（脏门控）：characterList / 字形四表 / constants / 文件元数据
 * - 全部 try/catch 静默（DEV 才 warn）；写完即丢弃引用，不保留内存副本
 */
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useEditorStore } from '@/stores/editor'
import { buildFileSections, stripGlyphArray } from './snapshotSerializer'
import { SNAPSHOT_META_KEY, SNAPSHOT_TTL_MS, buildFileSnapshotKeys, extractFileUUIDFromSnapshotKey } from './keys'
import { markSessionSnapshotDirty, consumeSessionSnapshotDirty } from './dirtyFlag'

const TICK_INTERVAL_MS = 30_000
/** 大段强制全量周期：每 5 tick（2.5 分钟）兜底一次，防脏信号漏报 */
const FORCE_FULL_EVERY_TICKS = 5
/** 单节序列化时间预算（ms），超时放弃本节、下轮续传 */
const SECTION_BUDGET_MS = 200

let started = false
let scheduleTimer: number | null = null
let inFlight = false
let tickCount = 0
let unsubscribeDirty: (() => void) | null = null

const requestIdle = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof (window as any).requestIdleCallback === 'function') {
      ;(window as any).requestIdleCallback(
        () => resolve(true),
        { timeout: 3000 },
      )
    } else {
      setTimeout(() => resolve(true), 0)
    }
  })

const warn = (msg: string, err?: unknown) => {
  if (import.meta.env.DEV) {
    console.warn(`[sessionSnapshot] ${msg}`, err ?? '')
  }
}

/** 小段：flush editingCharacter 到 IDB + 序列化 editingGlyph/编辑态（选中文件） */
async function flushSmallSections(): Promise<void> {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file) return
  const characterStore = useCharacterStore()
  const glyphStore = useGlyphStore()
  const editorStore = useEditorStore()
  const keys = buildFileSnapshotKeys(file.uuid)

  // editingCharacter flush：在克隆上置空 previewRef/contourRef（不改动活对象，避免 watch 重入）
  const editing = characterStore.editingCharacter
  if (editing && characterStore.editingCharacterUUID) {
    try {
      const clone = JSON.parse(JSON.stringify(editing))
      clone.previewRef = undefined
      clone.contourRef = undefined
      await characterDataManager.updateCharacter(file.uuid, clone)
    } catch (err) {
      warn('flush editingCharacter failed', err)
    }
  }

  // editingGlyph 序列化（剥离运行时字段）
  let editingGlyphJson: string | null = null
  const editingGlyph = glyphStore.editingGlyph
  if (editingGlyph && glyphStore.editingGlyphUUID) {
    try {
      const clean = stripGlyphArray([editingGlyph])[0]
      editingGlyphJson = JSON.stringify(clean)
    } catch (err) {
      warn('serialize editingGlyph failed', err)
    }
  }

  const editingState = {
    savedAt: Date.now(),
    editStatus: editorStore.editStatus,
    prevStatus: editorStore.prevStatus,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingGlyphUUID: glyphStore.editingGlyphUUID,
    glyphCategory: glyphStore.glyphCategory,
    editingGlyph: editingGlyphJson,
  }
  try {
    await indexedDBManager.set(keys.editing, JSON.stringify(editingState))
  } catch (err) {
    warn('write ss_editing failed', err)
  }
}

/** 大段：分节序列化 + 写 IDB（按预算，超预算的节返回 null 跳过）。返回是否全部写完 */
async function flushLargeSections(fileUUID: string): Promise<boolean> {
  const file = useProjectStore().files.find((f) => f.uuid === fileUUID)
  if (!file) return true
  const keys = buildFileSnapshotKeys(fileUUID)
  let sections
  try {
    sections = buildFileSections(file, SECTION_BUDGET_MS)
  } catch (err) {
    warn('build sections failed', err)
    return false
  }
  let complete = true
  if (sections.meta) {
    try { await indexedDBManager.set(keys.meta, sections.meta) } catch (err) { warn('write ss_file_meta failed', err); complete = false }
  } else {
    complete = false
  }
  if (sections.chars) {
    try { await indexedDBManager.set(keys.chars, sections.chars) } catch (err) { warn('write ss_file_chars failed', err); complete = false }
  } else {
    complete = false
  }
  if (sections.glyphs) {
    try { await indexedDBManager.set(keys.glyphs, sections.glyphs) } catch (err) { warn('write ss_file_glyphs failed', err); complete = false }
  } else {
    complete = false
  }
  if (sections.constants) {
    try { await indexedDBManager.set(keys.constants, sections.constants) } catch (err) { warn('write ss_file_constants failed', err); complete = false }
  } else {
    complete = false
  }
  return complete
}

/** 元信息：files 列表 + 选中文件 + savedAt */
async function writeMeta(): Promise<void> {
  const projectStore = useProjectStore()
  if (!projectStore.files.length) {
    try { await indexedDBManager.remove(SNAPSHOT_META_KEY) } catch { /* ignore */ }
    return
  }
  const meta = {
    savedAt: Date.now(),
    selectedFileUUID: projectStore.selectedFileUUID,
    files: projectStore.files.map((f) => ({ uuid: f.uuid, name: f.name })),
  }
  try {
    await indexedDBManager.set(SNAPSHOT_META_KEY, JSON.stringify(meta))
  } catch (err) {
    warn('write ss_meta failed', err)
  }
}

/** GC：删除不属于当前已打开工程的 ss_file_* 键 */
async function gcStaleSnapshots(): Promise<void> {
  try {
    const allKeys = await indexedDBManager.keys()
    const valid = new Set(useProjectStore().files.map((f) => f.uuid))
    const stale = allKeys.filter((k) => {
      const uuid = extractFileUUIDFromSnapshotKey(k)
      return uuid !== null && !valid.has(uuid)
    })
    if (stale.length) {
      await indexedDBManager.removeBatch(stale)
    }
  } catch (err) {
    warn('gc failed', err)
  }
}

/** 单次快照 tick */
async function tick(): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    const projectStore = useProjectStore()
    if (!projectStore.files.length) {
      await gcStaleSnapshots()
      await writeMeta()
      return
    }
    // 保存/导出等长操作进行中：跳过本轮，避免与主线程序列化竞争拖慢保存
    if (projectStore.loading) {
      return
    }
    await requestIdle()

    // 小段：编辑态落库（每 tick）
    await flushSmallSections()

    // 大段：脏门控（store 动作钩子置脏 / 首次 / 强制周期兜底）
    if (consumeSessionSnapshotDirty() || tickCount % FORCE_FULL_EVERY_TICKS === 0) {
      let incomplete = false
      for (const f of projectStore.files) {
        const complete = await flushLargeSections(f.uuid)
        if (!complete) incomplete = true
      }
      // 预算超时未写完：重新置脏，下轮续传
      if (incomplete) {
        markSessionSnapshotDirty()
      }
    }

    await writeMeta()
    tickCount++
  } catch (err) {
    warn('tick failed', err)
  } finally {
    inFlight = false
  }
}

/** 自重排调度：setTimeout(30s) → requestIdleCallback → tick → 再排下一轮 */
function scheduleNext(): void {
  if (!started) return
  if (scheduleTimer !== null) return
  scheduleTimer = window.setTimeout(() => {
    scheduleTimer = null
    void tick().finally(() => {
      scheduleNext()
    })
  }, TICK_INTERVAL_MS)
}

/** 启动服务（EditorLayout onMounted 调用；可重复调用，幂等） */
export function startSessionSnapshot(): void {
  if (started) return
  started = true
  const projectStore = useProjectStore()
  // 浅订阅：捕获 files 数组/顶层 ref 级变更（深层变更由 store 动作钩子置脏）。
  // 注意：必须显式 deep:false——Pinia 的 $subscribe 默认 deep:true，
  // 深度订阅会在每次状态变更时遍历整个工程状态图，
  // 保存等逐字符更新进度的操作会因此严重变慢。
  unsubscribeDirty = projectStore.$subscribe(
    () => {
      markSessionSnapshotDirty()
    },
    { detached: true, deep: false },
  )
  scheduleNext()
}

/** 停止服务（EditorLayout onUnmounted 调用） */
export function stopSessionSnapshot(): void {
  started = false
  if (scheduleTimer !== null) {
    window.clearTimeout(scheduleTimer)
    scheduleTimer = null
  }
  if (unsubscribeDirty) {
    unsubscribeDirty()
    unsubscribeDirty = null
  }
}

/** 立即快照（visibilitychange hidden / 路由离开等时机调用） */
export function flushSnapshotNow(): void {
  void tick()
}

/** 删除指定工程的快照（关闭文件时调用） */
export async function removeFileSnapshot(fileUUID: string): Promise<void> {
  const keys = buildFileSnapshotKeys(fileUUID)
  try {
    await indexedDBManager.removeBatch([keys.meta, keys.chars, keys.glyphs, keys.constants, keys.editing])
  } catch (err) {
    warn('removeFileSnapshot failed', err)
  }
}

/** 是否存在可恢复的会话（欢迎页入口 / 自动恢复判断用） */
export async function hasRestorableSession(): Promise<boolean> {
  try {
    const raw = await indexedDBManager.get<string>(SNAPSHOT_META_KEY)
    if (!raw) return false
    const meta = JSON.parse(raw)
    if (!meta || typeof meta.savedAt !== 'number' || !meta.selectedFileUUID) return false
    if (Date.now() - meta.savedAt > SNAPSHOT_TTL_MS) return false
    const metaJson = await indexedDBManager.get<string>(buildFileSnapshotKeys(meta.selectedFileUUID).meta)
    return !!metaJson
  } catch {
    return false
  }
}
