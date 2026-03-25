/**
 * 渲染引擎
 * 负责将轮廓数据渲染到Canvas
 */

import type { IContours } from './types'
import { PathType } from './types'

/**
 * 渲染选项
 */
export interface IRenderOptions {
  /** 填充颜色（单个颜色） */
  fillColor?: string
  /** 填充颜色数组（每个轮廓一个颜色） */
  fillColors?: string[]
  /** 背景颜色 */
  backgroundColor?: string
  /** 预览样式：'black' | 'color' */
  previewStyle?: 'black' | 'color'
  /** 缩放比例 */
  scale?: number
  /** 偏移量 */
  offset?: { x: number; y: number }
  /**
   * 需要实心填充的轮廓（矩形、椭圆）。
   * 这些轮廓在 pen/polygon 路径之后单独绘制，始终填充为实心，
   * 不参与 pen/polygon 的非零环绕规则计算。
   */
  solidContours?: IContours
}

/**
 * 渲染引擎类
 */
export class RenderEngine {
  /**
   * 渲染轮廓到Canvas（预览模式）
   * @param canvas Canvas元素
   * @param contours 轮廓数据
   * @param options 渲染选项
   */
  static renderPreview(
    canvas: HTMLCanvasElement,
    contours: IContours,
    options: IRenderOptions = {}
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const {
      fillColor = '#000',
      fillColors = [],
      backgroundColor = 'white',
      previewStyle = 'black',
      scale = 1,
      offset = { x: 0, y: 0 },
      solidContours = [],
    } = options

    // 清空并填充背景
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 应用缩放和偏移
    const applyTransform = (point: { x: number; y: number }) => ({
      x: point.x * scale + offset.x,
      y: point.y * scale + offset.y,
    })

    const drawContourPath = (contour: IContours[number]) => {
      if (!contour || !contour.length) return
      const startPoint = applyTransform(contour[0].start)
      ctx.moveTo(startPoint.x, startPoint.y)
      for (const path of contour) {
        const endPoint = applyTransform(path.end)
        if (path.type === PathType.LINE) {
          ctx.lineTo(endPoint.x, endPoint.y)
        } else if (path.type === PathType.QUADRATIC_BEZIER) {
          const qPath = path as { control: { x: number; y: number } }
          const control = applyTransform(qPath.control)
          ctx.quadraticCurveTo(control.x, control.y, endPoint.x, endPoint.y)
        } else if (path.type === PathType.CUBIC_BEZIER) {
          const cPath = path as { control1: { x: number; y: number }; control2: { x: number; y: number } }
          const control1 = applyTransform(cPath.control1)
          const control2 = applyTransform(cPath.control2)
          ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, endPoint.x, endPoint.y)
        }
      }
    }

    if (previewStyle === 'color') {
      // 彩色模式：每个轮廓单独填充（nonzero）
      for (let i = 0; i < contours.length; i++) {
        const contour = contours[i]
        if (!contour || !contour.length) continue
        ctx.beginPath()
        drawContourPath(contour)
        ctx.closePath()
        ctx.fillStyle = fillColors[i] || fillColor
        ctx.fill('nonzero')
      }
    } else {
      // 黑色模式：Pass 1 — 每个非实心轮廓单独 path + fill('nonzero')，避免多轮廓合并时单次 closePath 与非零规则异常
      for (const contour of contours) {
        if (!contour || !contour.length) continue
        ctx.beginPath()
        drawContourPath(contour)
        ctx.closePath()
        ctx.fillStyle = fillColor
        ctx.fill('nonzero')
      }
    }

    // Pass 2 - 实心轮廓（矩形/椭圆）单独绘制，始终实心填充，最后绘制以覆盖在上方
    for (const contour of solidContours) {
      if (!contour || !contour.length) continue
      ctx.beginPath()
      drawContourPath(contour)
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill('nonzero')
    }
  }

  /**
   * 清空Canvas
   */
  static clearCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  /**
   * 填充Canvas背景
   */
  static fillBackground(
    canvas: HTMLCanvasElement,
    color: string = 'white'
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
}
