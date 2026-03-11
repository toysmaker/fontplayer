/**
 * 矩形工具
 * 单例模式，负责创建矩形（支持Shift键创建正方形）
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { getRectanglePoints, transformPoints } from '@/core/utils/math'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { getCoord } from '../utils/coord'
import { genUUID } from '@/utils/uuid'
import { formatPoints, genRectangleContour } from '@/core/utils/contour'
import type { IComponent, IRectangleComponent } from '@/core/types'

/**
 * 矩形工具单例
 */
export class RectangleTool extends BaseTool {
  private static instance: RectangleTool | null = null
  private editing: boolean = false
  private mousedown: boolean = false
  private mousemove: boolean = false
  private lastX: number = -1
  private lastY: number = -1
  private mouseDownX: number = -1
  private mouseDownY: number = -1
  private cube: boolean = false
  private rectX: number = -1
  private rectY: number = -1
  private rectWidth: number = 0
  private rectHeight: number = 0

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
  static getInstance(canvas?: HTMLCanvasElement, config?: IToolConfig): RectangleTool {
    if (!RectangleTool.instance) {
      if (!canvas || !config) {
        throw new Error('RectangleTool: canvas and config are required for first initialization')
      }
      RectangleTool.instance = new RectangleTool(canvas, config)
    }
    return RectangleTool.instance
  }

  /**
   * 重置单例（用于测试）
   */
  static reset(): void {
    if (RectangleTool.instance) {
      RectangleTool.instance.cleanup()
      RectangleTool.instance = null
    }
  }

  get name(): string {
    return 'rectangle'
  }

  async init(): Promise<void> {
    this.editing = false
    this.mousedown = false
    this.mousemove = false
    this.lastX = -1
    this.lastY = -1
    this.mouseDownX = -1
    this.mouseDownY = -1
    this.cube = false
    this.rectX = -1
    this.rectY = -1
    this.rectWidth = 0
    this.rectHeight = 0
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
    this.cube = false
    this.rectX = -1
    this.rectY = -1
    this.rectWidth = 0
    this.rectHeight = 0
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
      if (!this.cube) {
        this.rectWidth = Math.abs(_x - this.mouseDownX)
        this.rectHeight = Math.abs(_y - this.mouseDownY)

        if (_x >= this.mouseDownX && _y >= this.mouseDownY) {
          this.rectX = this.mouseDownX
          this.rectY = this.mouseDownY
        } else if (_x <= this.mouseDownX && _y <= this.mouseDownY) {
          this.rectX = _x
          this.rectY = _y
        } else if (_x >= this.mouseDownX && _y <= this.mouseDownY) {
          this.rectX = this.mouseDownX
          this.rectY = _y
        } else {
          this.rectX = _x
          this.rectY = this.mouseDownY
        }
      } else {
        const len = Math.max(Math.abs(_x - this.mouseDownX), Math.abs(_y - this.mouseDownY))
        const useX = !!(Math.abs(_x - this.mouseDownX) > Math.abs(_y - this.mouseDownY))
        this.rectWidth = len
        this.rectHeight = len

        if (_x >= this.mouseDownX && _y >= this.mouseDownY) {
          this.rectX = this.mouseDownX
          this.rectY = this.mouseDownY
        } else if (_x <= this.mouseDownX && _y <= this.mouseDownY) {
          this.rectX = this.mouseDownX - len
          this.rectY = this.mouseDownY - len
        } else if (_x >= this.mouseDownX && _y <= this.mouseDownY) {
          if (useX) {
            this.rectX = this.mouseDownX
            this.rectY = this.mouseDownY - len
          } else {
            this.rectX = this.mouseDownX
            this.rectY = _y
          }
        } else {
          if (useX) {
            this.rectX = _x
            this.rectY = this.mouseDownY
          } else {
            this.rectX = this.mouseDownX - len
            this.rectY = this.mouseDownY
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
      const component = this.genRectangleComponent(this.rectX, this.rectY, this.rectWidth, this.rectHeight)
      this.mousedown = false
      this.mousemove = false
      this.cube = false
      this.mouseDownX = -1
      this.mouseDownY = -1
      this.rectX = -1
      this.rectY = -1
      this.rectWidth = 0
      this.rectHeight = 0

      const isGlyph = this.config.mode === 'glyph'
      if (isGlyph) {
        const glyphStore = useGlyphStore()
        glyphStore.addComponent(component)
      } else {
        const characterStore = useCharacterStore()
        characterStore.addComponent(component)
      }
    } else {
      this.mousedown = false
      this.mousemove = false
      this.cube = false
      this.mouseDownX = -1
      this.mouseDownY = -1
      this.rectX = -1
      this.rectY = -1
      this.rectWidth = 0
      this.rectHeight = 0
    }
    this.triggerRender()
  }

  /**
   * 键盘按下事件
   */
  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.cube = true
    }
  }

  /**
   * 键盘抬起事件
   */
  private onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.cube = false
    }
  }

  /**
   * 生成矩形组件
   */
  private genRectangleComponent(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string = '',
    strokeColor: string = '#000'
  ): IComponent {
    const projectStore = useProjectStore()
    const points = getRectanglePoints(width, height, x, y)

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
      w: width,
      h: height,
      rotation,
      flipX,
      flipY,
    })
    const contour_points = formatPoints(transformed_points, options, 1)
    const contour = genRectangleContour(contour_points)

    const scale = 100 / (options.unitsPerEm as number)
    const preview_points = transformed_points.map((point) => {
      return Object.assign({}, point, {
        x: point.x * scale,
        y: point.y * scale,
      })
    })
    const preview_contour = genRectangleContour(preview_points, true)

    return {
      uuid: genUUID(),
      type: 'rectangle',
      name: 'rectangle',
      lock: false,
      visible: true,
      value: {
        width,
        height,
        fillColor,
        strokeColor,
        closePath: true,
        preview: preview_contour,
        contour: contour,
      } as unknown as IRectangleComponent,
      x,
      y,
      w: width,
      h: height,
      rotation: 0,
      flipX: false,
      flipY: false,
      usedInCharacter: true,
      ox: 0,
      oy: 0,
    }
  }

  /**
   * 渲染矩形编辑器
   */
  private render(canvas: HTMLCanvasElement): void {
    if (this.rectX === -1 || this.rectY === -1 || this.rectWidth === 0 || this.rectHeight === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const _x = mapCanvasX(this.rectX)
    const _y = mapCanvasY(this.rectY)
    const _w = mapCanvasWidth(this.rectWidth)
    const _h = mapCanvasHeight(this.rectHeight)

    // 使用全局线宽
    const strokeWidth = getStrokeWidth()
    ctx.lineWidth = strokeWidth

    ctx.strokeStyle = '#000'
    ctx.strokeRect(_x, _y, _w, _h)

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
