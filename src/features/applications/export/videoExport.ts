import { getEnv } from '@/utils/env'
import { saveAs } from 'file-saver'
import { renderAppVideoFrame } from '../video/compose'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { videoTotalDuration } from '../video/videoData'
import { exportMp4WebCodecs, webcodecsMp4Supported } from './webcodecsMp4Export'
import { buildAppVideoPlayerHtml } from './htmlExport'
import { sanitizeFilename } from './imageExport'

export type AppVideoExportFormat = 'mp4' | 'webm' | 'html'

export interface ExportAppVideoOptions {
  onProgress?: (done: number, total: number) => void
}

/** 媒体能力检测 */
export function videoCapabilities(): {
  webcodecs: boolean
  mp4Mime: string | null
  webmMime: string | null
} {
  const result = {
    webcodecs: webcodecsMp4Supported(),
    mp4Mime: null as string | null,
    webmMime: null as string | null,
  }
  if (typeof MediaRecorder !== 'undefined') {
    const mp4Candidates = ['video/mp4;codecs=avc1', 'video/mp4']
    const webmCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    for (const c of mp4Candidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        result.mp4Mime = c
        break
      }
    }
    for (const c of webmCandidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        result.webmMime = c
        break
      }
    }
  }
  return result
}

/** 所选格式在当前环境的可用性（mp4 需要 WebCodecs 或原生 mp4 MediaRecorder） */
export function formatSupported(format: AppVideoExportFormat): boolean {
  if (format === 'html') return true
  const caps = videoCapabilities()
  if (format === 'mp4') return caps.webcodecs || caps.mp4Mime !== null
  return caps.webmMime !== null
}

/** MediaRecorder 兜底路径（实时节奏录制，参照动画导出 exporters.ts 模式） */
async function exportWithMediaRecorder(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  format: 'mp4' | 'webm',
  opts: ExportAppVideoOptions
): Promise<Blob> {
  const fps = video.fps || 30
  const duration = videoTotalDuration(video)
  const totalFrames = Math.max(1, Math.ceil(duration * fps))
  const caps = videoCapabilities()
  const mime = format === 'mp4' ? caps.mp4Mime : caps.webmMime
  if (!mime) throw new Error(`unsupported:${format}`)

  const canvas = document.createElement('canvas')
  canvas.width = video.width
  canvas.height = video.height

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
  await new Promise<void>((r) => setTimeout(r, 50))

  for (let frame = 0; frame < totalFrames; frame++) {
    await renderAppVideoFrame(canvas, video, cardData, library, frame / fps)
    opts.onProgress?.(frame + 1, totalFrames)
    await new Promise<void>((r) => setTimeout(r, 1000 / fps))
  }

  recorder.stop()
  await stopped
  stream.getTracks().forEach((tr) => tr.stop())
  if (chunks.length === 0) throw new Error('recorder:no-data')
  return new Blob(chunks, { type: mime.split(';')[0] })
}

/** 导出组合视频（格式：mp4 / webm / html） */
export async function exportAppVideo(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  format: AppVideoExportFormat,
  opts: ExportAppVideoOptions = {}
): Promise<Blob> {
  if (format === 'html') {
    const html = buildAppVideoPlayerHtml(video, cardData, library)
    return new Blob([html], { type: 'text/html' })
  }
  if (format === 'mp4') {
    const caps = videoCapabilities()
    if (caps.webcodecs) {
      return exportMp4WebCodecs(video, cardData, library, opts)
    }
    if (caps.mp4Mime) {
      return exportWithMediaRecorder(video, cardData, library, 'mp4', opts)
    }
    throw new Error('unsupported:mp4')
  }
  return exportWithMediaRecorder(video, cardData, library, 'webm', opts)
}

const EXTENSION: Record<AppVideoExportFormat, string> = {
  mp4: 'mp4',
  webm: 'webm',
  html: 'html',
}

/** 一键导出视频到磁盘 */
export async function exportAppVideoToDisk(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  format: AppVideoExportFormat,
  onProgress?: (done: number, total: number) => void
): Promise<boolean> {
  const blob = await exportAppVideo(video, cardData, library, format, { onProgress })
  const filename = `${sanitizeFilename(video.name || 'video')}.${EXTENSION[format]}`
  if (getEnv() === 'tauri') {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename })
    if (path == null) return false
    const target = typeof path === 'string' ? path : (path as { path: string }).path
    await writeFile(target, new Uint8Array(await blob.arrayBuffer()))
    return true
  }
  saveAs(blob, filename)
  return true
}
