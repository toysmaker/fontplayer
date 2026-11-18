import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { renderAppVideoFrame } from '../video/compose'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { videoTotalDuration } from '../video/videoData'

export function webcodecsMp4Supported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window
}

// WebCodecs 类型不在 TS 标准 lib 中，这里做最小化声明
interface MinimalVideoEncoder {
  configure: (config: Record<string, unknown>) => void
  encode: (frame: unknown, opts?: { keyFrame?: boolean }) => void
  flush: () => Promise<void>
  close: () => void
}

interface MinimalVideoEncoderInit {
  output: (chunk: unknown, meta: unknown) => void
  error: (e: Error) => void
}

type VideoEncoderCtor = new (init: MinimalVideoEncoderInit) => MinimalVideoEncoder
type VideoFrameCtor = new (
  source: HTMLCanvasElement,
  init: { timestamp: number; duration?: number }
) => unknown

/**
 * WebCodecs VideoEncoder (H.264) + mp4-muxer 导出真实 MP4。
 * 无需实时节奏，按 CPU 速度逐帧编码（Chromium 与 Safari 16.4+ 均支持）。
 */
export async function exportMp4WebCodecs(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  opts: { onProgress?: (done: number, total: number) => void } = {}
): Promise<Blob> {
  const fps = video.fps || 30
  const duration = videoTotalDuration(video)
  const totalFrames = Math.max(1, Math.ceil(duration * fps))
  const rawWidth = Math.max(2, video.width)
  const rawHeight = Math.max(2, video.height)
  // H.264 要求偶数尺寸
  const width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1
  const height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  })

  let encodeError: Error | null = null
  const EncoderCtor = (window as unknown as { VideoEncoder: VideoEncoderCtor }).VideoEncoder
  const encoder = new EncoderCtor({
    output: (chunk, meta) => muxer.addVideoChunk(chunk as never, meta as never),
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e))
    },
  })

  encoder.configure({
    codec: 'avc1.42001f',
    width,
    height,
    bitrate: 4_000_000,
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      await renderAppVideoFrame(canvas, video, cardData, library, frame / fps)
      const FrameCtor = (window as unknown as { VideoFrame: VideoFrameCtor }).VideoFrame
      const videoFrame = new FrameCtor(canvas, {
        timestamp: Math.round((frame / fps) * 1_000_000),
        duration: Math.round(1_000_000 / fps),
      })
      encoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 })
      ;(videoFrame as { close: () => void }).close()
      opts.onProgress?.(frame + 1, totalFrames)
    }
    await encoder.flush()
  } finally {
    try {
      encoder.close()
    } catch {
      // 已关闭
    }
  }

  if (encodeError) throw encodeError
  muxer.finalize()
  const { buffer } = muxer.target as ArrayBufferTarget
  return new Blob([buffer], { type: 'video/mp4' })
}
