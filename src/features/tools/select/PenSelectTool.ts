/**
 * 钢笔编辑工具
 * 单例模式，负责钢笔组件的路径编辑（锚点和控制点）
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useProjectStore } from '@/stores/project'
import { distance, rotatePoint, transformPoints, getBound } from '@/core/utils/math'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight, mapCanvasCoords } from '@/utils/canvas'
import { getCoord } from '../utils/coord'
import type { IComponent, IPenComponent } from '@/core/types'
import type { IPoint } from '@/core/script/types'
import * as R from 'ramda'
import { listToMap } from '@/core/utils/data'
import { formatPoints, genPenContour } from '@/core/utils/contour'
import { getStrokeWidth } from '@/utils/canvas-utils'

/**
 * 编辑模式下的固定边界框（按组件UUID索引）
 * 用于在编辑过程中保持坐标映射的一致性
 */
export const editModeFixedBounds: Map<string, { x: number; y: number; w: number; h: number }> = new Map()

/**
 * 钢笔编辑工具单例
 */
export class PenSelectTool extends BaseTool {
  private static instance: PenSelectTool | null = null
  private selectAnchor: string = ''
  private selectPenPoint: string = ''
  private hoverPenPoint: string = ''
  private lastX: number = -1
  private lastY: number = -1
  private mousedown: boolean = false
  private initialOriginBounds: { x: number; y: number; w: number; h: number } | null = null

  /**
   * 检查是否正在拖拽（用于防止在拖拽过程中被停用）
   */
  isDragging(): boolean {
    return this.mousedown && !!this.selectPenPoint
  }

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
  static getInstance(canvas?: HTMLCanvasElement, config?: IToolConfig): PenSelectTool {
    if (!PenSelectTool.instance) {
      if (!canvas || !config) {
        throw new Error('PenSelectTool: canvas and config are required for first initialization')
      }
      PenSelectTool.instance = new PenSelectTool(canvas, config)
    }
    return PenSelectTool.instance
  }

  /**
   * 重置单例（用于测试）
   */
  static reset(): void {
    if (PenSelectTool.instance) {
      PenSelectTool.instance.cleanup()
      PenSelectTool.instance = null
    }
    editModeFixedBounds.clear()
  }

  get name(): string {
    return 'pen-select'
  }

  async init(): Promise<void> {
    // 初始化状态
    this.selectAnchor = ''
    this.selectPenPoint = ''
    this.hoverPenPoint = ''
    this.lastX = -1
    this.lastY = -1
    this.mousedown = false
    this.initialOriginBounds = null
  }

  /**
   * 当组件切换时，重置初始边界框
   * 这样每次进入编辑模式时都会重新计算初始边界框
   */
  resetInitialBounds(): void {
    this.initialOriginBounds = null
  }

  activate(): void {
    this.isActive = true

    // 立即初始化 editModeFixedBounds，确保首次渲染时有正确的固定边界框
    // 不能等到第一次鼠标移动时才设置，否则渲染时会回退到动态 getBound(points)，
    // 导致拖拽锚点/控制点出包围框后其他点被压缩至包围框内。
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (selectedComponent && selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      const { points } = penComponent
      if (points && points.length > 0) {
        const bounds = getBound(
          points.reduce((arr: Array<{ x: number; y: number }>, point: IPoint) => {
            arr.push({ x: point.x, y: point.y })
            return arr
          }, [])
        )
        this.initialOriginBounds = bounds
        editModeFixedBounds.set(selectedComponent.uuid, bounds)
      }
    }

    this.bindEvents()
    this.setRenderFunction(this.render.bind(this))
  }

  deactivate(): void {
    this.isActive = false
    this.unbindEvents()
    this.selectAnchor = ''
    this.selectPenPoint = ''
    this.hoverPenPoint = ''
    this.mousedown = false
  }

  cleanup(): void {
    this.deactivate()
    this.initialOriginBounds = null
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
    document.addEventListener('mousemove', this.mouseMoveHandler)
    document.addEventListener('mouseup', this.mouseUpHandler)
    this.canvas.addEventListener('keydown', this.keyDownHandler)
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
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = null
    }
    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler)
      this.mouseUpHandler = null
    }
    if (this.keyDownHandler) {
      this.canvas.removeEventListener('keydown', this.keyDownHandler)
      this.keyDownHandler = null
    }
  }

  /**
   * 鼠标按下事件
   */
  onMouseDown(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (!selectedComponent || !selectedComponent.visible || selectedComponent.type !== 'pen') {
      this.mousedown = false
      return
    }

    const penComponent = selectedComponent.value as unknown as IPenComponent
    if (!penComponent.editMode) {
      this.mousedown = false
      return
    }

    // 获取正确的鼠标坐标（处理事件可能不在canvas上触发的情况）
    let offsetX = e.offsetX
    let offsetY = e.offsetY
    const target = e.target as HTMLElement
    if (target !== this.canvas && !this.canvas.contains(target)) {
      const rect = this.canvas.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
    }

    const { x, y, w, h, rotation } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(offsetX), y: this.getCoord(offsetY) },
      { x: x + w / 2, y: y + h / 2 },
      -rotation
    )

    const d = getStrokeWidth() * 2//5
    const _points = this.transformPenPoints(selectedComponent, false)

    // 检查是否点击在锚点或控制点上
    for (let i = 0; i < _points.length - 1; i++) {
      const point = _points[i]
      if (distance(_x, _y, point.x, point.y) <= d) {
        if (point.type === 'anchor') {
          this.selectAnchor = point.uuid
          this.selectPenPoint = point.uuid
          this.lastX = _x
          this.lastY = _y
          this.mousedown = true
          this.triggerRender() // 选中锚点后触发重新渲染
          return
        } else if (this.selectAnchor) {
          // 选择控制点
          const _index: number = (() => {
            for (let j = 0; j < _points.length; j++) {
              if (_points[j].uuid === this.selectAnchor) {
                return j
              }
            }
            return -1
          })()
          if (i <= _index + 4 && i >= _index - 4) {
            this.selectPenPoint = point.uuid
            this.lastX = _x
            this.lastY = _y
            this.mousedown = true
            this.triggerRender() // 选中控制点后触发重新渲染
            return
          } else if (i === 1 && _index === _points.length - 1) {
            // 最后一个锚点（和第一个锚点重合），第二个控制点为第一个锚点的第一个控制点
            this.selectPenPoint = point.uuid
            this.lastX = _x
            this.lastY = _y
            this.mousedown = true
            this.triggerRender() // 选中控制点后触发重新渲染
            return
          }
        }
      }
    }

    // 点击在组件边界框内但没有点击到锚点或控制点，清除之前的状态
    this.selectPenPoint = ''
    this.selectAnchor = ''
    this.hoverPenPoint = ''
    this.mousedown = false
    this.triggerRender() // 清除选择后触发重新渲染
  }

  /**
   * 鼠标移动事件
   */
  onMouseMove(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (!selectedComponent || !selectedComponent.visible || selectedComponent.type !== 'pen') return

    const penComponent = selectedComponent.value as unknown as IPenComponent
    if (!penComponent.editMode) return

    // 获取正确的鼠标坐标（处理事件可能不在canvas上触发的情况）
    let offsetX = e.offsetX
    let offsetY = e.offsetY
    const target = e.target as HTMLElement
    if (target !== this.canvas && !this.canvas.contains(target)) {
      const rect = this.canvas.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
    }

    const { x, y, w, h, rotation, flipX, flipY, uuid } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(offsetX), y: this.getCoord(offsetY) },
      { x: x + w / 2, y: y + h / 2 },
      -rotation
    )

    const { points, closePath } = penComponent

    // 在首次进入编辑模式时，保存初始边界框
    if (!this.initialOriginBounds) {
      this.initialOriginBounds = getBound(
        points.reduce((arr: Array<{x: number, y: number }>, point: IPoint) => {
          arr.push({
            x: point.x,
            y: point.y,
          })
          return arr
        }, [])
      )
      editModeFixedBounds.set(uuid, this.initialOriginBounds)
    }

    const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = this.initialOriginBounds

    if (this.mousedown && this.selectPenPoint) {
      // 需要将鼠标坐标映射回原始点空间（考虑flipX/flipY）
      let flippedPoint = {
        x: origin_x + (_x - x) * origin_w / w,
        y: origin_y + (_y - y) * origin_h / h,
      }

      // 反向翻转（从翻转后坐标恢复到原始坐标）
      let mousePoint = { ...flippedPoint }
      if (flipX) {
        const origin_center_x = origin_x + origin_w / 2
        mousePoint.x = 2 * origin_center_x - flippedPoint.x
      }
      if (flipY) {
        const origin_center_y = origin_y + origin_h / 2
        mousePoint.y = 2 * origin_center_y - flippedPoint.y
      }

      const _points = R.clone(points)
      _points.forEach((point: IPoint, index: number) => {
        if (this.selectPenPoint === point.uuid) {
          // 对于闭合路径，起始锚点和收尾锚点重合，应该一致移动
          if (point.type === 'anchor' && closePath && (index < 2 || index > _points.length - 3)) {
            if (index < 2) {
              for(let i = _points.length - 2; i < _points.length; i++) {
                if (_points[i].type === 'anchor' && _points[i].x === point.x && _points[i].y === point.y) {
                  _points[i].x = mousePoint.x
                  _points[i].y = mousePoint.y
                }
              }
            } else if (index > _points.length - 3) {
              for(let i = 0; i < 2; i++) {
                if (points[i].type === 'anchor' && _points[i].x === point.x && _points[i].y === point.y) {
                  _points[i].x = mousePoint.x
                  _points[i].y = mousePoint.y
                }
              }
            }
          }

          point.x = mousePoint.x
          point.y = mousePoint.y
        }
      })

      const modifyComponent = isGlyph ? (glyphStore as any).modifyComponent : (characterStore as any).modifyComponent
      modifyComponent(uuid, {
        value: {
          points: _points
        }
      } as Partial<IComponent>)

      this.triggerRender()
    }

    if (!this.mousedown) {
      // hover检测
      const _points = this.transformPenPoints(selectedComponent, false)
      let foundHover = false
      const oldHoverPenPoint = this.hoverPenPoint
      
      // 先清除hover状态
      this.hoverPenPoint = ''
      const d = getStrokeWidth() * 2//5

      // 遍历所有点，找到距离最近的点
      for (let i = 0; i < _points.length; i++) {
        const point = _points[i]
        if (distance(_x, _y, point.x, point.y) <= d) {
          const originalPoint = points.find(p => p.uuid === point.uuid)
          if (originalPoint) {
            if (originalPoint.type === 'control' && i === points.length - 1 && points.length >= 2 && originalPoint.x === points[1].x && originalPoint.y === points[1].y) {
              // 如果未闭合路径，且最后一个控制点和第一个控制点重合，跳过
              continue
            } else {
              this.hoverPenPoint = originalPoint.uuid
              foundHover = true
              // 找到第一个匹配的点就停止（距离检测已经按顺序进行）
              break
            }
          }
        }
      }
      
      // 如果hover状态发生变化，触发重新渲染
      if (oldHoverPenPoint !== this.hoverPenPoint) {
        this.triggerRender()
      }
    }

    this.lastX = _x
    this.lastY = _y
  }

  /**
   * 鼠标抬起事件
   */
  onMouseUp(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (!selectedComponent || !selectedComponent.visible) return

    this.modifyComponentValue(selectedComponent, isGlyph)
    this.mousedown = false
  }

  /**
   * 键盘按下事件
   */
  onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Enter') {
      const characterStore = useCharacterStore()
      const glyphStore = useGlyphStore()
      const isGlyph = this.config.mode === 'glyph'
      
      const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
      if (!selectedComponent || !selectedComponent.visible) return

      this.modifyComponentValue(selectedComponent, isGlyph)
      if (isGlyph) {
        (glyphStore as any).clearSelection()
      } else {
        (characterStore as any).clearSelection()
      }
    }
  }

  /**
   * 修改组件值（更新contour和preview）
   */
  private modifyComponentValue(component: IComponent, isGlyph: boolean): void {
    if (!component || component.type !== 'pen') return
    
    const projectStore = useProjectStore()
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const modifyComponent = isGlyph ? (glyphStore as any).modifyComponent : (characterStore as any).modifyComponent
    
    const { x, y, w, h, rotation, flipX, flipY, uuid } = component
    const penComponent = component.value as unknown as IPenComponent
    const points = penComponent.points
    const editMode = penComponent.editMode
    
    // 获取字体设置
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
    
    // 在编辑模式下，使用固定的初始边界框；否则使用当前点的边界框
    const fixedBounds = editMode ? editModeFixedBounds.get(uuid) : undefined
    
    // 转换点（应用组件的变换）
    // 注意：在编辑模式下，points 是相对于 initialOriginBounds 的，所以需要使用 fixedBounds
    const transformed_points = transformPoints(points, {
      x, y, w, h, rotation, flipX, flipY,
    }, fixedBounds)
    
    // 格式化点并生成轮廓
    const contour_points = formatPoints(transformed_points, options, 1)
    const contour = genPenContour(contour_points)
    
    // 生成预览轮廓
    const scale = 100 / (options.unitsPerEm as number)
    const preview_points = transformed_points.map((point) => {
      return Object.assign({}, point, {
        x: point.x * scale,
        y: point.y * scale,
      })
    })
    const preview_contour = genPenContour(preview_points, true)
    
    // 更新组件的 contour 和 preview
    modifyComponent(uuid, {
      value: {
        contour: contour,
        preview: preview_contour,
      }
    } as Partial<IComponent>)
  }

  /**
   * 转换钢笔组件中的点
   */
  private transformPenPoints(component: IComponent, canvasRatio: boolean): IPoint[] {
    const { x, y, w, h, rotation, flipX, flipY, value: penComponentValue, uuid } = component
    const { points, editMode } = penComponentValue as unknown as IPenComponent

    // 在编辑模式下，使用固定的初始边界框；否则使用当前点的边界框
    const fixedBounds = editMode ? editModeFixedBounds.get(uuid) : undefined

    // 直接使用transformPoints，确保与canvas.ts中的渲染逻辑完全一致
    // 传入rotation: 0，因为旋转会通过ctx.rotate在render中处理
    let _points = transformPoints(
      points.reduce((arr: Array<{x: number, y: number }>, point: IPoint) => {
        arr.push({
          x: point.x,
          y: point.y,
        })
        return arr
      }, []),
      {
        x, y, w, h, rotation: 0, flipX, flipY,
      },
      fixedBounds
    ).map((point: { x: number; y: number }, index: number) => {
      // 保留原始点的uuid, type, origin等属性
      const originalPoint = points[index]
      return {
        ...originalPoint,
        x: point.x,
        y: point.y,
      }
    })

    // 如果需要在画布坐标中渲染，应用相同的转换逻辑
    if (canvasRatio) {
      const scale = 1 // 编辑模式下scale为1
      _points = _points.map((point: IPoint) => {
        return {
          ...point,
          ...mapCanvasCoords({
            x: point.x * scale,
            y: point.y * scale,
          })
        }
      })
    }
    return _points
  }

  /**
   * 渲染钢笔编辑器
   */
  render(canvas: HTMLCanvasElement): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (!selectedComponent || !selectedComponent.visible || selectedComponent.type !== 'pen') return

    const penComponent = selectedComponent.value as unknown as IPenComponent
    if (!penComponent.editMode) return

    const { x, y, w, h, rotation, flipX, flipY } = selectedComponent
    const _x = mapCanvasX(x)
    const _y = mapCanvasY(y)
    const _w = mapCanvasWidth(w)
    const _h = mapCanvasHeight(h)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 使用全局线宽
    const strokeWidth = getStrokeWidth()
    ctx.lineWidth = strokeWidth

    ctx.save()

    // 应用旋转（保持与组件本身渲染一致）
    if (rotation !== 0) {
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
    }

    // 渲染包围框（与 SelectTool 样式完全一致）
    const d = strokeWidth * 2 // 顶点控件内部宽高为 strokeWidth 的两倍
    ctx.strokeStyle = '#79bbff'
    ctx.strokeRect(_x, _y, _w, _h)
    ctx.strokeRect(_x - d, _y - d, d * 2, d * 2)
    ctx.strokeRect(_x + _w - d, _y - d, d * 2, d * 2)
    ctx.strokeRect(_x - d, _y + _h - d, d * 2, d * 2)
    ctx.strokeRect(_x + _w - d, _y + _h - d, d * 2, d * 2)

    const _points = this.transformPenPoints(selectedComponent, true)
    const _map = listToMap(_points, 'uuid')

    // 找到selectAnchor对应的索引
    const { index, pointType } = (() => {
      for (let i = 0; i < _points.length; i++) {
        if (_points[i].uuid === this.selectAnchor) {
          return {
            index: i,
            pointType: _points[i].type
          }
        }
      }
      return { index: -1, pointType: '' }
    })()

    // 渲染锚点和控制点
    ctx.strokeStyle = '#153063'

    if (!this.selectAnchor) {
      // 显示所有锚点
      for (let i = 0; i < _points.length; i++) {
        if (_points[i].type === 'anchor') {
          ctx.beginPath()
          ctx.ellipse(_points[i].x, _points[i].y, d, d, 0, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.closePath()
        }
      }
    } else {
      // 显示选中锚点及其控制点
      for (let i = 0; i < _points.length - 1; i++) {
        if (_points[i].type === 'anchor') {
          ctx.beginPath()
          ctx.ellipse(_points[i].x, _points[i].y, d, d, 0, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.closePath()
        }
        if (_points[i].type === 'control' && i >= index - 4 && i <= index + 4) {
          const originUUID = _points[i].origin as string
          const originAnchor: IPoint = _map[originUUID]
          ctx.strokeRect(_points[i].x - d, _points[i].y - d, 2 * d, 2 * d)
          ctx.beginPath()
          ctx.moveTo(_points[i].x, _points[i].y)
          ctx.lineTo(originAnchor.x, originAnchor.y)
          ctx.stroke()
          ctx.closePath()
        }
        if (index === _points.length - 1 && _points[i].type === 'control' && i === 1) {
          // 最后一个锚点（和第一个锚点重合），第二个控制点为第一个锚点的第一个控制点
          const originUUID = _points[i].origin as string
          const originAnchor: IPoint = _map[originUUID]
          ctx.strokeRect(_points[i].x - d, _points[i].y - d, 2 * d, 2 * d)
          ctx.beginPath()
          ctx.moveTo(_points[i].x, _points[i].y)
          ctx.lineTo(originAnchor.x, originAnchor.y)
          ctx.stroke()
          ctx.closePath()
        }
      }
    }

    // 高亮hover的点
    for (let i = 0; i < _points.length; i++) {
      if (this.hoverPenPoint === _points[i].uuid) {
        ctx.fillStyle = '#79bbff'
        if (_points[i].type === 'anchor') {
          ctx.beginPath()
          ctx.ellipse(_points[i].x, _points[i].y, d, d, 0, 0, 2 * Math.PI)
          ctx.fill()
          ctx.closePath()
        }
        if (_points[i].type === 'control' && i >= index - 4 && i <= index + 4) {
          ctx.fillRect(_points[i].x - d, _points[i].y - d, 2 * d, 2 * d)
        }
        ctx.fillStyle = '#fff'
      }
    }

    ctx.restore()
  }
}
