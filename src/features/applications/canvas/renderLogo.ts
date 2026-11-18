import type { ICharacterFileLite, IFile, IFontSettings } from '@/core/types'
import { PathType, type IContours } from '@/core/font/types'
import { contoursForCharacterFile } from '@/features/editor/services/ExportFontService'
import {
  characterUsesColorLayers,
  generateColorFontLayers,
} from '@/features/editor/services/ExportColorFontService'
import type { ICardAppData, ILogoAppData } from '../types'
import { unicodeToHexString } from '@/utils/unicode'

/**
 * Logo 渲染（轮廓管线）：
 * - 字体空间轮廓为 y-up（OpenType 约定），画布/SVG 为 y-down，渲染时统一翻转
 * - 黑白 = 单一填充；彩色 = 组件 fillColor 分层
 * - 版式：左右（图标左文本右）/ 上下（图标上文本下），按用户字号自动规划整体尺寸
 */

export interface LogoGlyphRenderable {
  contours: IContours
  /** 与 contours 一一对应；null = 黑白单色 */
  fillColors: string[] | null
  advanceWidth: number
}

export async function buildLogoGlyphRenderable(
  char: ICharacterFileLite | null,
  file: IFile,
  fs: IFontSettings,
  colorMode: boolean
): Promise<LogoGlyphRenderable | null> {
  if (!char) return null
  const advanceWidth = char.info?.metrics?.advanceWidth ?? fs.unitsPerEm
  if (colorMode && characterUsesColorLayers(char)) {
    const layers = generateColorFontLayers(char, fs)
    const contours: IContours = []
    const fillColors: string[] = []
    for (const layer of layers) {
      for (const c of layer.contours) {
        contours.push(c)
        fillColors.push(layer.fillColor)
      }
    }
    return { contours, fillColors, advanceWidth }
  }
  const contours = contoursForCharacterFile(char, file, fs, true)
  return { contours, fillColors: null, advanceWidth }
}

export interface LogoLayout {
  totalW: number
  totalH: number
  padding: number
  gap: number
  iconBlock: { x: number; y: number; width: number; height: number; scale: number } | null
  textBlocks: Array<{
    char: string
    renderable: LogoGlyphRenderable
    x: number
    y: number
    width: number
    height: number
    scale: number
  }>
}

/** 计算 logo 布局（composeLogo 与 SVG 导出共用同一布局） */
export function computeLogoLayout(input: {
  iconRenderable: LogoGlyphRenderable | null
  /** 外部图标块尺寸（无 renderable 时使用） */
  iconSizeOverride?: { width: number; height: number } | null
  textRenderables: LogoGlyphRenderable[]
  data: ILogoAppData
  fs: IFontSettings
}): LogoLayout {
  const { iconRenderable, iconSizeOverride = null, textRenderables, data, fs } = input
  const { unitsPerEm, ascender = 800, descender = -200 } = fs
  const heightUnits = ascender - descender

  const iconScale = data.iconFontSize / unitsPerEm
  const textScale = data.textFontSize / unitsPerEm

  const iconW = iconRenderable
    ? Math.round(iconRenderable.advanceWidth * iconScale)
    : iconSizeOverride
      ? iconSizeOverride.width
      : 0
  const iconH = iconRenderable
    ? Math.round(heightUnits * iconScale)
    : iconSizeOverride
      ? iconSizeOverride.height
      : 0

  const textWidths = textRenderables.map((r) => Math.round(r.advanceWidth * textScale))
  const textW = textWidths.reduce((sum, w) => sum + w, 0)
  const textH = textRenderables.length > 0 ? Math.round(heightUnits * textScale) : 0

  const gap = Math.round(Math.max(data.iconFontSize, data.textFontSize) * 0.25)
  const padding = Math.round(Math.max(data.iconFontSize, data.textFontSize) * 0.2)

  let totalW: number
  let totalH: number
  if (data.layout === 'leftRight') {
    totalW = iconW + (iconW > 0 && textW > 0 ? gap : 0) + textW
    totalH = Math.max(iconH, textH)
  } else {
    totalW = Math.max(iconW, textW)
    totalH = iconH + (iconH > 0 && textH > 0 ? gap : 0) + textH
  }
  totalW = Math.max(1, totalW + padding * 2)
  totalH = Math.max(1, totalH + padding * 2)

  let iconBlock: LogoLayout['iconBlock'] = null
  // 字库图标（renderable）与外部图标（sizeOverride）都要生成图标块
  if (iconRenderable || iconSizeOverride) {
    if (data.layout === 'leftRight') {
      iconBlock = {
        x: padding,
        y: padding + Math.round((totalH - padding * 2 - iconH) / 2),
        width: iconW,
        height: iconH,
        scale: iconScale,
      }
    } else {
      iconBlock = {
        x: padding + Math.round((totalW - padding * 2 - iconW) / 2),
        y: padding,
        width: iconW,
        height: iconH,
        scale: iconScale,
      }
    }
  }

  const textBlocks: LogoLayout['textBlocks'] = []
  if (textRenderables.length > 0) {
    let textRectX: number
    let textRectY: number
    if (data.layout === 'leftRight') {
      textRectX = padding + iconW + (iconW > 0 ? gap : 0)
      textRectY = padding + Math.round((totalH - padding * 2 - textH) / 2)
    } else {
      textRectX = padding + Math.round((totalW - padding * 2 - textW) / 2)
      textRectY = padding + iconH + (iconH > 0 ? gap : 0)
    }
    let cursorX = textRectX
    textRenderables.forEach((r, i) => {
      const w = textWidths[i]
      textBlocks.push({
        char: data.text[i] ?? '',
        renderable: r,
        x: cursorX,
        y: textRectY,
        width: w,
        height: textH,
        scale: textScale,
      })
      cursorX += w
    })
  }

  return { totalW, totalH, padding, gap, iconBlock, textBlocks }
}

/** y-up 字体坐标 → y-down 画布坐标（块内） */
function fontPointToBlock(
  p: { x: number; y: number },
  scale: number,
  ascender: number
): { x: number; y: number } {
  return { x: p.x * scale, y: (ascender - p.y) * scale }
}

function drawContourToCtx(
  ctx: CanvasRenderingContext2D,
  contour: IContours[number],
  scale: number,
  ascender: number
): void {
  const start = fontPointToBlock(contour[0].start, scale, ascender)
  ctx.moveTo(start.x, start.y)
  for (const seg of contour) {
    const end = fontPointToBlock(seg.end, scale, ascender)
    if (seg.type === PathType.LINE) {
      ctx.lineTo(end.x, end.y)
    } else if (seg.type === PathType.QUADRATIC_BEZIER) {
      const c = fontPointToBlock(seg.control, scale, ascender)
      ctx.quadraticCurveTo(c.x, c.y, end.x, end.y)
    } else {
      const c1 = fontPointToBlock(seg.control1, scale, ascender)
      const c2 = fontPointToBlock(seg.control2, scale, ascender)
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
    }
  }
}

/** 把字形渲染到块画布（块尺寸按字号与字体度量计算） */
export function renderGlyphBlock(
  renderable: LogoGlyphRenderable,
  fs: IFontSettings,
  fontSize: number,
  monoColor: string
): HTMLCanvasElement {
  const { unitsPerEm, ascender = 800, descender = -200 } = fs
  const heightUnits = ascender - descender
  const scale = fontSize / unitsPerEm
  const blockW = Math.max(1, Math.round(renderable.advanceWidth * scale))
  const blockH = Math.max(1, Math.round(heightUnits * scale))

  const canvas = document.createElement('canvas')
  canvas.width = blockW
  canvas.height = blockH
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  if (renderable.fillColors) {
    // 彩色：逐轮廓单独填充
    renderable.contours.forEach((contour, i) => {
      if (!contour.length) return
      ctx.beginPath()
      drawContourToCtx(ctx, contour, scale, ascender)
      ctx.closePath()
      ctx.fillStyle = renderable.fillColors![i] ?? '#000'
      ctx.fill('nonzero')
    })
  } else {
    // 黑白：所有轮廓同一路径 nonzero（镂空正确）
    ctx.beginPath()
    for (const contour of renderable.contours) {
      if (!contour.length) continue
      drawContourToCtx(ctx, contour, scale, ascender)
      ctx.closePath()
    }
    ctx.fillStyle = monoColor
    ctx.fill('nonzero')
  }
  return canvas
}

export interface LogoComposeResult {
  canvas: HTMLCanvasElement
  layout: LogoLayout
}

/** 渲染 logo：返回主画布与布局（供预览/导出复用） */
export function composeLogo(input: {
  iconRenderable: LogoGlyphRenderable | null
  /** 外部图标已渲染好的块画布 */
  iconBlockCanvas?: HTMLCanvasElement | null
  textRenderables: LogoGlyphRenderable[]
  data: ILogoAppData
  fs: IFontSettings
}): LogoComposeResult {
  const iconSize = input.iconBlockCanvas
    ? { width: input.iconBlockCanvas.width, height: input.iconBlockCanvas.height }
    : null
  const layout = computeLogoLayout({
    iconRenderable: input.iconRenderable,
    iconSizeOverride: iconSize,
    textRenderables: input.textRenderables,
    data: input.data,
    fs: input.fs,
  })
  const canvas = document.createElement('canvas')
  canvas.width = layout.totalW
  canvas.height = layout.totalH
  const ctx = canvas.getContext('2d')!

  if (layout.iconBlock) {
    const block = input.iconBlockCanvas
      ? input.iconBlockCanvas
      : input.iconRenderable
        ? renderGlyphBlock(input.iconRenderable, input.fs, input.data.iconFontSize, '#000000')
        : null
    if (block) ctx.drawImage(block, layout.iconBlock.x, layout.iconBlock.y)
  }
  for (const tb of layout.textBlocks) {
    const block = renderGlyphBlock(tb.renderable, input.fs, input.data.textFontSize, '#000000')
    ctx.drawImage(block, tb.x, tb.y)
  }
  return { canvas, layout }
}

/**
 * 由 logo 固化的布局块重建卡片画布数据（视频合成/轨道位置解析用）。
 * 字库字符 → 单字 freeText（fillText 渲染）；外部图标 → 图片组件。
 */
export function logoLayoutToCardData(data: ILogoAppData): ICardAppData | null {
  const lb = data.layoutBlocks
  if (!lb) return null
  const components: ICardAppData['components'] = []
  if (data.iconSource.kind === 'external' && lb.iconBlock) {
    components.push({
      kind: 'image',
      id: 'logo-icon',
      x: lb.iconBlock.x,
      y: lb.iconBlock.y,
      width: lb.iconBlock.width,
      height: lb.iconBlock.height,
      source: { kind: 'file', dataUrl: data.iconSource.dataUrl },
    })
  } else if (data.iconSource.kind === 'fontLibrary' && lb.iconBlock) {
    const unicodeChar = lb.iconBlock.char || String.fromCharCode(0xfffd)
    components.push({
      kind: 'freeText',
      id: 'logo-icon-text',
      x: lb.iconBlock.x,
      y: lb.iconBlock.y,
      width: lb.iconBlock.width,
      height: lb.iconBlock.height,
      text: unicodeChar,
      fontSize: lb.iconBlock.fontSize,
      direction: 'horizontal',
      color: '#000000',
    })
  }
  for (const tb of lb.textBlocks) {
    components.push({
      kind: 'freeText',
      id: `logo-text-${tb.char}`,
      x: tb.x,
      y: tb.y,
      width: tb.width,
      height: tb.height,
      text: tb.char,
      fontSize: tb.fontSize,
      direction: 'horizontal',
      color: '#000000',
    })
  }
  return {
    canvas: { width: lb.totalW, height: lb.totalH, background: '#ffffff' },
    components,
  }
}

/** 从工程加载一个字符的渲染数据（unicode 字符串匹配，如 'U+F000'） */
export async function loadCharacterByUnicode(
  file: IFile,
  unicode: string
): Promise<ICharacterFileLite | null> {
  const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
  const target = unicodeToHexString(unicode)
  for (const meta of file.characterList) {
    if (unicodeToHexString(meta.character.unicode) === target) {
      return characterDataManager.loadCharacter(file.uuid, meta.uuid)
    }
  }
  return null
}

/** 解析用户输入的 unicode（如 0x1000 / U+F000 / F000）为标准 'U+XXXX' */
export function normalizeUnicodeInput(input: string): string {
  let hex = input.trim()
  hex = hex.replace(/^0x/i, '').replace(/^U\+/i, '').replace(/^\\u/i, '')
  const value = parseInt(hex, 16)
  if (Number.isNaN(value)) return ''
  return `U+${value.toString(16).toUpperCase()}`
}
