/**
 * 内置图样：程序化生成固定集合的图案（缓存为离屏 canvas，供卡片应用图片组件选择）。
 */

export interface BuiltinPattern {
  id: string
  name: string
}

export const BUILTIN_PATTERNS: BuiltinPattern[] = [
  { id: 'dots', name: '网格点' },
  { id: 'stripes', name: '斜条纹' },
  { id: 'waves', name: '波纹' },
  { id: 'checker', name: '棋盘格' },
  { id: 'grid', name: '网格线' },
  { id: 'mesh', name: '渐变网格' },
]

const PATTERN_SIZE = 256

const patternCache = new Map<string, HTMLCanvasElement>()

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = PATTERN_SIZE
  canvas.height = PATTERN_SIZE
  const ctx = canvas.getContext('2d')!
  return [canvas, ctx]
}

function drawDots(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE)
  ctx.fillStyle = '#b8c4d8'
  const step = 32
  for (let y = step / 2; y < PATTERN_SIZE; y += step) {
    for (let x = step / 2; x < PATTERN_SIZE; x += step) {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawStripes(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE)
  ctx.strokeStyle = '#d9c9a8'
  ctx.lineWidth = 12
  const step = 36
  for (let i = -PATTERN_SIZE; i < PATTERN_SIZE * 2; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + PATTERN_SIZE, PATTERN_SIZE)
    ctx.stroke()
  }
}

function drawWaves(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#e8f0f7'
  ctx.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE)
  ctx.strokeStyle = '#a8c4dc'
  ctx.lineWidth = 6
  for (let y = 16; y < PATTERN_SIZE; y += 32) {
    ctx.beginPath()
    for (let x = 0; x <= PATTERN_SIZE; x += 4) {
      const yy = y + Math.sin((x / PATTERN_SIZE) * Math.PI * 2) * 8
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
}

function drawChecker(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE)
  ctx.fillStyle = '#cfd6df'
  const cell = 32
  for (let y = 0; y < PATTERN_SIZE / cell; y++) {
    for (let x = 0; x < PATTERN_SIZE / cell; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE)
  ctx.strokeStyle = '#d8dde4'
  ctx.lineWidth = 2
  const step = 32
  for (let i = 0; i <= PATTERN_SIZE; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, PATTERN_SIZE)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(PATTERN_SIZE, i)
    ctx.stroke()
  }
}

function drawMesh(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(
    PATTERN_SIZE / 2,
    PATTERN_SIZE / 2,
    8,
    PATTERN_SIZE / 2,
    PATTERN_SIZE / 2,
    PATTERN_SIZE * 0.7
  )
  grad.addColorStop(0, '#ffd9c4')
  grad.addColorStop(0.5, '#ffb3a7')
  grad.addColorStop(1, '#f0f0f0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 3
  for (let i = 0; i <= PATTERN_SIZE; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, PATTERN_SIZE)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(PATTERN_SIZE, i)
    ctx.stroke()
  }
}

const DRAWERS: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  dots: drawDots,
  stripes: drawStripes,
  waves: drawWaves,
  checker: drawChecker,
  grid: drawGrid,
  mesh: drawMesh,
}

/** 获取（并缓存）内置图样画布 */
export function getPatternCanvas(patternId: string): HTMLCanvasElement | null {
  if (patternCache.has(patternId)) {
    return patternCache.get(patternId)!
  }
  const drawer = DRAWERS[patternId]
  if (!drawer) return null
  const [canvas, ctx] = makeCanvas()
  drawer(ctx)
  patternCache.set(patternId, canvas)
  return canvas
}
