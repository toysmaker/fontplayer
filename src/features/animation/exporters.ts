/**
 * 动效导出：mp4 / gif / webm / lottieJson
 *
 * - mp4/webm：矢量渲染（编辑管线）逐帧绘制到 2D canvas → captureStream + MediaRecorder
 * - gif：逐帧矢量渲染 → 灰度读回 → 流式 LZW GIF 编码（不缓存全部原始帧）
 * - lottieJson：见 lottieExporter（矢量，按关键帧交叉淡化）
 *
 * 渲染样式与编辑页面一致（fontRenderStyle：轮廓/黑白/彩色）。
 * 导出分辨率为 unitsPerEm。无 WebGL；逐帧克隆/实例即时释放。
 */

import type { IAnimationClip, ICharacterFileLite } from '@/core/types'
import { getCharacterMetrics, type SdfMetrics } from './render'
import { renderClipFrameAt } from './vectorRender'
import { createGifWriter } from './gifEncoder'
import { buildLottieJson } from './lottieExporter'
import { fontRenderStyle } from '@/core/script/globals'

export type ExportFormat = 'mp4' | 'gif' | 'webm' | 'lottie'

export interface ExportClipOptions {
  clip: IAnimationClip
  /** 基础字符（关键帧只存参数增量） */
  char: ICharacterFileLite
  format: ExportFormat
  onProgress?: (done: number, total: number) => void
}

function pickVideoMime(format: 'mp4' | 'webm'): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates =
    format === 'mp4'
      ? ['video/mp4;codecs=avc1', 'video/mp4']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return null
}

export async function exportAnimationClip(opts: ExportClipOptions): Promise<Blob> {
  const { clip, char, format } = opts
  const metrics: SdfMetrics = getCharacterMetrics()
  const fps = clip.fps || 30
  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
  if (kfs.length === 0) throw new Error('no keyframes')
  const firstTime = kfs[0].time
  const duration = Math.max(0, kfs[kfs.length - 1].time - firstTime)
  const totalFrames = Math.max(1, Math.ceil(duration * fps))

  if (format === 'lottie') {
    return new Blob(
      [
        buildLottieJson({
          clip,
          char,
          metrics,
          style: fontRenderStyle.value as 'contour' | 'black' | 'color',
          onProgress: opts.onProgress,
        }),
      ],
      { type: 'application/json' },
    )
  }

  // 画布分辨率 = unitsPerEm（上限 1024，防止极端 em 值导致内存压力）
  const renderSize = Math.min(metrics.unitsPerEm || 1000, 1024)
  const frameTime = (frame: number) => firstTime + frame / fps

  if (format === 'gif') {
    const canvas = document.createElement('canvas')
    canvas.width = renderSize
    canvas.height = renderSize
    const ctx2 = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx2) throw new Error('canvas 2d unavailable')
    const writer = createGifWriter(renderSize, renderSize, 100 / fps)
    for (let frame = 0; frame < totalFrames; frame++) {
      renderClipFrameAt(char, clip, frameTime(frame), canvas)
      const img = ctx2.getImageData(0, 0, renderSize, renderSize)
      const gray = new Uint8Array(renderSize * renderSize)
      for (let p = 0; p < gray.length; p++) {
        // 黑字形 + 白背景：alpha 覆盖度 → 灰度
        gray[p] = 255 - img.data[p * 4 + 3]
      }
      writer.writeFrame(gray)
      opts.onProgress?.(frame + 1, totalFrames)
      // 让出事件循环，避免长时间阻塞 UI
      if (frame % 8 === 7) await new Promise<void>((r) => setTimeout(r, 0))
    }
    return new Blob([writer.finish()], { type: 'image/gif' })
  }

  // mp4 / webm：MediaRecorder
  const mime = pickVideoMime(format)
  if (!mime) throw new Error(`unsupported:${format}`)
  const canvas = document.createElement('canvas')
  canvas.width = renderSize
  canvas.height = renderSize
  const ctx2 = canvas.getContext('2d')
  if (!ctx2) throw new Error('canvas 2d unavailable')
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  recorder.start(100)
  // 录制第一帧后再开始逐帧渲染
  await new Promise<void>((r) => setTimeout(r, 50))

  for (let frame = 0; frame < totalFrames; frame++) {
    renderClipFrameAt(char, clip, frameTime(frame), canvas)
    opts.onProgress?.(frame + 1, totalFrames)
    await new Promise<void>((r) => setTimeout(r, 1000 / fps))
  }
  recorder.stop()
  await stopped
  stream.getTracks().forEach((tr) => tr.stop())
  if (chunks.length === 0) throw new Error('recorder:no-data')
  return new Blob(chunks, { type: mime.split(';')[0] })
}
