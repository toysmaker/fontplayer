/**
 * 绘制网格背景
 */

import { mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { useProjectStore } from '@/stores/project'

/**
 * 绘制网格背景
 * @param canvas 画布
 * @param precision 精度
 */
export function mesh(canvas: HTMLCanvasElement, precision: number): void {
  const projectStore = useProjectStore()
  const selectedFile = projectStore.selectedFile
  
  if (!selectedFile) return
  
  const {
    unitsPerEm,
    descender,
  } = selectedFile.fontSettings

  const fontWidth = 0.8 * unitsPerEm
  const fontHeight = 0.6 * unitsPerEm
  const gaps = 16
  const width = canvas.width
  const height = canvas.height
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d') as CanvasRenderingContext2D
  
  ctx.strokeStyle = '#E0E0E0'
  ctx.lineWidth = 1
  
  const _fontWidth = mapCanvasWidth(fontWidth)
  const _fontHeight = mapCanvasHeight(fontHeight)
  const _gaps = mapCanvasWidth(gaps)
  const _precision = mapCanvasWidth(precision)
  
  for (let i = 0; i < width; i += _precision) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, height)
    ctx.stroke()
  }
  
  for (let i = 0; i < height; i += _precision) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(width, i)
    ctx.stroke()
  }
  
  ctx.strokeStyle = '#C0C0C0'
  ctx.lineWidth = 2
  
  for (let i = 0; i < width; i += _fontWidth) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, height)
    ctx.stroke()
  }
  
  for (let i = 0; i < height; i += _fontHeight) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(width, i)
    ctx.stroke()
  }
}
