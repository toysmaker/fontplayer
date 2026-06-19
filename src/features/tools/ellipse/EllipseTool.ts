/**
 * 椭圆工具
 * 单例模式，负责创建椭圆（支持Shift键创建圆形）
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { getEllipsePoints, transformPoints } from '@/core/utils/math'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { getCoord } from '../utils/coord'
import { genUUID } from '@/utils/uuid'
import { formatPoints, genEllipseContour } from '@/core/utils/contour'
import type { IComponent, IEllipseComponent } from '@/core/types'

/**
 * 椭圆工具单例
 */
export class EllipseTool extends BaseTool {
  private static instance: EllipseTool | null = null
  private editing: boolean = false
  private mousedown: boolean = false
  private mousemove: boolean = false
  private lastX: number = -1
  private lastY: number = -1
  private mouseDownX: number = -1
  private mouseDownY: number = -1
  private circle: boolean = false
  private ellipseX: number = -1
  private ellipseY: number = -1
  private radiusX: number = 0
  private radiusY: number = 0

  // 事件处理器引用
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null

  private constructor(canvas: HTMLCanvasElement, config: IToolConfig) {
    super(canvas, config)
  }

  /**
   * 获取单例实例
   */
  static getInstance(canvas?: HTMLCanvasElement, config?: IToolConfig): EllipseTool {
    if (!EllipseTool.instance) {
      if (!canvas || !config) {
        throw new Error('EllipseTool: canvas and config are required for first initialization')
      }
      EllipseTool.instance = new EllipseTool(canvas, config)
    }
    return EllipseTool.instance
  }

  /**
   * 重置单例（用于测试）
   */
  static reset(): void {
    if (EllipseTool.instance) {
      EllipseTool.instance.cleanup()
      EllipseTool.instance = null
    }
  }

  get name(): string {
    return 'ellipse'
  }

  async init(): Promise<void> {
    this.editing = false
    this.mousedown = false
    this.mousemove = false
    this.lastX = -1
    this.lastY = -1
    this.mouseDownX = -1
    this.mouseDownY = -1
    this.circle = false
    this.ellipseX = -1
    this.ellipseY = -1
    this.radiusX = 0
    this.radiusY = 0
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
    this.mousedown = false
    this.mousemove = false
    this.circle = false
    this.ellipseX = -1
    this.ellipseY = -1
    this.radiusX = 0
    this.radiusY = 0
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
    this.keyUpHandler = this.onKeyUp.bind(this)

    this.canvas.addEventListener('mousedown', this.mouseDownHandler)
    this.canvas.addEventListener('mousemove', this.mouseMoveHandler)
    window.addEventListener('mouseup', this.mouseUpHandler)
    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)
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
      this.canvas.removeEventListener('mousemove', this.mouseMoveHandler)
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
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler)
      this.keyUpHandler = null
    }
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(e: MouseEvent): void {
    this.editing = true
    this.mousedown = true
    this.mouseDownX = this.getCoord(e.offsetX)
    this.mouseDownY = this.getCoord(e.offsetY)
    this.lastX = this.getCoord(e.offsetX)
    this.lastY = this.getCoord(e.offsetY)
    this.triggerRender()
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.mousedown) return

    const _x = this.getCoord(e.offsetX)
    const _y = this.getCoord(e.offsetY)
    this.mousemove = true

    if (this.mousedown) {
      if (!this.circle) {
        this.radiusX = Math.abs(_x - this.mouseDownX) / 2
        this.radiusY = Math.abs(_y - this.mouseDownY) / 2

        if (_x >= this.mouseDownX && _y >= this.mouseDownY) {
          this.ellipseX = this.mouseDownX
          this.ellipseY = this.mouseDownY
        } else if (_x <= this.mouseDownX && _y <= this.mouseDownY) {
          this.ellipseX = _x
          this.ellipseY = _y
        } else if (_x >= this.mouseDownX && _y <= this.mouseDownY) {
          this.ellipseX = this.mouseDownX
          this.ellipseY = _y
        } else {
          this.ellipseX = _x
          this.ellipseY = this.mouseDownY
        }
      } else {
        const r = Math.max(Math.abs(_x - this.mouseDownX), Math.abs(_y - this.mouseDownY)) / 2
        const useX = !!(Math.abs(_x - this.mouseDownX) > Math.abs(_y - this.mouseDownY))
        this.radiusX = r
        this.radiusY = r

        if (_x >= this.mouseDownX && _y >= this.mouseDownY) {
          this.ellipseX = this.mouseDownX
          this.ellipseY = this.mouseDownY
        } else if (_x <= this.mouseDownX && _y <= this.mouseDownY) {
          this.ellipseX = this.mouseDownX - 2 * r
          this.ellipseY = this.mouseDownY - 2 * r
        } else if (_x >= this.mouseDownX && _y <= this.mouseDownY) {
          if (useX) {
            this.ellipseX = this.mouseDownX
            this.ellipseY = this.mouseDownY - 2 * r
          } else {
            this.ellipseX = this.mouseDownX
            this.ellipseY = _y
          }
        } else {
          if (useX) {
            this.ellipseX = _x
            this.ellipseY = this.mouseDownY
          } else {
            this.ellipseX = this.mouseDownX - 2 * r
            this.ellipseY = this.mouseDownY
          }
        }
      }
    }
    this.triggerRender()
  }

  /**
   * 鼠标抬起事件
   */
  private onMouseUp(e: MouseEvent): void {
    this.editing = false

    if (this.mousemove) {
      const component = this.genEllipseComponent(this.ellipseX, this.ellipseY, this.radiusX, this.radiusY)
      
      // 先重置状态，避免 render 函数绘制预览
      this.mousedown = false
      this.mousemove = false
      this.mouseDownX = -1
      this.mouseDownY = -1
      this.circle = false
      this.ellipseX = -1
      this.ellipseY = -1
      this.radiusX = 0
      this.radiusY = 0

      // 立即清除渲染函数，避免在 addComponent 触发 renderCanvas 时绘制预览
      this.setRenderFunction(null)

      const isGlyph = this.config.mode === 'glyph'
      if (isGlyph) {
        const glyphStore = useGlyphStore()
        glyphStore.addComponent(component)
      } else {
        const characterStore = useCharacterStore()
        characterStore.addComponent(component)
      }
      
      // 重新设置渲染函数（虽然状态已重置，render 函数不会绘制任何内容）
      this.setRenderFunction(this.render.bind(this))
    } else {
      this.mousedown = false
      this.mousemove = false
      this.circle = false
      this.mouseDownX = -1
      this.mouseDownY = -1
      this.ellipseX = -1
      this.ellipseY = -1
      this.radiusX = 0
      this.radiusY = 0
      this.triggerRender()
    }
  }

  /**
   * 键盘按下事件
   */
  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.circle = true
    }
  }

  /**
   * 键盘抬起事件
   */
  private onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.circle = false
    }
  }

  /**
   * 生成椭圆组件
   * @param ellipseX 椭圆左上角X坐标（边界框的左上角）
   * @param ellipseY 椭圆左上角Y坐标（边界框的左上角）
   * @param radiusX 椭圆X方向半径
   * @param radiusY 椭圆Y方向半径
   */
  private genEllipseComponent(
    ellipseX: number,
    ellipseY: number,
    radiusX: number,
    radiusY: number,
    fillColor: string = '',
    strokeColor: string = '#000'
  ): IComponent {
    const projectStore = useProjectStore()
    // getEllipsePoints 需要中心点，所以传入 ellipseX + radiusX 和 ellipseY + radiusY
    const points = getEllipsePoints(radiusX, radiusY, 1000, ellipseX + radiusX, ellipseY + radiusY)

    const { x, y, w, h } = {
      x: ellipseX,
      y: ellipseY,
      w: 2 * radiusX,
      h: 2 * radiusY,
    }

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
    const contour = genEllipseContour(contour_points)

    const scale = 100 / (options.unitsPerEm as number)
    const preview_points = transformed_points.map((point) => {
      return Object.assign({}, point, {
        x: point.x * scale,
        y: point.y * scale,
      })
    })
    const preview_contour = genEllipseContour(preview_points, 'none')

    return {
      uuid: genUUID(),
      type: 'ellipse',
      name: 'ellipse',
      lock: false,
      visible: true,
      value: {
        radiusX,
        radiusY,
        fillColor,
        strokeColor,
        closePath: true,
        preview: preview_contour,
        contour: contour,
      } as unknown as IEllipseComponent,
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
   * 渲染椭圆编辑器
   */
  private render(canvas: HTMLCanvasElement): void {
    if (this.ellipseX === -1 || this.ellipseY === -1 || this.radiusX === 0 || this.radiusY === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y, w, h } = {
      x: this.ellipseX,
      y: this.ellipseY,
      w: 2 * this.radiusX,
      h: 2 * this.radiusY,
    }

    const _x = mapCanvasX(x)
    const _y = mapCanvasY(y)
    const _w = mapCanvasWidth(w)
    const _h = mapCanvasHeight(h)
    const _radiusX = mapCanvasWidth(this.radiusX)
    const _radiusY = mapCanvasHeight(this.radiusY)

    // 使用全局线宽
    const strokeWidth = getStrokeWidth()
    ctx.lineWidth = strokeWidth

    ctx.strokeStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(_x + _radiusX, _y + _radiusY, _radiusX, _radiusY, 0, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.stroke()

    // 选择框顶点控件：内部宽高为 strokeWidth 的两倍
    const d = strokeWidth * 2
    ctx.strokeStyle = '#79bbff'
    ctx.strokeRect(_x, _y, _w, _h)
    ctx.strokeRect(_x - d, _y - d, d * 2, d * 2)
    ctx.strokeRect(_x + _w - d, _y - d, d * 2, d * 2)
    ctx.strokeRect(_x - d, _y + _h - d, d * 2, d * 2)
    ctx.strokeRect(_x + _w - d, _y + _h - d, d * 2, d * 2)
  }
}
