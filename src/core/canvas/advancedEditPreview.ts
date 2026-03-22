/**
 * 高级编辑 / 列表轻量预览：将轮廓画到 canvas（对齐原 renderPreview2）
 */

import type { IContours } from '@/core/font/types'
import { PathType } from '@/core/font/types'

export function renderAdvancedEditPreview(
  canvas: HTMLCanvasElement,
  contours: IContours,
  fillColors: string[] = [],
  fontPreviewStyle: 'black' | 'color' = 'black',
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (fontPreviewStyle === 'black') {
    ctx.beginPath()
  }

  for (let i = 0; i < contours.length; i++) {
    const contour = contours[i]
    if (!contour?.length) continue

    if (fontPreviewStyle === 'color') {
      ctx.beginPath()
    }

    ctx.moveTo(contour[0].start.x, contour[0].start.y)
    for (let j = 0; j < contour.length; j++) {
      const path = contour[j]
      if (path.type === PathType.LINE) {
        ctx.lineTo(path.end.x, path.end.y)
      } else if (path.type === PathType.CUBIC_BEZIER) {
        ctx.bezierCurveTo(
          path.control1.x,
          path.control1.y,
          path.control2.x,
          path.control2.y,
          path.end.x,
          path.end.y,
        )
      } else if (path.type === PathType.QUADRATIC_BEZIER) {
        ctx.quadraticCurveTo(path.control.x, path.control.y, path.end.x, path.end.y)
      }
    }

    if (fontPreviewStyle === 'color') {
      ctx.closePath()
      ctx.fillStyle = fillColors[i] || '#000'
      ctx.fill('nonzero')
    }
  }

  if (fontPreviewStyle === 'black') {
    ctx.closePath()
    ctx.fillStyle = '#000'
    ctx.fill('nonzero')
  }
}
