import JSZip from 'jszip'
import { getEnv } from '@/utils/env'
import { saveAs } from 'file-saver'
import { renderAppVideoFrame } from '../video/compose'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { exportAppVideo } from './videoExport'
import { buildAppVideoPlayerHtml } from './htmlExport'
import { sanitizeFilename } from './imageExport'

/**
 * Wallpaper Engine scene.pkg 导出：
 * zip 打包 project.json + preview.jpg + scene.mp4（type video）或 index.html（type web）。
 * project.json 按 Wallpaper Engine 场景 schema（实现期对照官方样例核验）。
 */

function buildScenePkgProjectJson(name: string, type: 'video' | 'web'): string {
  const project: Record<string, unknown> = {
    contentrating: 'Everyone',
    description: '',
    file: 'project.json',
    general: { properties: { clickable: false } },
    preview: 'preview.jpg',
    tags: ['Abstract'],
    title: name,
    type,
  }
  if (type === 'video') {
    project.video = 'scene.mp4'
    project.videoposter = 'preview.jpg'
  } else {
    project.file = 'index.html'
  }
  return JSON.stringify(project, null, 2)
}

export async function exportScenePkg(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  opts: {
    name: string
    /** 场景类型：video（内嵌 mp4/webm）或 web（内嵌 html 播放页） */
    sceneType?: 'video' | 'web'
    onProgress?: (done: number, total: number) => void
  } = { name: '', sceneType: 'video' }
): Promise<void> {
  const name = opts.name || video.name || 'wallpaper'
  const sceneType = opts.sceneType ?? 'video'
  const zip = new JSZip()

  // 预览图：第一帧
  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = video.width
  previewCanvas.height = video.height
  await renderAppVideoFrame(previewCanvas, video, cardData, library, 0)
  const previewBlob: Blob = await new Promise((resolve, reject) => {
    previewCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('preview toBlob failed'))), 'image/jpeg', 0.85)
  })
  zip.file('preview.jpg', previewBlob)

  zip.file('project.json', buildScenePkgProjectJson(name, sceneType))

  if (sceneType === 'web') {
    zip.file('index.html', buildAppVideoPlayerHtml(video, cardData, library))
  } else {
    // 优先 mp4（WebCodecs），否则 webm
    let format: 'mp4' | 'webm' = 'mp4'
    let blob: Blob
    try {
      blob = await exportAppVideo(video, cardData, library, 'mp4', opts)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[wallpaperPkg] mp4 failed, fallback webm:', err)
      }
      format = 'webm'
      blob = await exportAppVideo(video, cardData, library, 'webm', opts)
    }
    zip.file(`scene.${format}`, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })

  if (getEnv() === 'tauri') {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: `${sanitizeFilename(name)}.pkg` })
    if (path == null) return
    const target = typeof path === 'string' ? path : (path as { path: string }).path
    await writeFile(target, new Uint8Array(await zipBlob.arrayBuffer()))
    return
  }
  saveAs(zipBlob, `${sanitizeFilename(name)}.pkg`)
}
