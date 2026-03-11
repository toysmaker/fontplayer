/**
 * 钢笔编辑工具
 * 单例模式，负责钢笔组件的路径编辑（锚点和控制点）
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { distance, rotatePoint, transformPoints, getBound } from '@/core/utils/math'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight, mapCanvasCoords } from '@/utils/canvas'
import { getCoord } from '../utils/coord'
import type { IComponent, IPenComponent } from '@/core/types'
import type { IPoint } from '@/core/script/types'
import * as R from 'ramda'
import { listToMap } from '@/core/utils/data'

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

  activate(): void {
    this.isActive = true
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
    
    const selectedComponent = isGlyph ? glyphStore.selectedComponent : characterStore.selectedComponent
    if (!selectedComponent || !selectedComponent.visible || selectedComponent.type !== 'pen') {
      this.mousedown = false
      return
    }

    const penComponent = selectedComponent.value as unknown as IPenComponent
    if (!penComponent.editMode) {
      this.mousedown = false
      return
    }

    const orderedList = isGlyph 
      ? glyphStore.orderedListWithItemsForCurrentGlyph 
      : characterStore.orderedListWithItemsForCurrentCharacterFile

    const { x, y, w, h, rotation } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(e.offsetX), y: this.getCoord(e.offsetY) },
      { x: x + w / 2, y: y + h / 2 },
      -rotation
    )

    const d = 5
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
            return
          } else if (i === 1 && _index === _points.length - 1) {
            // 最后一个锚点（和第一个锚点重合），第二个控制点为第一个锚点的第一个控制点
            this.selectPenPoint = point.uuid
            this.lastX = _x
            this.lastY = _y
            this.mousedown = true
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
  }

  /**
   * 鼠标移动事件
   */
  onMouseMove(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? glyphStore.selectedComponent : characterStore.selectedComponent
    if (!selectedComponent || !selectedComponent.visible || selectedComponent.type !== 'pen') return

    const penComponent = selectedComponent.value as unknown as IPenComponent
    if (!penComponent.editMode) return

    const { x, y, w, h, rotation, flipX, flipY, uuid } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(e.offsetX), y: this.getCoord(e.offsetY) },
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

      const modifyComponent = isGlyph ? glyphStore.modifyComponent : characterStore.modifyComponent
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
      _points.forEach((point: IPoint, index) => {
        if (distance(_x, _y, point.x, point.y) <= 5) {
          const originalPoint = points.find(p => p.uuid === point.uuid)
          if (originalPoint) {
            if (originalPoint.type === 'control' && index === points.length - 1 && points.length >= 2 && originalPoint.x === points[1].x && originalPoint.y === points[1].y) {
              // 如果未闭合路径，且最后一个控制点和第一个控制点重合，改变第一个控制点
              return
            } else {
              this.hoverPenPoint = originalPoint.uuid
            }
          }
        }
      })
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
    
    const selectedComponent = isGlyph ? glyphStore.selectedComponent : characterStore.selectedComponent
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
      
      const selectedComponent = isGlyph ? glyphStore.selectedComponent : characterStore.selectedComponent
      if (!selectedComponent || !selectedComponent.visible) return

      this.modifyComponentValue(selectedComponent, isGlyph)
      if (isGlyph) {
        glyphStore.clearSelection()
      } else {
        characterStore.clearSelection()
      }
    }
  }

  /**
   * 修改组件值（更新contour和preview）
   */
  private modifyComponentValue(component: IComponent, isGlyph: boolean): void {
    // TODO: 实现组件值的更新逻辑
    // 参考原工程 penSelect.ts 的 modifyComponentValue 函数
    // 需要根据组件类型生成contour和preview
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
    
    const selectedComponent = isGlyph ? glyphStore.selectedComponent : characterStore.selectedComponent
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

    ctx.save()
    ctx.strokeStyle = '#153063'

    // 应用旋转
    if (rotation !== 0) {
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
    }

    const d = 10

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
