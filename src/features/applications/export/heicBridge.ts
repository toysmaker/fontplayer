import { getEnv, isTauri } from '@/utils/env'
import { renderAppVideoFrame } from '../video/compose'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { sanitizeFilename } from './imageExport'

/**
 * macOS 动态壁纸 .heic 导出桥：
 * - 前端渲染浅色/深色两帧 → PNG 字节 → invoke Rust ImageIO 命令
 * - 非 macOS / 非 Tauri 环境不可用（UI 隐藏该选项）
 */

export function heicExportSupported(): boolean {
  return isTauri() && /Mac/i.test(navigator.platform || navigator.userAgent)
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('toBlob failed'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

/** 渲染浅色帧 + 深色帧（同一画面压暗，作为外观切换的变体） */
async function renderWallpaperFrames(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary
): Promise<{ light: Uint8Array; dark: Uint8Array }> {
  const canvas = document.createElement('canvas')
  canvas.width = video.width
  canvas.height = video.height
  await renderAppVideoFrame(canvas, video, cardData, library, 0)
  const light = await canvasToPngBytes(canvas)

  // 深色变体：画面整体压暗
  const darkCanvas = document.createElement('canvas')
  darkCanvas.width = canvas.width
  darkCanvas.height = canvas.height
  const ctx = darkCanvas.getContext('2d')!
  ctx.drawImage(canvas, 0, 0)
  ctx.fillStyle = 'rgba(10, 12, 18, 0.72)'
  ctx.fillRect(0, 0, darkCanvas.width, darkCanvas.height)
  const dark = await canvasToPngBytes(darkCanvas)

  return { light, dark }
}

export async function exportMacWallpaperHeic(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  name: string
): Promise<boolean> {
  if (getEnv() !== 'tauri') return false
  const { invoke } = await import('@tauri-apps/api/core')
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({ defaultPath: `${sanitizeFilename(name || video.name || 'wallpaper')}.heic` })
  if (path == null) return false
  const target = typeof path === 'string' ? path : (path as { path: string }).path

  const { light, dark } = await renderWallpaperFrames(video, cardData, library)
  await invoke('export_dynamic_wallpaper_heic', {
    path: target,
    frames: [
      { data: Array.from(light), is_light: true, is_primary: true, solar: null, azimuth: null },
      { data: Array.from(dark), is_light: false, is_primary: false, solar: null, azimuth: null },
    ],
  })
  return true
}
