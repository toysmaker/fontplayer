import { getEnv } from '@/utils/env'
import { saveAs } from 'file-saver'
import { PathType, type IContour } from '@/core/font/types'
import { computeLogoLayout, type LogoGlyphRenderable } from '../canvas/renderLogo'
import type { ILogoAppData } from '../types'
import { sanitizeFilename } from './imageExport'

/**
 * Logo SVG 导出：轮廓 → <path>（y-up 字体坐标经 transform 翻转到 SVG y-down）。
 * 单色 = 单 fill；彩色 = 分层 fill。不依赖外部字体文件，视觉与画布一致。
 */

function contourToPathData(contour: IContour): string {
  const start = contour[0].start
  let d = `M ${start.x} ${start.y}`
  for (const seg of contour) {
    if (seg.type === PathType.LINE) {
      d += ` L ${seg.end.x} ${seg.end.y}`
    } else if (seg.type === PathType.QUADRATIC_BEZIER) {
      d += ` Q ${seg.control.x} ${seg.control.y} ${seg.end.x} ${seg.end.y}`
    } else {
      d += ` C ${seg.control1.x} ${seg.control1.y} ${seg.control2.x} ${seg.control2.y} ${seg.end.x} ${seg.end.y}`
    }
  }
  return `${d} Z`
}

function glyphGroup(
  renderable: LogoGlyphRenderable,
  block: { x: number; y: number; width: number; height: number; scale: number },
  ascender: number,
  monoColor: string
): string {
  // 块内变换：scale(s) · translate(0, ascender) · scale(1, -1)
  // 即 y-up 字体坐标 → y-down 块坐标：x' = x*s, y' = (ascender - y)*s
  const transform = `translate(${block.x}, ${block.y}) scale(${block.scale}) translate(0, ${ascender}) scale(1, -1)`
  let paths: string
  if (renderable.fillColors) {
    paths = renderable.contours
      .map(
        (c, i) =>
          `<path d="${contourToPathData(c)}" fill="${renderable.fillColors![i] ?? '#000'}" fill-rule="nonzero"/>`
      )
      .join('\n')
  } else {
    // 黑白：所有轮廓一个 path（nonzero 镂空）
    const d = renderable.contours.map((c) => contourToPathData(c)).join(' ')
    paths = `<path d="${d}" fill="${monoColor}" fill-rule="nonzero"/>`
  }
  return `<g transform="${transform}">\n${paths}\n</g>`
}

export function buildLogoSvg(input: {
  iconRenderable: LogoGlyphRenderable | null
  /** 外部图标块画布（转 dataURL 内嵌为 <image>） */
  iconBlockCanvas?: HTMLCanvasElement | null
  textRenderables: LogoGlyphRenderable[]
  data: ILogoAppData
  fs: { unitsPerEm: number; ascender: number; descender: number }
  monoColor?: string
}): string {
  const { iconRenderable, iconBlockCanvas = null, textRenderables, data, fs, monoColor = '#000000' } = input
  const { ascender = 800 } = fs
  const layout = computeLogoLayout({
    iconRenderable,
    iconSizeOverride: iconBlockCanvas
      ? { width: iconBlockCanvas.width, height: iconBlockCanvas.height }
      : null,
    textRenderables,
    data,
    fs: fs as never,
  })

  const groups: string[] = []
  if (layout.iconBlock) {
    if (iconBlockCanvas) {
      const dataUrl = iconBlockCanvas.toDataURL('image/png')
      groups.push(
        `<image x="${layout.iconBlock.x}" y="${layout.iconBlock.y}" width="${layout.iconBlock.width}" height="${layout.iconBlock.height}" href="${dataUrl}"/>`
      )
    } else if (iconRenderable) {
      groups.push(glyphGroup(iconRenderable, layout.iconBlock, ascender, monoColor))
    }
  }
  for (const tb of layout.textBlocks) {
    groups.push(
      glyphGroup(tb.renderable, { x: tb.x, y: tb.y, width: tb.width, height: tb.height, scale: tb.scale }, ascender, monoColor)
    )
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.totalW}" height="${layout.totalH}" viewBox="0 0 ${layout.totalW} ${layout.totalH}">
${groups.join('\n')}
</svg>
`
}

export async function exportLogoSvgToDisk(
  svg: string,
  name: string
): Promise<boolean> {
  const filename = `${sanitizeFilename(name || 'logo')}.svg`
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  if (getEnv() === 'tauri') {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename })
    if (path == null) return false
    const target = typeof path === 'string' ? path : (path as { path: string }).path
    await writeFile(target, new TextEncoder().encode(svg))
    return true
  }
  saveAs(blob, filename)
  return true
}
