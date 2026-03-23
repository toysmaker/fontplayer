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
 * 将解析后的 font 转为字符文件列表（完整 lite，用于写入 IDB）
 */
export async function buildCharacterFilesFromParsedFont(
  font: { characters: any[]; settings: { unitsPerEm?: number; descender?: number } },
  gridWidth: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ICharacterFileLite[]> {
  const unitsPerEm = font.settings.unitsPerEm ?? 1000
  const descender = font.settings.descender ?? -200
  const list: ICharacterFileLite[] = []
  const total = font.characters.length

  for (let j = 0; j < font.characters.length; j++) {
    const character = font.characters[j]
    if (!character.unicode && !character.name) continue

    const characterComponent = {
      uuid: genUUID(),
      text: character.unicode ? String.fromCharCode(character.unicode) : String(character.name ?? ''),
      unicode: character.unicode ? character.unicode.toString(16).padStart(4, '0') : '',
    }
    const uuid = genUUID()
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
      info: makeGridInfo(gridWidth),
      script: `function script_${uuid.replaceAll('-', '_')} (character, constants, FP) {\n\t//Todo something\n}`,
    }

    const advanceWidth =
      typeof character.advanceWidth === 'number' ? character.advanceWidth : gridWidth

    const components = ContourConverter.contoursToComponents(character.contours ?? [], {
      unitsPerEm,
      descender,
      advanceWidth,
    })
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

  let font: ReturnType<typeof parse>
  try {
    font = parse(buffer)
  } catch (e) {
    console.error('[importFont]', e)
    message.error(t('dialogs.fontImport.parseFailed'))
    return
  }

  if (!font?.characters?.length) {
    message.error(t('dialogs.fontImport.emptyFont'))
    return
  }

  const width = font.settings.unitsPerEm as number
  const file: IFile = {
    uuid: genUUID(),
    width,
    height: width,
    name: displayName,
    saved: false,
    characterList: [],
    iconsCount: 0,
    fontSettings: {
      unitsPerEm: font.settings.unitsPerEm as number,
      ascender: font.settings.ascender as number,
      descender: font.settings.descender as number,
    },
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

  const totalGlyphs = font.characters.length
  projectStore.loading = true
  projectStore.loadingTotal = Math.max(1, totalGlyphs)
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = t('dialogs.fontImport.importingProgress')

  await yieldToMain()

  let built: ICharacterFileLite[]
  try {
    built = await buildCharacterFilesFromParsedFont(font, width, (done, tot) => {
      projectStore.loadingProgress = done
      projectStore.loadingTotal = Math.max(1, tot)
    })
  } catch (e) {
    console.error('[importFont] build characters', e)
    projectStore.removeFile(file.uuid)
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
    message.error(t('dialogs.fontImport.parseFailed'))
    return
  }

  if (built.length === 0) {
    projectStore.removeFile(file.uuid)
    projectStore.loading = false
    message.error(t('dialogs.fontImport.emptyFont'))
    return
  }

  projectStore.loadingMessage = t('dialogs.fontImport.storingCharacters')

  try {
    await characterDataManager.storeCharacters(file.uuid, built)
  } catch (e) {
    console.error('[importFont] IDB store', e)
    projectStore.removeFile(file.uuid)
    projectStore.loading = false
    message.error(t('dialogs.fontImport.storeFailed'))
    return
  }

  const metadataList: ICharacterFileMetadata[] = built.map((c) => ({
    uuid: c.uuid,
    type: c.type,
    character: c.character,
  }))

  const target = projectStore.files.find((f) => f.uuid === file.uuid)
  if (target) {
    target.characterList = metadataList
    target.iconsCount = metadataList.length
    projectStore.markFileUnsaved(file.uuid)
  }

  projectStore.loading = false
  projectStore.loadingProgress = 0
  projectStore.loadingTotal = 0
  projectStore.loadingMessage = ''

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
