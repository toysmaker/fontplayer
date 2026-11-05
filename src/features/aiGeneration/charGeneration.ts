/**
 * AI 字符生成管线 — demo9 模型
 *
 * 流程:
 *   输入字符 → 去重/查重 (工程中已存在则中止)
 *   → basechar 骨架懒加载 (预降采样的 128×128 二值 PNG, 内存+IndexedDB 缓存)
 *   → 风格向量 z = demo9 random 算法 (全池经验高斯 + truncation)
 *   → 批量推理 → 128×128 字形图 → 放大 1000×1000 → 轮廓识别 → 钢笔组件
 *   → ICharacterFileLite → IndexedDB → characterList → 切字符列表
 *
 * web 与 tauri 均可用 (骨架 PNG 随包分发)。
 */
import * as ort from 'onnxruntime-web'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { EditStatus, type ICharacterFileLite, type ICharacterFileMetadata, type ICharacterInfo } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { PictureImportPipelineService } from '@/features/editor/services/PictureImportPipelineService'
import { getAiSession } from './modelLoader'
import { sampleRandomChar } from './stylePool'
import { getCachedBasechar, setCachedBasechar, clearMemoryCache, getMaskSize } from './basecharCache'
import { canvasToImage, imageToAlphaMask, outputTensorToCanvas, stackMasks, broadcastStyleVec } from './tensorUtils'

const CHAR_IMAGE_SIZE = 128
const EM_SIZE = 1000
/** 与 infer.py generate 一致的批大小 */
const BATCH_SIZE = 32

const AI_BASE = `${import.meta.env.BASE_URL || '/'}models/ai/`

function aiUrl(path: string): string {
  const base = AI_BASE.endsWith('/') ? AI_BASE : `${AI_BASE}/`
  return `${base}${path}`
}

export interface CharGenOptions {
  chars: string[]
  /** processing 阶段 (逐字符轮廓识别+入库) 的进度回调 */
  onProgress?: (done: number, total: number) => void
  /** 阶段回调: inference=风格采样+骨架懒加载+批量推理, processing=轮廓识别+入库 */
  onPhase?: (phase: 'inference' | 'processing') => void
}

export interface CharGenResult {
  generated: number
  skippedNotInTemplate: string[]
}

function toUnicodeString(ch: string): string {
  return 'U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
}

function buildCharacterInfo(): ICharacterInfo {
  const size = 1000
  const css = size / 3
  return {
    gridSettings: {
      dx: 0, dy: 0, centerSquareSize: css, size, default: true,
      initialGrid: { dx: 0, dy: 0, dx1: 0, dx2: 0, dx3: 0, dx4: 0, dy1: 0, dy2: 0, dy3: 0, dy4: 0, ox: 500, oy: 500, width: 1000, height: 1000, centerSquareScale: 1 },
      currentGrid: { dx: 0, dy: 0, dx1: 0, dx2: 0, dx3: 0, dx4: 0, dy1: 0, dy2: 0, dy3: 0, dy4: 0, ox: 500, oy: 500, width: 1000, height: 1000, centerSquareScale: 1 },
    },
    useSkeletonGrid: false,
    layout: '',
    layoutTree: [],
  }
}

// ── basechar 骨架 (懒加载 + 缓存) ──────────────────────

/**
 * 字符骨架掩码: 预降采样的 128×128 二值 PNG → alpha>30 → {0,1}
 * (PNG 由 demo9/export_onnx.py 按 load_base_skeleton 的管线从 demo8 base_chars 生成)
 * 懒加载: 先查缓存, 未命中才 fetch (浏览器 HTTP 缓存 + IndexedDB)
 */
async function resolveBasecharMask(ch: string): Promise<Float32Array | null> {
  const unicode = ch.codePointAt(0)!
  const cached = await getCachedBasechar(unicode)
  if (cached) return cached

  const url = aiUrl(`basechars/${encodeURIComponent(ch)}.png`)
  const res = await fetch(url)
  if (!res.ok) return null
  const img = await loadImageFromBlob(await res.blob())
  const mask = imageToAlphaMask(img, getMaskSize())
  await setCachedBasechar(unicode, mask)
  return mask
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('骨架图片加载失败'))
    img.src = URL.createObjectURL(blob)
  })
}

// ── 生成 ──────────────────────────────────────────────

/** 批量推理: 骨架批量 + 1 个风格向量 → 字形批量 */
async function runCharInference(masks: Float32Array[], z: Float32Array): Promise<Float32Array> {
  const { data, dims } = stackMasks(masks, CHAR_IMAGE_SIZE)
  const session = await getAiSession('char')
  const feeds = {
    skeleton: new ort.Tensor('float32', data, dims),
    style_vec: new ort.Tensor('float32', broadcastStyleVec(z, masks.length), [masks.length, z.length]),
  }
  const results = await session.run(feeds)
  return results['glyph'].data as Float32Array
}

/** 生成中标志: 防止并发重复生成 (对话框 disabled + 防抖之外的最后一道防线) */
let _generating = false

/**
 * 随机生成字符并加入当前工程。
 * 任一输入字符已存在 → 抛错中止 (调用方提示用户删除后重试)。
 */
export async function generateCharGlyphs(options: CharGenOptions): Promise<CharGenResult> {
  if (_generating) throw new Error('字符生成已在进行中')
  _generating = true
  try {
    return await _generateCharGlyphs(options)
  } finally {
    _generating = false
  }
}

async function _generateCharGlyphs(options: CharGenOptions): Promise<CharGenResult> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) throw new Error('没有打开的项目')

  // 去重 (保持顺序)
  const chars = Array.from(new Set(options.chars.filter((c) => c.trim())))
  if (chars.length === 0) throw new Error('empty')

  // 工程中已存在任一字符 → 中止 (不生成任何字符)
  const existingUnicodes = new Set(file.characterList?.map((m) => m.character?.unicode) || [])
  const dupes = chars.filter((c) => existingUnicodes.has(toUnicodeString(c)))
  if (dupes.length > 0) {
    const err = new Error('duplicate') as Error & { dupes: string[] }
    ;(err as any).dupes = dupes
    throw err
  }

  options.onPhase?.('inference')

  // 风格向量 (demo9 random 模式)
  const z = await sampleRandomChar()

  const skippedNotInTemplate: string[] = []
  const readyChars: string[] = []
  const readyMasks: Float32Array[] = []
  for (const ch of chars) {
    const mask = await resolveBasecharMask(ch)
    if (!mask) {
      skippedNotInTemplate.push(ch)
      continue
    }
    readyChars.push(ch)
    readyMasks.push(mask)
  }
  if (readyChars.length === 0) {
    clearMemoryCache()
    return { generated: 0, skippedNotInTemplate }
  }

  // 分批推理
  const outputs: Float32Array[] = []
  for (let start = 0; start < readyMasks.length; start += BATCH_SIZE) {
    const chunkMasks = readyMasks.slice(start, start + BATCH_SIZE)
    const chunkOut = await runCharInference(chunkMasks, z)
    outputs.push(chunkOut)
  }

  options.onPhase?.('processing')

  const newRecords: ICharacterFileLite[] = []
  const newMetas: ICharacterFileMetadata[] = []
  const total = readyChars.length

  for (let i = 0; i < total; i++) {
    options.onProgress?.(i + 1, total)
    const ch = readyChars[i]
    const chunkIdx = Math.floor(i / BATCH_SIZE)
    const inChunk = i % BATCH_SIZE
    const out = outputs[chunkIdx]
    const single = out.subarray(
      inChunk * CHAR_IMAGE_SIZE * CHAR_IMAGE_SIZE,
      (inChunk + 1) * CHAR_IMAGE_SIZE * CHAR_IMAGE_SIZE,
    )

    // 字形图 → 1000×1000 → 轮廓识别 → 钢笔组件
    const canvas = outputTensorToCanvas(single, CHAR_IMAGE_SIZE, EM_SIZE, 0.5)
    const img = await canvasToImage(canvas)
    const components = PictureImportPipelineService.traceHandDrawnImageToPenComponents(img, {
      importEmWidth: EM_SIZE,
      importEmHeight: EM_SIZE,
      thumbnailMax: EM_SIZE,
    })

    const fuuid = genUUID()
    const cuuid = genUUID()
    const lite: ICharacterFileLite = {
      uuid: fuuid,
      type: 'text',
      character: { uuid: cuuid, text: ch, unicode: toUnicodeString(ch) },
      components: components as any,
      groups: [],
      orderedList: components.map((c) => ({ type: 'component' as const, uuid: c.uuid })),
      view: { zoom: 100, translateX: 0, translateY: 0 },
      info: buildCharacterInfo(),
      selectedComponentsTree: [],
      selectedComponentsUUIDs: [],
      script: `function script_${fuuid.replaceAll('-', '_')}(character, constants, FP) {\n\t// Todo something\n}`,
    }
    newRecords.push(lite)
    newMetas.push({ uuid: fuuid, type: 'text', character: lite.character })
  }

  // 先 IndexedDB 后 characterList (与 AddCharacterDialog 顺序一致)
  await characterDataManager.storeCharacters(file.uuid, newRecords)
  file.characterList.push(...newMetas)
  projectStore.markFileUnsaved(file.uuid)
  if (editorStore.editStatus !== EditStatus.CharacterList) {
    editorStore.setEditStatus(EditStatus.CharacterList)
  }
  window.dispatchEvent(new CustomEvent('force-character-list-refresh'))

  // 生成完成, 释放会话级骨架缓存 (IndexedDB 保留)
  clearMemoryCache()
  return { generated: total, skippedNotInTemplate }
}
