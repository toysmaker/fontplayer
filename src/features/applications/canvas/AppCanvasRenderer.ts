import type { FontLibrary } from '../fontLibraryService'
import type {
  IAppComponent,
  ICardAppData,
  ICharGridComponent,
  IFreeTextComponent,
  IImageComponent,
} from '../types'
import { getPatternCanvas } from './patterns'

/**
 * 卡片应用画布渲染器：
 * - 画布分辨率 = doc.canvas.width/height（导出 1:1 像素）
 * - 组件按数组顺序绘制（数组顺序 = z 序，下标大者在上）
 * - 文本用 FontFace + fillText（浏览器 shaping）；字符逐字定位，位置可复用于视频合成
 */

export interface CharLayoutPosition {
  char: string
  x: number
  y: number
  fontSize: number
  color?: string
}

const imageCache = new Map<string, HTMLImageElement>()

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(dataUrl)
  if (cached && cached.complete) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(dataUrl, img)
      resolve(img)
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}

/** 横向文本按宽度换行（逐字累积宽度） */
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(current)
      current = ''
      continue
    }
    const test = current + ch
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current)
      current = ch
    } else {
      current = test
    }
  }
  lines.push(current)
  return lines
}

/** 自由排版组件逐字设计空间位置（横向按换行，竖向逐字排） */
export function computeFreeTextCharPositions(
  comp: IFreeTextComponent,
  ctx: CanvasRenderingContext2D,
  family: string
): CharLayoutPosition[] {
  const { x, y, width, height, text, fontSize, direction, align = 'left', lineHeight = 1.2, color } = comp
  const lineH = fontSize * lineHeight
  const font = `${fontSize}px "${family}"`
  ctx.font = font
  const positions: CharLayoutPosition[] = []

  if (direction === 'vertical') {
    let cy = y
    for (const ch of text) {
      if (ch === '\n') continue
      const w = ctx.measureText(ch).width
      positions.push({ char: ch, x: x + (width - w) / 2, y: cy, fontSize, color })
      cy += lineH
      if (cy + fontSize > y + height) break
    }
    return positions
  }

  const lines = wrapTextLines(ctx, text, width)
  let lineTop = y
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width
    let cx: number
    if (align === 'center') cx = x + (width - lineWidth) / 2
    else if (align === 'right') cx = x + width - lineWidth
    else cx = x
    for (const ch of line) {
      const w = ctx.measureText(ch).width
      positions.push({ char: ch, x: cx, y: lineTop, fontSize, color })
      cx += w
    }
    lineTop += lineH
    if (lineTop + fontSize > y + height) break
  }
  return positions
}

/** 字符网格组件逐字设计空间位置（行优先，单元格居中） */
export function computeCharGridCharPositions(comp: ICharGridComponent): CharLayoutPosition[] {
  const { x, y, width, height, cols, rows, gapX, gapY, content, fontSize, color } = comp
  const cellW = (width - gapX * (cols - 1)) / cols
  const cellH = (height - gapY * (rows - 1)) / rows
  const positions: CharLayoutPosition[] = []
  const chars = [...content]
  let index = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (index >= chars.length) return positions
      const ch = chars[index++]
      const cx = x + c * (cellW + gapX)
      const cy = y + r * (cellH + gapY)
      positions.push({
        char: ch,
        x: cx + (cellW - fontSize) / 2,
        y: cy + (cellH - fontSize) / 2,
        fontSize,
        color,
      })
    }
  }
  return positions
}

/** 自由排版：点击位置对应的字符下标（用于 canvas 内文字编辑光标定位） */
export function findFreeTextCharIndexAt(
  comp: IFreeTextComponent,
  x: number,
  y: number,
  ctx: CanvasRenderingContext2D,
  family: string
): number {
  const positions = computeFreeTextCharPositions(comp, ctx, family)
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    const w = ctx.measureText(p.char).width
    if (x >= p.x && x <= p.x + w && y >= p.y && y <= p.y + p.fontSize) {
      // 字符右半点击 → 光标落在其后
      return x >= p.x + w / 2 ? i + 1 : i
    }
  }
  // 组件内但不在字符上：取最近（末尾）
  return positions.length
}

/** 字符网格：点击位置对应的单元格下标（行优先；点哪格返回哪格，不受内容长度限制） */
export function findGridCellIndexAt(comp: ICharGridComponent, x: number, y: number): number {
  const { cols, rows, gapX, gapY } = comp
  const maxCell = Math.max(0, cols * rows - 1)
  const cellW = (comp.width - gapX * (cols - 1)) / cols
  const cellH = (comp.height - gapY * (rows - 1)) / rows
  const col = Math.floor((x - comp.x) / (cellW + gapX))
  const row = Math.floor((y - comp.y) / (cellH + gapY))
  if (col < 0 || col >= cols || row < 0 || row >= rows) return maxCell
  return Math.min(row * cols + col, maxCell)
}

export interface CaretRect {
  x: number
  y: number
  height: number
}

/** 自由排版：光标下标处的插入符矩形（设计坐标） */
export function freeTextCaretRect(
  comp: IFreeTextComponent,
  caretIndex: number,
  ctx: CanvasRenderingContext2D,
  family: string
): CaretRect | null {
  const positions = computeFreeTextCharPositions(comp, ctx, family)
  if (positions.length === 0) {
    // 空文本：光标在文本区左上角
    return { x: comp.x, y: comp.y, height: comp.fontSize }
  }
  if (caretIndex >= positions.length) {
    // 末尾：最后一个字符之后
    const last = positions[positions.length - 1]
    const w = ctx.measureText(last.char).width
    return { x: last.x + w, y: last.y, height: last.fontSize }
  }
  const p = positions[Math.max(0, caretIndex)]
  return { x: p.x, y: p.y, height: p.fontSize }
}

/** 字符网格：单元格矩形（设计坐标；光标/输入框定位用） */
export function gridCellRect(
  comp: ICharGridComponent,
  cellIndex: number
): { x: number; y: number; width: number; height: number } | null {
  const { cols, rows, gapX, gapY, fontSize } = comp
  if (cellIndex < 0) return null
  const cellW = (comp.width - gapX * (cols - 1)) / cols
  const cellH = (comp.height - gapY * (rows - 1)) / rows
  const col = cellIndex % cols
  const row = Math.floor(cellIndex / cols)
  const cx = comp.x + col * (cellW + gapX)
  const cy = comp.y + row * (cellH + gapY)
  return {
    x: cx + (cellW - fontSize) / 2,
    y: cy + (cellH - fontSize) / 2,
    width: fontSize,
    height: fontSize,
  }
}

/** 布局中全部字符出现（按组件 z 序；重复字符逐个出现，一一对应视频子轴） */
export function computeLayoutCharOccurrences(
  data: ICardAppData,
  ctx: CanvasRenderingContext2D,
  family: string
): Array<{ id: string; char: string; x: number; y: number; fontSize: number }> {
  const result: Array<{ id: string; char: string; x: number; y: number; fontSize: number }> = []
  for (const comp of data.components) {
    if (comp.kind === 'freeText') {
      const positions = computeFreeTextCharPositions(comp, ctx, family)
      positions.forEach((p, i) => {
        result.push({ id: `${comp.id}:${i}`, char: p.char, x: p.x, y: p.y, fontSize: p.fontSize })
      })
    } else if (comp.kind === 'charGrid') {
      const positions = computeCharGridCharPositions(comp)
      positions.forEach((p, i) => {
        result.push({ id: `${comp.id}:${i}`, char: p.char, x: p.x, y: p.y, fontSize: p.fontSize })
      })
    }
  }
  return result
}

/** 汇总布局中全部字符位置（视频保存时解析轨位置用；取首个出现位置） */
export function computeAllCharPositions(
  data: ICardAppData,
  ctx: CanvasRenderingContext2D,
  family: string
): Map<string, CharLayoutPosition> {
  const map = new Map<string, CharLayoutPosition>()
  for (const comp of data.components) {
    let positions: CharLayoutPosition[] = []
    if (comp.kind === 'freeText') positions = computeFreeTextCharPositions(comp, ctx, family)
    else if (comp.kind === 'charGrid') positions = computeCharGridCharPositions(comp)
    for (const p of positions) {
      if (!map.has(p.char)) map.set(p.char, p)
    }
  }
  return map
}

async function drawImageComponent(
  ctx: CanvasRenderingContext2D,
  comp: IImageComponent
): Promise<void> {
  const { x, y, width, height, source, opacity = 1 } = comp
  let img: CanvasImageSource
  if (source.kind === 'pattern') {
    const patternCanvas = getPatternCanvas(source.patternId)
    if (!patternCanvas) return
    img = patternCanvas
  } else {
    img = await loadImage(source.dataUrl)
  }
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.drawImage(img, x, y, width, height)
  ctx.restore()
}

function drawTextComponent(
  ctx: CanvasRenderingContext2D,
  comp: IFreeTextComponent | ICharGridComponent,
  family: string,
  animatedChars?: Set<string>
): void {
  const positions: CharLayoutPosition[] =
    comp.kind === 'freeText'
      ? computeFreeTextCharPositions(comp, ctx, family)
      : computeCharGridCharPositions(comp)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = comp.color
  for (const p of positions) {
    if (animatedChars?.has(p.char)) continue
    ctx.font = `${p.fontSize}px "${family}"`
    ctx.fillText(p.char, p.x, p.y)
  }
}

export interface RenderAppCanvasOptions {
  /** 视频帧合成：这些字符跳过静态渲染（由动效帧覆盖） */
  animatedChars?: Set<string>
}

export async function renderAppCanvas(
  canvas: HTMLCanvasElement,
  data: ICardAppData,
  library: FontLibrary,
  opts?: RenderAppCanvasOptions
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = data.canvas.width
  canvas.height = data.canvas.height

  ctx.fillStyle = data.canvas.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const family = library.family
  for (const comp of data.components) {
    if (comp.kind === 'image') {
      await drawImageComponent(ctx, comp)
    } else {
      drawTextComponent(ctx, comp, family, opts?.animatedChars)
    }
  }
}
