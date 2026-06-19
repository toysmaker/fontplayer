/**
 * 多边形工具
 * 单例模式，负责创建多边形
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { getBound, transformPoints, isNearPoint } from '@/core/utils/math'
import { mapCanvasCoords } from '@/utils/canvas'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { getCoord } from '../utils/coord'
import { genUUID } from '@/utils/uuid'
import { formatPoints, genPolygonContour } from '@/core/utils/contour'
import type { IComponent, IPolygonComponent } from '@/core/types'
import type { IPoint } from '@/core/script/types'
import * as R from 'ramda'

/**
 * 多边形工具单例
 */
export class PolygonTool extends BaseTool {
  private static instance: PolygonTool | null = null
  private points: IPoint[] = []
  private editing: boolean = false
  private mousedown: boolean = false
  private mousemove: boolean = false
  private closePath: boolean = false
  private nearD: number = 5

  // 事件处理器引用
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null

  private constructor(canvas: HTMLCanvasElement, config: IToolConfig) {
    super(canvas, config)
  }

  /**
   * 获取单例实例
   */
  static getInstance(canvas?: HTMLCanvasElement, config?: IToolConfig): PolygonTool {
    if (!PolygonTool.instance) {
      if (!canvas || !config) {
        throw new Error('PolygonTool: canvas and config are required for first initialization')
      }
      PolygonTool.instance = new PolygonTool(canvas, config)
    }
    return PolygonTool.instance
  }

  /**
   * 重置单例（用于测试）
   */
  static reset(): void {
    if (PolygonTool.instance) {
      PolygonTool.instance.cleanup()
      PolygonTool.instance = null
    }
  }

  get name(): string {
    return 'polygon'
  }

  async init(): Promise<void> {
    this.points = []
    this.editing = false
    this.mousedown = false
    this.mousemove = false
    this.closePath = false
  }

  activate(): void {
    this.isActive = true
    this.bindEvents()
    this.setRenderFunction(this.render.bind(this))
  }

  deactivate(): void {
    this.isActive = false
    this.unbindEvents()
    this.editing = false
    this.points = []
    this.mousedown = false
    this.mousemove = false
    this.closePath = false
  }

  cleanup(): void {
    this.deactivate()
    this.setRenderFunction(null)
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    this.mouseDownHandler = this.onMouseDown.bind(this)
    this.mouseMoveHandler = this.onMouseMove.bind(this)
    this.mouseUpHandler = this.onMouseUp.bind(this)
    this.keyDownHandler = this.onKeyDown.bind(this)

    this.canvas.addEventListener('mousedown', this.mouseDownHandler)
    window.addEventListener('mousemove', this.mouseMoveHandler)
    window.addEventListener('mouseup', this.mouseUpHandler)
    window.addEventListener('keydown', this.keyDownHandler)
  }

  /**
   * 解绑事件
   */
  private unbindEvents(): void {
    if (this.mouseDownHandler) {
      this.canvas.removeEventListener('mousedown', this.mouseDownHandler)
      this.mouseDownHandler = null
    }
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = null
    }
    if (this.mouseUpHandler) {
      window.removeEventListener('mouseup', this.mouseUpHandler)
      this.mouseUpHandler = null
    }
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler)
      this.keyDownHandler = null
    }
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(e: MouseEvent): void {
    this.editing = true
    this.mousedown = true

    if (!this.points.length) {
      const _point: IPoint = {
        uuid: genUUID(),
        type: 'anchor',
        x: this.getCoord(e.offsetX),
        y: this.getCoord(e.offsetY),
        origin: null,
        isShow: true,
      }
      const _points = R.clone(this.points)
      _points.push(_point)
      this.points = _points
    }
    this.triggerRender()
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.points.length || !this.editing) return

    const _points = R.clone(this.points)

    if (!this.mousedown) {
      if (!this.mousemove) {
        // 第一次移动鼠标
        const _point: IPoint = {
          uuid: genUUID(),
          type: 'anchor',
          x: this.getCoord(e.offsetX),
          y: this.getCoord(e.offsetY),
          origin: null,
          isShow: true,
        }
        _points.push(_point)
        this.points = _points
        this.mousemove = true
        this.triggerRender()
      } else {
        // 移动鼠标
        const _point = _points[_points.length - 1]
        _point.x = this.getCoord(e.offsetX)
        _point.y = this.getCoord(e.offsetY)
        this.closePath = false

        if (isNearPoint(this.getCoord(e.offsetX), this.getCoord(e.offsetY), this.points[0].x, this.points[0].y, this.nearD)) {
          _point.x = this.points[0].x
          _point.y = this.points[0].y
          this.closePath = true
        }
        this.points = _points
        this.mousemove = true
        this.triggerRender()
      }
    }
  }

  /**
   * 鼠标抬起事件
   */
  private onMouseUp(e: MouseEvent): void {
    if (!this.points.length || !this.editing) return

    this.mousedown = false
    this.mousemove = false

    if (this.closePath) {
      this.editing = false
      const isGlyph = this.config.mode === 'glyph'
      if (isGlyph) {
        const glyphStore = useGlyphStore()
        glyphStore.addComponent(this.genPolygonComponent(R.clone(this.points), true))
      } else {
        const characterStore = useCharacterStore()
        characterStore.addComponent(this.genPolygonComponent(R.clone(this.points), true))
      }
      this.points = []
      this.closePath = false
      this.triggerRender()
    }
  }

  /**
   * 键盘按下事件
   */
  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Enter') {
      if (!this.points.length || !this.editing) return
      // 至少需要2个点才能构成多边形
      if (this.points.length < 2) return

      const _points = R.clone(this.points)
      // 添加闭合点（第一个点的位置）
      const point: IPoint = {
        uuid: genUUID(),
        type: 'anchor',
        x: this.points[0].x,
        y: this.points[0].y,
        origin: null,
        isShow: true,
      }
      _points.push(point)

      this.editing = false
      const isGlyph = this.config.mode === 'glyph'
      if (isGlyph) {
        const glyphStore = useGlyphStore()
        glyphStore.addComponent(this.genPolygonComponent(_points, true))
      } else {
        const characterStore = useCharacterStore()
        characterStore.addComponent(this.genPolygonComponent(_points, true))
      }
      this.points = []
      this.closePath = false
      this.triggerRender()
    }
  }

  /**
   * 生成多边形组件
   */
  private genPolygonComponent(
    points: IPoint[],
    closePath: boolean,
    fillColor: string = '',
    strokeColor: string = '#000'
  ): IComponent {
    const projectStore = useProjectStore()
    const { x, y, w, h } = getBound(
      points.reduce((arr: Array<{ x: number; y: number }>, point: IPoint) => {
        arr.push({
          x: point.x,
          y: point.y,
        })
        return arr
      }, [])
    )

    const rotation = 0
    const flipX = false
    const flipY = false

    let options = {
      unitsPerEm: 1000,
      descender: -200,
      advanceWidth: 1000,
    }

    if (this.config.mode === 'character' && projectStore.selectedFile) {
      options.unitsPerEm = projectStore.selectedFile.fontSettings?.unitsPerEm || 1000
      options.descender = projectStore.selectedFile.fontSettings?.descender || -200
      options.advanceWidth = projectStore.selectedFile.fontSettings?.unitsPerEm || 1000
    }

    const transformed_points = transformPoints(points, {
      x,
      y,
      w,
      h,
      rotation,
      flipX,
      flipY,
    })
    const contour_points = formatPoints(transformed_points, options, 1)
    const contour = genPolygonContour(contour_points)

    const scale = 100 / (options.unitsPerEm as number)
    const preview_points = transformed_points.map((point) => {
      return Object.assign({}, point, {
        x: point.x * scale,
        y: point.y * scale,
      })
    })
    const preview_contour = genPolygonContour(preview_points, 'none')

    return {
      uuid: genUUID(),
      type: 'polygon',
      name: 'polygon',
      lock: false,
      visible: true,
      value: {
        points: points,
        fillColor,
        strokeColor,
        closePath,
        preview: preview_contour,
        contour: contour,
      } as unknown as IPolygonComponent,
      x,
      y,
      w,
      h,
      rotation: 0,
      flipX: false,
      flipY: false,
      usedInCharacter: true,
    }
  }

  /**
   * 渲染多边形编辑器
   */
  private render(canvas: HTMLCanvasElement): void {
    if (!this.points.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const _points = this.points.map((point: IPoint) => {
      return mapCanvasCoords({
        x: point.x,
        y: point.y,
      })
    })

    // 使用全局线宽
    const strokeWidth = getStrokeWidth()
    ctx.lineWidth = strokeWidth

    ctx.strokeStyle = '#000'
    ctx.beginPath()
    ctx.moveTo(_points[0].x, _points[0].y)

    for (let i = 1; i < _points.length; i++) {
      ctx.lineTo(_points[i].x, _points[i].y)
    }

    if (this.closePath) {
      ctx.closePath()
    }

    ctx.stroke()

    // 绘制顶点：内部宽高为 strokeWidth 的两倍
    const w = strokeWidth * 2
    ctx.fillStyle = '#000'
    for (let i = 0; i < _points.length; i++) {
      ctx.fillRect(_points[i].x - w / 2, _points[i].y - w / 2, w, w)
    }
  }
}
