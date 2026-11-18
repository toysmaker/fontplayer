import type { IFontSettings } from '@/core/types'
import { renderGlyphBlock, type LogoGlyphRenderable } from './renderLogo'

/**
 * 头像生成：
 * - 边长为 size 的正方形画布
 * - 有图标：图标居中在上（高度 = 图标字号），文字在下（字号 = 文本字号）
 * - 无图标：文字居中
 * - 4 字：上下左右四格（2×2），每格居中（字号 = 文本字号）
 * - 其他数量：横向单行排列
 * - 整体内容垂直居中
 */

export interface AvatarComposeInput {
  iconRenderable: LogoGlyphRenderable | null
  /** 外部图标块画布 */
  iconBlockCanvas?: HTMLCanvasElement | null
  textRenderables: LogoGlyphRenderable[]
  text: string
  size: number
  /** 图标字号（像素） */
  iconFontSize: number
  /** 文本字号（像素） */
  textFontSize: number
  fs: IFontSettings
}

export function composeAvatar(input: AvatarComposeInput): HTMLCanvasElement {
  const { iconRenderable, iconBlockCanvas = null, textRenderables, text, size, iconFontSize, textFontSize, fs } = input
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  const hasIcon = !!(iconRenderable || iconBlockCanvas)
  const charCount = text.length
  const gap = Math.round(size * 0.05)

  // 图标块（高度 = 图标字号）
  let iconCanvas: HTMLCanvasElement | null = null
  if (hasIcon) {
    const iconH = Math.max(1, Math.round(iconFontSize))
    if (iconBlockCanvas) {
      const scale = iconH / iconBlockCanvas.height
      iconCanvas = document.createElement('canvas')
      iconCanvas.width = Math.max(1, Math.round(iconBlockCanvas.width * scale))
      iconCanvas.height = iconH
      iconCanvas.getContext('2d')!.drawImage(iconBlockCanvas, 0, 0, iconCanvas.width, iconCanvas.height)
    } else if (iconRenderable) {
      iconCanvas = renderGlyphBlock(iconRenderable, fs, iconH, '#000000')
    }
  }

  // 内容总高度 + 起始 y（整体垂直居中）
  const textBlockH = Math.max(1, Math.round(textFontSize))
  const contentH = (hasIcon ? Math.max(1, Math.round(iconFontSize)) + gap : 0) + textBlockH
  const startY = Math.max(0, Math.round((size - contentH) / 2))

  if (charCount === 4) {
    // 2×2 四格
    const gridTop = startY + (hasIcon ? Math.round(iconFontSize) + gap : 0)
    const gridBottom = size - startY
    const cellX = Math.max(1, Math.round(size / 2))
    const cellY = Math.max(1, Math.round((gridBottom - gridTop) / 2))
    const fontSize = Math.max(1, Math.round(textFontSize))
    textRenderables.forEach((r, i) => {
      if (i >= 4) return
      const block = renderGlyphBlock(r, fs, fontSize, '#000000')
      const col = i % 2
      const row = Math.floor(i / 2)
      // 每格中心
      const cx = Math.round(col * cellX + (cellX - block.width) / 2)
      const cy = Math.round(gridTop + row * cellY + (cellY - block.height) / 2)
      ctx.drawImage(block, cx, cy)
    })
  } else {
    // 单行（1-3 字横向排列）
    const fontSize = Math.max(1, Math.round(textFontSize))
    const blocks = textRenderables.map((r) => renderGlyphBlock(r, fs, fontSize, '#000000'))
    const totalW = blocks.reduce((sum, b) => sum + b.width, 0)
    let cursorX = Math.round((size - totalW) / 2)
    const rowY = hasIcon
      ? startY + Math.round(iconFontSize) + gap
      : Math.round((size - (blocks[0]?.height ?? textBlockH)) / 2)
    for (const block of blocks) {
      ctx.drawImage(block, cursorX, rowY)
      cursorX += block.width
    }
  }

  if (iconCanvas) {
    const iconX = Math.round((size - iconCanvas.width) / 2)
    const iconY = startY
    ctx.drawImage(iconCanvas, iconX, iconY)
  }

  return canvas
}
