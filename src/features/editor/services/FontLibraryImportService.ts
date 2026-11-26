/**
 * 从 .otf / .ttf 导入为工程（字符列表 + IndexedDB 中的完整字符数据）
 */

import { nextTick } from 'vue'
import type { Router } from 'vue-router'
import type { DialogApi, MessageApi } from 'naive-ui'
import { parse } from '@/fontManager'
import { ContourConverter } from '@/core/font/converter'
import type {
  IFile,
  ICharacterFileLite,
  ICharacterFileMetadata,
} from '@/core/types'
import { EditStatus } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import type { useProjectStore } from '@/stores/project'
import type { useEditorStore } from '@/stores/editor'
import type { useCharacterStore } from '@/stores/character'
import { isTauri } from '@/utils/env'
import { setTauriBuildBusy } from '@/utils/tauri-build-busy'
import { loadDecompositionData } from '@/features/decomposition/processing'

export type FontImportStores = {
  projectStore: ReturnType<typeof useProjectStore>
  editorStore: ReturnType<typeof useEditorStore>
  characterStore: ReturnType<typeof useCharacterStore>
}

export type FontImportI18n = {
  t: (key: string, ...args: unknown[]) => string
  message: MessageApi
  dialog: DialogApi
  router: Router
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** 当前是否已有打开的工程（单工程限制） */
export function fontImportBlockedByOpenProject(projectStore: FontImportStores['projectStore']): boolean {
  return projectStore.files.length > 0
}

export function showFontImportSingleProjectWarning(ctx: FontImportI18n): void {
  ctx.dialog.warning({
    title: ctx.t('dialogs.fontImport.singleProjectTitle'),
    content: ctx.t('dialogs.fontImport.singleProjectBody'),
    positiveText: ctx.t('dialogs.fontImport.singleProjectConfirm'),
  })
}

function makeGridInfo(width: number) {
  return {
    gridSettings: {
      dx: 0,
      dy: 0,
      centerSquareSize: width / 3,
      size: width,
      default: true,
      initialGrid: {
        dx: 0,
        dy: 0,
        dx1: 0,
        dx2: 0,
        dx3: 0,
        dx4: 0,
        dy1: 0,
        dy2: 0,
        dy3: 0,
        dy4: 0,
        ox: 500,
        oy: 500,
        width: 1000,
        height: 1000,
        centerSquareScale: 1,
      },
      currentGrid: {
        dx: 0,
        dy: 0,
        dx1: 0,
        dx2: 0,
        dx3: 0,
        dx4: 0,
        dy1: 0,
        dy2: 0,
        dy3: 0,
        dy4: 0,
        ox: 500,
        oy: 500,
        width: 1000,
        height: 1000,
        centerSquareScale: 1,
      },
    },
    useSkeletonGrid: false,
    layout: '',
    layoutTree: [] as unknown[],
  }
}

/**
 * 导入度量换算：字体 upm → 工程标准 1000 空间。
 * - scale = 1000/unitsPerEm（ascender/descender/advanceWidth/lsb/轮廓统一缩放）
 * - em 盒（ascender - descender）超出 1000 时（如思源黑体 1160/-288 = 1448），
 *   在 1000 网格内垂直居中（desc' = (asc + desc - 1000)/2，上下截断最小化）；
 *   不超 1000 时保持原 descender（工程自身 800/-200、山海国潮 850/-150 不受影响）
 * - 换算 y_edit = 1000 - y + desc 对任意 descender 自逆，导出往返依旧精确
 */
export function resolveImportFontMetrics(settings: {
  unitsPerEm?: number
  ascender?: number
  descender?: number
}): { scale: number; ascender: number; descender: number } {
  const scale = 1000 / (settings.unitsPerEm ?? 1000)
  const ascender = Math.round((settings.ascender ?? 800) * scale)
  const descender = Math.round((settings.descender ?? -200) * scale)
  const emHeight = ascender - descender
  const adjustedDescender =
    emHeight > 1000 ? Math.round((ascender + descender - 1000) / 2) : descender
  return { scale, ascender, descender: adjustedDescender }
}

/**
 * 将解析后的 font 转为字符文件列表（完整 lite，用于写入 IDB）
 *
 * 坐标换算规则（导入 = 导出算法 componentsToContours 的严格逆运算）：
 * - 工程只支持 unitsPerEm=1000 的编辑空间：字体坐标按 scale = 1000/unitsPerEm 缩放
 * - descender 同样按 scale 缩放，与导出侧 formatPoints(type 1) 的
 *   y_font = unitsPerEm - y_edit + descender 严格互逆
 * - x 方向零居中（advanceWidth 传 1000，与渲染/导出一致），字形左缘 = lsb（按 app 度量模型）
 * - 轮廓坐标 floor（与 genPenContour 导出时 floor 的量化惯例幂等一致）
 * - 度量（advanceWidth/lsb）按 scale 换算后写入 info.metrics，度量工具栏与导出 hmtx 依赖它
 */
export async function buildCharacterFilesFromParsedFont(
  font: {
    characters: any[]
    settings: { unitsPerEm?: number; ascender?: number; descender?: number }
  },
  gridWidth: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ICharacterFileLite[]> {
  const { scale, descender } = resolveImportFontMetrics(font.settings)
  const list: ICharacterFileLite[] = []
  const total = font.characters.length

  // 轮廓按 scale 缩放（floor 交给 contoursToComponents 入口统一处理）
  const scalePoint = (p: { x: number; y: number }) => ({ x: p.x * scale, y: p.y * scale })
  const scaleContours = (contours: any[]): any[] =>
    contours.map((contour: any[]) =>
      contour.map((seg: any) => ({
        ...seg,
        start: scalePoint(seg.start),
        end: scalePoint(seg.end),
        control: seg.control ? scalePoint(seg.control) : undefined,
        control1: seg.control1 ? scalePoint(seg.control1) : undefined,
        control2: seg.control2 ? scalePoint(seg.control2) : undefined,
      })),
    )

  for (let j = 0; j < font.characters.length; j++) {
    const character = font.characters[j]
    if (!character.unicode && !character.name) continue

    const characterComponent = {
      uuid: genUUID(),
      // fromCodePoint 正确支持非 BMP 码点（> 0xFFFF），fromCharCode 会把代理对截断成乱码
      text: character.unicode ? String.fromCodePoint(character.unicode) : String(character.name ?? ''),
      // BMP 保持 4 位小写十六进制；非 BMP 用 U+ 前缀与 5~6 位十六进制（unicodeToCode 兼容解析）
      unicode: character.unicode
        ? character.unicode > 0xFFFF
          ? `U+${character.unicode.toString(16).toUpperCase()}`
          : character.unicode.toString(16).padStart(4, '0')
        : '',
    }
    const uuid = genUUID()
    // 度量按 scale 换算到 1000 空间：advanceWidth 四舍五入（hmtx 值），
    // lsb 取 floor 与轮廓坐标的 floor 量化保持一致（字形左缘 == lsb 是 app 度量模型的不变量）
    const scaledAdvance = Math.round((character.advanceWidth ?? 1000) * scale)
    const scaledLsb = Math.floor((character.leftSideBearing ?? 0) * scale)
    const characterFile: ICharacterFileLite = {
      uuid,
      type: 'text',
      character: characterComponent,
      components: [],
      groups: [],
      orderedList: [],
      selectedComponentsUUIDs: [],
      view: {
        zoom: 100,
        translateX: 0,
        translateY: 0,
      },
      info: {
        ...makeGridInfo(gridWidth),
        // 携带字体度量（缩放到 1000 空间）：度量工具栏显示与导出 hmtx 都依赖 info.metrics，
        // 缺失时 advanceWidth 退化回 unitsPerEm、lsb 退化回 0，重导出字库度量被破坏
        metrics: {
          advanceWidth: scaledAdvance,
          lsb: scaledLsb,
          useDefaultValues: false,
        },
        // 导入字符坐标按 advanceWidth 居中存放（见下方 contoursToComponents），
        // 导出换算用 metrics.advanceWidth 还原，工程自身字符不受影响
        imported: true,
      },
      script: `function script_${uuid.replaceAll('-', '_')} (character, constants, FP) {\n\t//Todo something\n}`,
    }

    // 导入换算：缩放后的字体坐标 → 1000 编辑空间（导出侧 formatPoints(type 1) 的逆）。
    // advanceWidth 传字符真实 advanceWidth（缩放后）：formatPoints(type 0) 的
    // (upm - advanceWidth)/2 项将字形在 advance 盒内居中显示，度量控件也随
    // xMin - lsb = (upm - advance)/2 自动居中；导出对 imported 字符用
    // metrics.advanceWidth 还原（x 方向精确互逆，c 恰好抵消）
    const components = ContourConverter.contoursToComponents(
      scaleContours(character.contours ?? []),
      {
        unitsPerEm: 1000,
        descender,
        advanceWidth: scaledAdvance,
      },
    )
    for (const component of components) {
      characterFile.components.push(component)
      characterFile.orderedList.push({
        type: 'component',
        uuid: component.uuid,
      })
    }
    list.push(characterFile)

    onProgress?.(j + 1, total)

    if (j % 100 === 0) await yieldToMain()
  }

  return list
}

export type ImportFontBufferOptions = FontImportStores &
  FontImportI18n & {
    buffer: ArrayBuffer
    /** 不含扩展名的显示名 */
    displayName: string
    /** 从欢迎页启动时先保证 Loading 能挂载 */
    fromWelcome?: boolean
  }

/**
 * 从已读取的字体 buffer 导入（解析、建文件、写 IDB、更新列表元数据）
 */
export async function importFontLibraryFromBuffer(options: ImportFontBufferOptions): Promise<void> {
  const {
    projectStore,
    editorStore,
    characterStore,
    buffer,
    displayName,
    t,
    message,
    router,
    fromWelcome,
  } = options

  if (fontImportBlockedByOpenProject(projectStore)) {
    showFontImportSingleProjectWarning({ t, message, dialog: options.dialog, router })
    return
  }

  // 大字体（如思源黑体 4 万+ 字符）的解析/构建/落库是长时间任务：
  // 1. 通知 Tauri 存活检测跳过 busy 期，避免同步解析段被误判白屏而 reload
  // 2. 解析开始前先显示 loading 遮罩（先让一帧渲染再进入同步解析）
  await setTauriBuildBusy(true)
  try {
    await importFontLibraryFromBufferInner({
      projectStore,
      editorStore,
      characterStore,
      buffer,
      displayName,
      t,
      message,
      dialog: options.dialog,
      router,
      fromWelcome,
    })
  } finally {
    await setTauriBuildBusy(false)
  }
}

async function importFontLibraryFromBufferInner(options: ImportFontBufferOptions): Promise<void> {
  const {
    projectStore,
    editorStore,
    characterStore,
    buffer,
    displayName,
    t,
    message,
    router,
    fromWelcome,
  } = options

  projectStore.loading = true
  projectStore.loadingTotal = 1
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = t('dialogs.fontImport.parsingFont')
  await yieldToMain()

  let font: ReturnType<typeof parse> | null
  try {
    font = parse(buffer)
  } catch (e) {
    console.error('[importFont]', e)
    projectStore.loading = false
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
    message.error(t('dialogs.fontImport.parseFailed'))
    return
  }

  if (!font?.characters?.length) {
    font = null
    projectStore.loading = false
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
    message.error(t('dialogs.fontImport.emptyFont'))
    return
  }

  // 工程编辑空间固定 1000：字体 upm/ascender/descender 统一缩放到 1000
  // （字符轮廓与度量在 buildCharacterFilesFromParsedFont 中同样按此缩放；
  //  em 盒超 1000 时垂直居中，见 resolveImportFontMetrics）
  const { ascender, descender } = resolveImportFontMetrics(font.settings)
  const width = 1000
  const file: IFile = {
    uuid: genUUID(),
    width,
    height: width,
    name: displayName,
    saved: false,
    characterList: [],
    iconsCount: 0,
    fontSettings: {
      unitsPerEm: 1000,
      ascender,
      descender,
    },
  }

  // 解析后立即释放不再需要的大块原始数据：
  // CFF 的 charStringIndex（全部字形的原始字节数组）在字符生成后已无用
  const cffTable = font.tables?.find((tb: any) => tb.name === 'CFF ')?.table as any
  if (cffTable?.charStringIndex) {
    cffTable.charStringIndex = null
  }

  // 字形引用计数：同一 glyph 可被多个码点共用（如空格/全角空格），
  // 每个分块消费完后才释放对应 glyph 数据，避免重复引用被提前置空
  const glyphRefCount = new Map<number, number>()
  for (const c of font.characters) {
    if (typeof c.index === 'number') {
      glyphRefCount.set(c.index, (glyphRefCount.get(c.index) ?? 0) + 1)
    }
  }
  // 未被任何码点引用的 glyph（如 CFF 中大量未映射字形）立即释放
  const outlineTables: any[] = ['glyf', 'CFF ']
    .map((name) => font!.tables?.find((tb: any) => tb.name === name)?.table)
    .filter((tb: any) => tb?.glyphTables)
  for (const tb of outlineTables) {
    for (let i = 0; i < tb.glyphTables.length; i++) {
      if (!glyphRefCount.has(i)) tb.glyphTables[i] = null
    }
  }
  const releaseGlyphs = (characters: any[]) => {
    for (const c of characters) {
      if (typeof c.index !== 'number') continue
      const remaining = (glyphRefCount.get(c.index) ?? 1) - 1
      if (remaining <= 0) {
        glyphRefCount.delete(c.index)
        for (const tb of outlineTables) {
          if (c.index < tb.glyphTables.length) tb.glyphTables[c.index] = null
        }
      } else {
        glyphRefCount.set(c.index, remaining)
      }
    }
  }

  projectStore.addFile(file)
  try {
    await loadDecompositionData()
  } catch (e) {
    console.error('[decomposition] font import prewarm failed', e)
  }
  projectStore.selectFile(file.uuid)
  editorStore.setEditStatus(EditStatus.CharacterList)
  characterStore.resetEditCharacterFile()

  if (router.currentRoute.value.name === 'welcome' || fromWelcome) {
    router.push('/editor')
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(), 100)
      })
    })
  }

  const totalChars = font.characters.length
  projectStore.loadingTotal = Math.max(1, totalChars)
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = t('dialogs.fontImport.importingProgress')
  await yieldToMain()

  // 分块构建 + 分块落库：
  // - splice 逐块取出字符，构建后即写入 IndexedDB，随后释放本块引用
  // - 峰值内存 ≈ 解析结果 + 单块字符文件（大字符集下不再同时持有全部 4 万+ 字符文件）
  // - 进度条覆盖构建与保存两个阶段，不再出现长时间无进度
  const CHUNK = 200
  const metadataList: ICharacterFileMetadata[] = []
  let consumed = 0

  const cleanupLoading = () => {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }

  try {
    while (font && font.characters.length > 0) {
      const batch = font.characters.splice(0, CHUNK)
      const batchLen = batch.length
      projectStore.loadingMessage = t('dialogs.fontImport.importingProgress')
      const built = await buildCharacterFilesFromParsedFont(
        { characters: batch, settings: font.settings },
        width,
      )
      // 本块字符文件已构建完成，解析数据不再需要，按引用计数释放
      releaseGlyphs(batch)
      batch.length = 0

      if (built.length > 0) {
        projectStore.loadingMessage = t('dialogs.fontImport.storingCharacters')
        await characterDataManager.storeCharacters(file.uuid, built, (done, total) => {
          // 块内进度：构建与保存统一按已消费字符数折算
          const chunkProgress = consumed + Math.round((done / Math.max(1, total)) * built.length)
          projectStore.loadingProgress = chunkProgress
          projectStore.loadingTotal = Math.max(1, totalChars)
        })
        metadataList.push(
          ...built.map((c) => ({
            uuid: c.uuid,
            type: c.type,
            character: c.character,
          })),
        )
      }
      consumed += batchLen
      projectStore.loadingProgress = consumed
      await yieldToMain()
    }
  } catch (e) {
    console.error('[importFont] build/store characters', e)
    projectStore.removeFile(file.uuid)
    cleanupLoading()
    message.error(t('dialogs.fontImport.storeFailed'))
    return
  } finally {
    // 解析结果（字体文件 buffer、表数据等）全部释放
    font = null
  }

  if (metadataList.length === 0) {
    projectStore.removeFile(file.uuid)
    cleanupLoading()
    message.error(t('dialogs.fontImport.emptyFont'))
    return
  }

  const target = projectStore.files.find((f) => f.uuid === file.uuid)
  if (target) {
    target.characterList = metadataList
    target.iconsCount = metadataList.length
    projectStore.markFileUnsaved(file.uuid)
  }

  cleanupLoading()

  characterStore.characterListVersion++
  message.success(t('dialogs.fontImport.importSuccess'))
}

export function pickFontBufferWeb(): Promise<{ buffer: ArrayBuffer; displayName: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.otf,.ttf,application/font-sfnt,font/ttf,font/otf'
    input.style.display = 'none'
    input.addEventListener('change', async () => {
      try {
        const f = input.files?.[0]
        if (!f) {
          resolve(null)
          return
        }
        const full = f.name
        const dot = full.lastIndexOf('.')
        const displayName = dot > 0 ? full.slice(0, dot) : full
        const buffer = await f.arrayBuffer()
        resolve({ buffer, displayName })
      } catch {
        resolve(null)
      } finally {
        input.remove()
      }
    })
    document.body.appendChild(input)
    input.click()
  })
}

export async function pickFontBufferTauri(): Promise<{ buffer: ArrayBuffer; displayName: string } | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const picked = await open({
    multiple: false,
    filters: [{ name: 'Font', extensions: ['otf', 'ttf'] }],
  })
  if (picked == null) return null
  const filePath =
    typeof picked === 'string'
      ? picked
      : Array.isArray(picked)
        ? picked[0] ?? null
        : (picked as { path?: string }).path ?? null
  if (!filePath) return null

  const bytes = await readFile(filePath)
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer)
  const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)

  const seg = filePath.replace(/\\/g, '/').split('/').pop() ?? 'imported'
  const dot = seg.lastIndexOf('.')
  const displayName = dot > 0 ? seg.slice(0, dot) : seg

  return { buffer, displayName }
}

/**
 * 侧栏 / 菜单：按环境弹出文件选择并导入
 */
export async function runFontLibraryImportPicker(
  stores: FontImportStores,
  i18n: FontImportI18n,
): Promise<void> {
  const { projectStore } = stores
  if (fontImportBlockedByOpenProject(projectStore)) {
    showFontImportSingleProjectWarning(i18n)
    return
  }

  let picked: { buffer: ArrayBuffer; displayName: string } | null = null
  try {
    if (isTauri()) {
      picked = await pickFontBufferTauri()
    } else {
      picked = await pickFontBufferWeb()
    }
  } catch (e) {
    console.error('[importFont] pick/read', e)
    i18n.message.error(i18n.t('dialogs.fontImport.readFailed'))
    return
  }

  if (!picked) return

  await importFontLibraryFromBuffer({
    ...stores,
    ...i18n,
    buffer: picked.buffer,
    displayName: picked.displayName,
    fromWelcome: false,
  })
}
