import { renderClipFrameAt } from '@/features/animation/vectorRender'
import { getCharacterMetrics } from '@/features/animation/render'
import { renderAppCanvas } from '../canvas/AppCanvasRenderer'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument, IAppVideoTrack } from '../types'
import { activePlacedClipAt } from './videoData'

/**
 * 组合视频帧合成：渲染整个应用画布
 * - 背景/图片/组件照常渲染
 * - 有活动剪辑的字符：在布局位置上播放动效帧（renderClipFrameAt）
 * - 无动效字符：用字库静态渲染（fillText）
 */

const clipCanvasCache = new Map<string, HTMLCanvasElement>()

function getClipCanvas(key: string, size: number): HTMLCanvasElement {
  let canvas = clipCanvasCache.get(key)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    clipCanvasCache.set(key, canvas)
  }
  return canvas
}

export interface ActiveTrackInfo {
  track: IAppVideoTrack
  charText: string
  canvas: HTMLCanvasElement
}

/**
 * 计算时间 time 下所有活动轨道，并把每轨动效帧渲染到离屏 canvas。
 */
export function renderActiveTracks(
  video: IAppVideoDocument,
  time: number
): ActiveTrackInfo[] {
  const metrics = getCharacterMetrics()
  const renderSize = Math.min(metrics.unitsPerEm || 1000, 1024)
  const result: ActiveTrackInfo[] = []
  for (const track of video.tracks) {
    if (!track.layoutPosition) continue
    const active = activePlacedClipAt(track, video.snapshots, time)
    if (!active) continue
    const canvas = getClipCanvas(`${track.charUuid}-${active.placed.clipId}`, renderSize)
    // 透明背景：卡片上叠加的动效不应带字符编辑画布的白底；
    // 渲染模式按视频自身设置（与预览模式解耦）
    renderClipFrameAt(
      active.snapshot.char,
      active.snapshot.clip,
      active.localTime,
      canvas,
      undefined,
      true,
      active.snapshot.clip.renderStyle
    )
    result.push({ track, canvas, charText: active.snapshot.char.character?.text ?? track.label })
  }
  return result
}

/**
 * 渲染组合视频的某一帧到目标画布（目标画布分辨率 = 视频分辨率）。
 */
export async function renderAppVideoFrame(
  targetCanvas: HTMLCanvasElement,
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  time: number
): Promise<void> {
  const activeTracks = renderActiveTracks(video, time)
  const animatedChars = new Set(activeTracks.map((a) => a.charText))

  await renderAppCanvas(targetCanvas, cardData, library, { animatedChars })

  const ctx = targetCanvas.getContext('2d')
  if (!ctx) return

  // 有活动剪辑的字符：在布局位置绘制动效帧（em 方框缩放为 fontSize）
  for (const { track, canvas } of activeTracks) {
    const pos = track.layoutPosition
    if (!pos) continue
    ctx.drawImage(canvas, pos.x, pos.y, pos.fontSize, pos.fontSize)
  }
}
