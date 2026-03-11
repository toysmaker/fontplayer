/**
 * 钢笔工具
 * 单例模式，负责创建钢笔路径（贝塞尔曲线）
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { getBound, transformPoints, isNearPoint } from '@/core/utils/math'
import { mapCanvasCoords } from '@/utils/canvas'
import { getCoord } from '../utils/coord'
import { genUUID } from '@/utils/uuid'
import { formatPoints, genPenContour } from '@/core/utils/contour'
import type { IComponent, IPenComponent } from '@/core/types'
import type { IPoint } from '@/core/script/types'
import * as R from 'ramda'

/**
 * 钢笔工具单例
 */
export class PenTool extends BaseTool {
  private static instance: PenTool | null = null
  private points: IPoint[] = []
  private editing: boolean = false
  private mousedown: boolean = false
  private mousemove: boolean = false
  private editAnchor: { uuid: string; index: number } | null = null
  private closePath: boolean = false
  private _lastControl: IPoint | undefined
  private _controlIndex: number | undefined
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
  static getInstance(canvas?: HTMLCanvasElement, config?: IToolConfig): PenTool {
    if (!PenTool.instance) {
      if (!canvas || !config) {
        throw new Error('PenTool: canvas and config are required for first initialization')
      }
      PenTool.instance = new PenTool(canvas, config)
    }
    return PenTool.instance
  }

  /**
   * 重置单例（用于测试）
   */
  static reset(): void {
    if (PenTool.instance) {
      PenTool.instance.cleanup()
      PenTool.instance = null
    }
  }

  get name(): string {
    return 'pen'
  }

  async init(): Promise<void> {
    this.points = []
    this.editing = false
    this.mousedown = false
    this.mousemove = false
    this.editAnchor = null
    this.closePath = false
    this._lastControl = undefined
    this._controlIndex = undefined
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
    this.editAnchor = null
    this.closePath = false
    this._lastControl = undefined
    this._controlIndex = undefined
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
    this.canvas.addEventListener('mousemove', this.mouseMoveHandler)
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
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(e: MouseEvent): void {
    this.mousedown = true
    this.editing = true

    if (!this.points.length) {
      // 第一个锚点
      const _anchor: IPoint = {
        uuid: genUUID(),
        type: 'anchor',
        x: this.getCoord(e.offsetX),
        y: this.getCoord(e.offsetY),
        origin: null,
        isShow: true,
      }
      const _control: IPoint = {
        uuid: genUUID(),
        type: 'control',
        x: this.getCoord(e.offsetX),
        y: this.getCoord(e.offsetY),
        origin: _anchor.uuid,
        isShow: true,
      }
      this.editAnchor = {
        uuid: _anchor.uuid,
        index: 0,
      }
      this.points = [_anchor, _control]
      this.editAnchor = {
        uuid: this.points[0].uuid,
        index: 0,
      }
    } else {
      this.editAnchor = {
        uuid: this.points[this.points.length - 2].uuid,
        index: this.points.length - 2,
      }
    }
    this.triggerRender()
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.points.length || !this.editing) return

    const _points = R.clone(this.points)

    if (this.mousedown) {
      if (this._lastControl) {
        _points[this._controlIndex!] = this._lastControl
      }

      // 长按鼠标
      if (this.editAnchor!.index === 0) {
        // 第一个锚点
        const _anchor = _points[this.editAnchor!.index]
        const _control = _points[this.editAnchor!.index + 1]
        // 将第一个锚点对应的控制点设置为鼠标移动位置
        _control.x = this.getCoord(e.offsetX)
        _control.y = this.getCoord(e.offsetY)
        _control.isShow = true
      } else {
        // 后续锚点
        const _anchor = _points[this.editAnchor!.index]
        const _control1 = _points[this.editAnchor!.index - 1]
        const _control2 = _points[this.editAnchor!.index + 1]
        // 将锚点对应的后续控制点设置为鼠标移动位置
        _control2.x = this.getCoord(e.offsetX)
        _control2.y = this.getCoord(e.offsetY)
        _control2.isShow = true
        // 将锚点对应的前接控制点设置为与后续控制点对称的位置
        _control1.x = _anchor.x - (this.getCoord(e.offsetX) - _anchor.x)
        _control1.y = _anchor.y - (this.getCoord(e.offsetY) - _anchor.y)
        _control1.isShow = true
      }
      this.mousemove = true
      this.points = _points
      this.triggerRender()
    }

    if (!this.mousedown) {
      if (!this.mousemove && _points.length) {
        // 第一次移动鼠标
        this._lastControl = Object.assign({}, _points[_points.length - 1])
        this._controlIndex = _points.length - 1
        const _anchor: IPoint = {
          uuid: genUUID(),
          type: 'anchor',
          x: this.getCoord(e.offsetX),
          y: this.getCoord(e.offsetY),
          origin: null,
          isShow: true,
        }
        const _control1: IPoint = {
          uuid: genUUID(),
          type: 'control',
          x: _anchor.x,
          y: _anchor.y,
          origin: _anchor.uuid,
          isShow: false,
        }
        const _control2: IPoint = {
          uuid: genUUID(),
          type: 'control',
          x: _anchor.x,
          y: _anchor.y,
          origin: _anchor.uuid,
          isShow: false,
        }
        _points.push(_control1, _anchor, _control2)
        this.points = _points
        this.mousemove = true
        this.triggerRender()
      } else if (_points.length) {
        // 移动鼠标
        this._controlIndex = _points.length - 4
        const _anchor = _points[_points.length - 2]
        const _control1 = _points[_points.length - 3]
        const _control2 = _points[_points.length - 1]
        _anchor.x = this.getCoord(e.offsetX)
        _anchor.y = this.getCoord(e.offsetY)
        _control2.x = this.getCoord(e.offsetX)
        _control2.y = this.getCoord(e.offsetY)
        this.closePath = false

        // 当鼠标移动至第一个锚点所在位置附近时，自动闭合路径
        if (isNearPoint(this.getCoord(e.offsetX), this.getCoord(e.offsetY), this.points[0].x, this.points[0].y, this.nearD)) {
          // 将最后一个锚点位置设置为第一个锚点位置
          _anchor.x = this.points[0].x
          _anchor.y = this.points[0].y
          // 自动延切线与第一条贝塞尔曲线进行连接
          _control2.x = this.points[1].x
          _control2.y = this.points[1].y
          _control1.x = this.points[0].x - (this.points[1].x - this.points[0].x)
          _control1.y = this.points[0].y - (this.points[1].y - this.points[0].y)
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
    this.editAnchor = null

    if (this.closePath) {
      this.editing = false
      const component = this.genPenComponent(R.clone(this.points), true)
      this.points = []
      this._lastControl = undefined
      this._controlIndex = undefined
      this.closePath = false
      this.editAnchor = null

      const isGlyph = this.config.mode === 'glyph'
      if (isGlyph) {
        const glyphStore = useGlyphStore()
        glyphStore.addComponent(component)
      } else {
        const characterStore = useCharacterStore()
        characterStore.addComponent(component)
      }
      this.triggerRender()
    }
  }

  /**
   * 键盘按下事件
   */
  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Enter') {
      if (!this.points.length || !this.editing) return

      const _points = R.clone(this.points)
      if (this.points.length >= 2) {
        const _anchor: IPoint = {
          uuid: genUUID(),
          type: 'anchor',
          x: this.points[0].x,
          y: this.points[0].y,
          origin: null,
          isShow: true,
        }
        const _control1: IPoint = {
          uuid: genUUID(),
          type: 'control',
          x: this.points[0].x,
          y: this.points[0].y,
          origin: _anchor.uuid,
          isShow: false,
        }
        const _control2: IPoint = {
          uuid: genUUID(),
          type: 'control',
          x: this.points[0].x,
          y: this.points[0].y,
          origin: _anchor.uuid,
          isShow: false,
        }
        _points.push(_control1, _anchor, _control2)
        this.points = _points
      }

      this.editing = false
      const isGlyph = this.config.mode === 'glyph'
      if (isGlyph) {
        const glyphStore = useGlyphStore()
        glyphStore.addComponent(this.genPenComponent(R.clone(this.points), true))
      } else {
        const characterStore = useCharacterStore()
        characterStore.addComponent(this.genPenComponent(R.clone(this.points), true))
      }
      this.points = []
      this._lastControl = undefined
      this._controlIndex = undefined
      this.closePath = false
      this.editAnchor = null
      this.triggerRender()
    }
  }

  /**
   * 生成钢笔组件
   */
  private genPenComponent(
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
    const contour = genPenContour(contour_points)

    const scale = 100 / (options.unitsPerEm as number)
    const preview_points = transformed_points.map((point) => {
      return Object.assign({}, point, {
        x: point.x * scale,
        y: point.y * scale,
      })
    })
    const preview_contour = genPenContour(preview_points, true)

    return {
      uuid: genUUID(),
      type: 'pen',
      name: 'pen',
      lock: false,
      visible: true,
      value: {
        points: points,
        fillColor,
        strokeColor,
        closePath,
        editMode: false,
        preview: preview_contour,
        contour: contour,
      } as unknown as IPenComponent,
      x,
      y,
      w,
      h,
      rotation: 0,
      flipX: false,
      flipY: false,
      usedInCharacter: true,
      ox: 0,
      oy: 0,
    }
  }

  /**
   * 渲染钢笔编辑器
   */
  private render(canvas: HTMLCanvasElement): void {
    if (!this.points.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const _points = this.points.map((point: IPoint) => {
      return {
        isShow: point.isShow,
        ...mapCanvasCoords({
          x: point.x,
          y: point.y,
        }),
      }
    })

    const w = 10
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.moveTo(_points[0].x, _points[0].y)

    if (_points.length >= 4) {
      ctx.bezierCurveTo(_points[1].x, _points[1].y, _points[2].x, _points[2].y, _points[3].x, _points[3].y)
    }

    for (let i = 3; i < _points.length - 1; i += 3) {
      if (i + 3 >= _points.length) break
      ctx.bezierCurveTo(_points[i + 1].x, _points[i + 1].y, _points[i + 2].x, _points[i + 2].y, _points[i + 3].x, _points[i + 3].y)
    }

    ctx.stroke()
    ctx.closePath()

    // 绘制锚点和控制点
    for (let i = 0; i < _points.length - 1; i += 3) {
      if (_points[i].isShow) {
        ctx.fillRect(_points[i].x - w / 2, _points[i].y - w / 2, w, w)
      }
      if (i + 1 < _points.length && _points[i + 1].isShow) {
        ctx.strokeRect(_points[i + 1].x - w / 2, _points[i + 1].y - w / 2, w, w)
      }
      if (i + 2 < _points.length && _points[i + 2].isShow) {
        ctx.strokeRect(_points[i + 2].x - w / 2, _points[i + 2].y - w / 2, w, w)
      }
    }

    // 绘制控制线
    ctx.beginPath()
    ctx.moveTo(_points[0].x, _points[0].y)
    if (_points.length > 1) {
      ctx.lineTo(_points[1].x, _points[1].y)
    }
    ctx.stroke()
    ctx.closePath()

    for (let i = 3; i < _points.length - 1; i += 3) {
      if (_points[i - 1].isShow) {
        ctx.beginPath()
        ctx.moveTo(_points[i].x, _points[i].y)
        ctx.lineTo(_points[i - 1].x, _points[i - 1].y)
        ctx.stroke()
        ctx.closePath()
      }
      if (i + 1 < _points.length && _points[i + 1].isShow) {
        ctx.beginPath()
        ctx.moveTo(_points[i].x, _points[i].y)
        ctx.lineTo(_points[i + 1].x, _points[i + 1].y)
        ctx.stroke()
        ctx.closePath()
      }
    }
  }
}
