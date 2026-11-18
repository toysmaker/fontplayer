import { getEnv } from '@/utils/env'
import { saveAs } from 'file-saver'
import { renderAppCanvas } from '../canvas/AppCanvasRenderer'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData } from '../types'

export type AppImageFormat = 'png' | 'jpeg' | 'webp'

/** 检测当前环境是否支持 webp 编码 */
export function supportsWebp(): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

/** 在应用画布分辨率下渲染并编码为图片 Blob */
export async function renderAppImageBlob(
  data: ICardAppData,
  library: FontLibrary,
  format: AppImageFormat,
  quality = 0.92
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  await renderAppCanvas(canvas, data, library)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob failed'))
      },
      `image/${format}`,
      format === 'png' ? undefined : quality
    )
  })
}

const EXTENSION: Record<AppImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

/** 任意画布编码为图片 Blob */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: AppImageFormat,
  quality = 0.92
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob failed'))
      },
      `image/${format}`,
      format === 'png' ? undefined : quality
    )
  })
}

/** 保存 Blob 到磁盘：Tauri 用保存对话框 + plugin-fs；web 用 file-saver */
export async function saveBlobToDisk(blob: Blob, filename: string): Promise<boolean> {
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

/** 一键导出应用画布图片 */
export async function exportAppImage(
  data: ICardAppData,
  library: FontLibrary,
  name: string,
  format: AppImageFormat,
  quality = 0.92
): Promise<boolean> {
  const blob = await renderAppImageBlob(data, library, format, quality)
  return saveBlobToDisk(blob, `${sanitizeFilename(name)}.${EXTENSION[format]}`)
}
