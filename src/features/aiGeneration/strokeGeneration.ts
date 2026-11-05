/**
 * AI 笔画生成管线 — demo6 模型
 *
 * 流程 (与 importTemplate3 的「PNG → 轮廓 → 骨架绑定」一致, PNG 来源换成模型输出):
 *   五边形权重/随机 → 风格向量 z → 批量推理 32 张骨架 → 32 张笔画图
 *   → traceHandDrawnImageToPenComponents 轮廓识别
 *   → createBaseGlyph + handDrawnTemplateParameters + skeleton{type,ox,oy}
 *   → instanceBasicGlyph + bindSkeletonGlyph (LBS 骨架绑定)
 *   → 推入 file.stroke_glyphs (style=用户输入或 自定义笔画N)
 */
import * as ort from 'onnxruntime-web'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { instanceManager } from '@/core/instance/InstanceManager'
import { PictureImportPipelineService } from '@/features/editor/services/PictureImportPipelineService'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { hei_strokes } from '@/templates/strokes_1'
import {
  appendPenComponentsToGlyph,
  createBaseGlyph,
  ensureStrokeGlyphs,
  handDrawnTemplateParameters,
} from '@/features/editor/menus/templatesHandlers'
import { getAiSession } from './modelLoader'
import { sampleCtrlStroke, sampleRandomStroke } from './stylePool'
import {
  broadcastStyleVec,
  canvasToImage,
  loadPngAlphaMask,
  outputTensorToCanvas,
  stackMasks,
} from './tensorUtils'

const STROKE_IMAGE_SIZE = 256
const EM_SIZE = 1000

const AI_BASE = `${import.meta.env.BASE_URL || '/'}models/ai/`

function aiUrl(path: string): string {
  const base = AI_BASE.endsWith('/') ? AI_BASE : `${AI_BASE}/`
  return `${base}${path}`
}

export interface StrokeGenOptions {
  /** 风格名 (空则自动生成 自定义笔画（N）) */
  styleName: string
  /** 五边形五权重 黑/宋/楷/仿/隶 ∈[0,1] (randomMode 时忽略) */
  weights?: number[]
  /** 随机模式 (demo6 random: 随机质心 + 全局协方差噪声) */
  randomMode: boolean
  /** processing 阶段 (逐笔画轮廓识别+绑定) 的进度回调 */
  onProgress?: (done: number, total: number) => void
  /** 阶段回调: inference=风格采样+批量推理, processing=轮廓识别+骨架绑定 */
  onPhase?: (phase: 'inference' | 'processing') => void
}

/** 计算下一个 自定义笔画（N）: 扫描已有 style 字段取最大序号 + 1 */
export function nextCustomStrokeStyleName(existingStyles: (string | undefined)[]): string {
  let maxSeq = 0
  for (const s of existingStyles) {
    if (!s) continue
    const m = /^自定义笔画（(\d+)）$/.exec(s)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxSeq) maxSeq = n
    }
  }
  return `自定义笔画（${maxSeq + 1}）`
}

/** 32 张黑体骨架掩码 (一次加载后模块级缓存) */
let _skeletonMasks: Promise<Map<string, Float32Array>> | null = null

function loadSkeletonMasks(): Promise<Map<string, Float32Array>> {
  if (!_skeletonMasks) {
    _skeletonMasks = (async () => {
      const masks = new Map<string, Float32Array>()
      for (const s of hei_strokes) {
        const mask = await loadPngAlphaMask(
          aiUrl(`stroke_skeletons/${encodeURIComponent(s.name)}.png`),
          STROKE_IMAGE_SIZE,
        )
        masks.set(s.name, mask)
      }
      return masks
    })()
  }
  return _skeletonMasks
}

/** 批量推理: 32 张骨架 + 1 个风格向量 → 32 张笔画图 */
async function runStrokeInference(z: Float32Array): Promise<Float32Array> {
  // 让出主线程: 缓存全命中时推理前的微任务链会阻塞 UI 绘制 (spinner/进度)
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  const masks = await loadSkeletonMasks()
  const names = hei_strokes.map((s) => s.name)
  const { data, dims } = stackMasks(
    names.map((n) => masks.get(n)!),
    STROKE_IMAGE_SIZE,
  )
  const session = await getAiSession('stroke')
  const feeds = {
    skeleton: new ort.Tensor('float32', data, dims),
    style_vec: new ort.Tensor('float32', broadcastStyleVec(z, names.length), [names.length, z.length]),
  }
  const results = await session.run(feeds)
  return results['stroke'].data as Float32Array
}

/** 生成中标志: 防止并发重复生成 (对话框 disabled + 防抖之外的最后一道防线) */
let _generating = false

/** 生成 32 个已绑定标准骨架的笔画字形并加入当前工程 */
export async function generateStrokeGlyphs(options: StrokeGenOptions): Promise<number> {
  if (_generating) throw new Error('笔画生成已在进行中')
  _generating = true
  try {
    return await _generateStrokeGlyphs(options)
  } finally {
    _generating = false
  }
}

async function _generateStrokeGlyphs(options: StrokeGenOptions): Promise<number> {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) throw new Error('没有打开的项目')

  ensureStrokeGlyphs(file)
  const styleName =
    options.styleName.trim() || nextCustomStrokeStyleName((file.stroke_glyphs || []).map((g) => g.style))

  options.onPhase?.('inference')
  const z = options.randomMode
    ? await sampleRandomStroke()
    : await sampleCtrlStroke(options.weights ?? [])

  const output = await runStrokeInference(z)
  const names = hei_strokes.map((s) => s.name)
  const total = names.length

  options.onPhase?.('processing')
  for (let i = 0; i < total; i++) {
    const name = names[i]
    options.onProgress?.(i + 1, total)

    // 模型输出 → 二值 → 1000×1000 画布 → 轮廓识别
    const single = output.subarray(
      i * STROKE_IMAGE_SIZE * STROKE_IMAGE_SIZE,
      (i + 1) * STROKE_IMAGE_SIZE * STROKE_IMAGE_SIZE,
    )
    const canvas = outputTensorToCanvas(single, STROKE_IMAGE_SIZE, EM_SIZE, 0.5)
    const img = await canvasToImage(canvas)
    const components = PictureImportPipelineService.traceHandDrawnImageToPenComponents(img, {
      importEmWidth: EM_SIZE,
      importEmHeight: EM_SIZE,
      thumbnailMax: EM_SIZE,
    })

    // 字形构建 + 标准骨架绑定 (复刻 importTemplate3)
    const glyph = createBaseGlyph(name, styleName, '', [])
    appendPenComponentsToGlyph(glyph, components)

    const strokeDef = hei_strokes.find((s) => s.name === name)
    if (strokeDef) {
      glyph.parameters = handDrawnTemplateParameters(strokeDef)
    }
    glyph.skeleton = {
      type: name,
      ox: 0,
      oy: 0,
      dynamicWeight: false,
    }

    const strokeFn = strokeFnMap[name as keyof typeof strokeFnMap]
    if (strokeFn) {
      const inst = instanceManager.acquireTemporaryInstance(
        glyph.uuid,
        () => new CustomGlyph(glyph),
        'glyph',
      ) as CustomGlyph
      try {
        strokeFn.instanceBasicGlyph(glyph, inst)
        strokeFn.bindSkeletonGlyph(glyph)
        strokeFn.updateSkeletonListenerAfterBind(inst)
      } finally {
        instanceManager.releaseTemporaryInstance(glyph.uuid)
      }
    } else if (import.meta.env.DEV) {
      console.warn(`[aiGeneration] strokeFnMap 中无笔画类型: ${name}`)
    }

    file.stroke_glyphs!.push(glyph)
  }

  projectStore.markFileUnsaved(file.uuid)
  editorStore.setEditStatus(EditStatus.StrokeGlyphList)
  return total
}
