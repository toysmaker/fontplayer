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

/**
 * 高级编辑放大预览：2000×2000 canvas，2x 缩放映射 1000-unit 坐标，
 * 固定黑白模式 + nonzero 填充规则。
 *
 * componentsToContours(preview:false) 会经过 formatPoints(type=1) 将坐标按 OpenType
 * 标准转换（Y 翻转 + descender 偏移），但组件原始数据已是 canvas 坐标系（Y 向下），
 * 因此此处通过 scale(2,-2) + translate 逆变换回 canvas 坐标并缩放到 2000 尺寸。
 */
export function renderZoomedCharacterPreview(
  canvas: HTMLCanvasElement,
  contours: IContours,
  unitsPerEm: number = 1000,
  descender: number = -200,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  // 逆 formatPoints type=1 变换（y = unitsPerEm - y_in + descender → y_canvas = unitsPerEm - y + descender）
  // 组合为 canvas 变换：scale(2,-2) 后 translate(0, -(unitsPerEm+descender))
  // canvas 代码中后写的先应用，即先 translate 再 scale
  ctx.scale(2, -2)
  ctx.translate(0, -(unitsPerEm + descender))

  ctx.beginPath()
  for (let i = 0; i < contours.length; i++) {
    const contour = contours[i]
    if (!contour?.length) continue

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
  }
  ctx.closePath()
  ctx.fillStyle = '#000'
  ctx.fill('nonzero')

  ctx.restore()
}
