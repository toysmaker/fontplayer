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
  /**
   * 填充单元数组（与 contours 索引对齐）。
   * 同一单元内颜色相同的轮廓合并到一个 path 中统一 fill('nonzero')，
   * 才能利用非零环绕规则产生镂空（与编辑界面「同一组件内子轮廓合并后一次填充」一致）；
   * 不同单元的轮廓即使同色也独立填充，避免把无关组件误合并出洞。
   * 未提供时退化为按颜色分组（整个预览视为单一组件上下文，如字形列表）。
   */
  fillUnits?: string[]
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
  /**
   * 实心轮廓各自的填充颜色（与 solidContours 索引对齐）。
   * 彩色模式下使用，与编辑界面一致（矩形/椭圆按自身 fillColor 着色）；
   * 缺省时回退到 fillColor。
   */
  solidFillColors?: string[]
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
      solidFillColors = [],
      fillUnits = [],
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
      // 彩色模式：按「填充单元 + 颜色」分组，同一单元内同色的轮廓合并到一个 path 中
      // 统一 fill('nonzero')。与编辑界面（CustomGlyph.render 彩色分支）一致：
      // 多个子路径在同一 beginPath 内才能利用非零环绕规则产生镂空效果；
      // 逐个轮廓单独填充会把镂空轮廓填实。不同单元的轮廓即使同色也独立填充，
      // 避免把无法确认复用关系的组件误合并出洞。
      // 未提供 fillUnits 时退化为按颜色分组（整个预览视为单一组件上下文，如字形列表）。
      const groups: Array<{ color: string; contours: IContours }> = []
      const groupIndexByKey = new Map<string, number>()
      for (let i = 0; i < contours.length; i++) {
        const contour = contours[i]
        if (!contour || !contour.length) continue
        const color = fillColors[i] || fillColor
        const groupKey = `${fillUnits[i] || ''}|${color}`
        let groupIndex = groupIndexByKey.get(groupKey)
        if (groupIndex === undefined) {
          groupIndex = groups.length
          groupIndexByKey.set(groupKey, groupIndex)
          groups.push({ color, contours: [] })
        }
        groups[groupIndex].contours.push(contour)
      }
      for (const { color, contours: groupContours } of groups) {
        ctx.beginPath()
        for (const contour of groupContours) {
          drawContourPath(contour)
          ctx.closePath()
        }
        ctx.fillStyle = color
        ctx.fill('nonzero')
      }
    } else {
      // 黑色模式：Pass 1 — 所有非实心轮廓合并到一个 path 中统一 fill('nonzero')
      // 多个子路径在同一 beginPath 内才能利用非零环绕规则产生镂空效果
      ctx.beginPath()
      for (const contour of contours) {
        if (!contour || !contour.length) continue
        drawContourPath(contour)
        ctx.closePath()
      }
      ctx.fillStyle = fillColor
      ctx.fill('nonzero')
    }

    // Pass 2 - 实心轮廓（矩形/椭圆）单独绘制，始终实心填充，最后绘制以覆盖在上方
    for (let i = 0; i < solidContours.length; i++) {
      const contour = solidContours[i]
      if (!contour || !contour.length) continue
      ctx.beginPath()
      drawContourPath(contour)
      ctx.closePath()
      // 彩色模式下按各实心轮廓自身的 fillColor 着色（与编辑界面一致）
      ctx.fillStyle = (previewStyle === 'color' && solidFillColors[i]) || fillColor
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
