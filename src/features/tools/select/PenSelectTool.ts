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
import type { IComponent, IPenComponent, IGlyphComponent } from '@/core/types'
import type { IPoint } from '@/core/script/types'
import * as R from 'ramda'
import { listToMap } from '@/core/utils/data'
import { formatPoints, genPenContour } from '@/core/utils/contour'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { roundToPrecision } from '@/utils/number'

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

  /**
   * 骨架绑定自由编辑上下文
   * 当设置为非 null 时，PenSelectTool 操作内嵌在字形组件中的钢笔轮廓，
   * 而非 store 中直接选中的钢笔组件。
   */
  static skeletonFreeEditContext: {
    glyphComponent: IComponent | IGlyphComponent
    penComponent: IPenComponent
    penUUID: string
  } | null = null

  /**
   * 解析骨架自由编辑上下文，返回替换数据源
   * 若未设置则返回 null，方法应回退到 store 读取
   */
  private resolveSkeletonContext(): {
    penComponent: IPenComponent
    penUUID: string
    bounds: { x: number; y: number; w: number; h: number; rotation: number }
  } | null {
    if (PenSelectTool.skeletonFreeEditContext) {
      const ctx = PenSelectTool.skeletonFreeEditContext
      const gc = ctx.glyphComponent
      return {
        penComponent: ctx.penComponent,
        penUUID: ctx.penUUID,
        bounds: {
          x: (gc as any).ox ?? gc.x ?? 0,
          y: (gc as any).oy ?? gc.y ?? 0,
          w: gc.w || 100,
          h: gc.h || 100,
          rotation: gc.rotation ?? 0,
        },
      }
    }
    return null
  }

  activate(): void {
    this.isActive = true

    // 骨架自由编辑模式：使用上下文中的 bounds，不与 store 中的 selectedComponent 交互
    const skCtx = this.resolveSkeletonContext()
    if (skCtx) {
      if (!editModeFixedBounds.has(skCtx.penUUID)) {
        // 使用钢笔点的实际包围框作为 origin bounds（用于 hover 检测等）
        const penPoints = skCtx.penComponent.points
        const penBound = penPoints && penPoints.length > 0
          ? getBound(penPoints.reduce((arr: Array<{ x: number; y: number }>, p: IPoint) => {
              arr.push({ x: p.x, y: p.y })
              return arr
            }, []))
          : { x: skCtx.bounds.x, y: skCtx.bounds.y, w: 100, h: 100 }
        editModeFixedBounds.set(skCtx.penUUID, {
          x: penBound.x,
          y: penBound.y,
          w: penBound.w || 100,
          h: penBound.h || 100,
        })
      }
      this.initialOriginBounds = editModeFixedBounds.get(skCtx.penUUID)!
      this.bindEvents()
      this.setRenderFunction(this.render.bind(this))
      this.triggerRender()
      return
    }

    // 立即初始化 editModeFixedBounds，确保首次渲染时有正确的固定边界框
    // 与 origin 逻辑：activate/onMouseMove 仅首次设，不覆盖已有条目避免坐标系跳变。
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (selectedComponent && selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      const { points } = penComponent
      if (points && points.length > 0) {
        // 只有在 editModeFixedBounds 中尚无该 uuid 的条目时才写入新边界。
        // 若工具切换后重新激活（编辑模式仍开着），保留原有边界避免坐标系跳变。
        // 条目应仅在 handleChangeEditMode(false) 关闭编辑模式时被删除。
        if (!editModeFixedBounds.has(selectedComponent.uuid)) {
          const bounds = getBound(
            points.reduce((arr: Array<{ x: number; y: number }>, point: IPoint) => {
              arr.push({ x: point.x, y: point.y })
              return arr
            }, [])
          )
          editModeFixedBounds.set(selectedComponent.uuid, bounds)
        }
        this.initialOriginBounds = editModeFixedBounds.get(selectedComponent.uuid)!
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
    // 骨架自由编辑模式：使用上下文中的钢笔组件
    const skCtx = this.resolveSkeletonContext()
    if (skCtx) {
      if (!skCtx.penComponent.points || skCtx.penComponent.points.length === 0) {
        this.mousedown = false
        return
      }

      const rect = this.canvas.getBoundingClientRect()
      const mx = this.getCoord(e.clientX - rect.left)
      const my = this.getCoord(e.clientY - rect.top)

      const { x: ox, y: oy, rotation } = skCtx.bounds

      // 转换为字形局部坐标
      let _x: number, _y: number
      if (rotation !== 0) {
        const centerX = ox + (skCtx.bounds.w || 100) / 2
        const centerY = oy + (skCtx.bounds.h || 100) / 2
        const rotated = rotatePoint({ x: mx, y: my }, { x: centerX, y: centerY }, -rotation)
        _x = rotated.x
        _y = rotated.y
      } else {
        _x = mx
        _y = my
      }

      const localX = _x - ox
      const localY = _y - oy

      const d = getStrokeWidth() * 2
      const _points = this.transformPenPointsForContext(skCtx, false)

      // 检查是否点击在锚点或控制点上
      for (let i = 0; i < _points.length; i++) {
        const point = _points[i]
        if (distance(mx, my, point.x, point.y) <= d) {
          if (point.type === 'anchor') {
            this.selectAnchor = point.uuid
            this.selectPenPoint = point.uuid
            this.lastX = localX
            this.lastY = localY
            this.mousedown = true
            this.triggerRender()
            return
          } else if (this.selectAnchor) {
            const _index: number = (() => {
              for (let j = 0; j < _points.length; j++) {
                if (_points[j].uuid === this.selectAnchor) return j
              }
              return -1
            })()
            if (i <= _index + 4 && i >= _index - 4) {
              this.selectPenPoint = point.uuid
              this.lastX = localX
              this.lastY = localY
              this.mousedown = true
              this.triggerRender()
              return
            } else if (i === 1 && _index === _points.length - 1) {
              this.selectPenPoint = point.uuid
              this.lastX = localX
              this.lastY = localY
              this.mousedown = true
              this.triggerRender()
              return
            }
          }
        }
      }

      this.selectPenPoint = ''
      this.selectAnchor = ''
      this.hoverPenPoint = ''
      this.mousedown = false
      this.triggerRender()
      return
    }

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

    // 统一使用 clientX - rect.left 计算鼠标坐标，与 onMouseMove 保持一致，
    // 避免 canvas 有叠加层时 offsetX/Y 相对于错误元素产生偏移。
    const rect = this.canvas.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    const { x, y, w, h, rotation } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(offsetX), y: this.getCoord(offsetY) },
      { x: x + w / 2, y: y + h / 2 },
      -rotation
    )

    const d = getStrokeWidth() * 2
    const _points = this.transformPenPoints(selectedComponent, false)

    // 检查是否点击在锚点或控制点上（含最后一个点，修复开放路径末端锚点无法选中的问题）
    for (let i = 0; i < _points.length; i++) {
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
    // 骨架自由编辑模式
    const skCtx = this.resolveSkeletonContext()
    if (skCtx) {
      this.onMouseMoveForSkeletonContext(e, skCtx)
      return
    }

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

    // 首次鼠标移动时，若 initialOriginBounds 未设置（activate 未能读到组件），在此补充设置。
    // 与 activate() 保持相同策略：editModeFixedBounds 有条目时不覆盖，确保同一次编辑会话中原点不变。
    if (!this.initialOriginBounds) {
      if (!editModeFixedBounds.has(uuid)) {
        const bounds = getBound(
          points.reduce((arr: Array<{x: number, y: number }>, point: IPoint) => {
            arr.push({ x: point.x, y: point.y })
            return arr
          }, [])
        )
        editModeFixedBounds.set(uuid, bounds)
      }
      this.initialOriginBounds = editModeFixedBounds.get(uuid)!
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
                  _points[i].x = roundToPrecision(mousePoint.x, 2)
                  _points[i].y = roundToPrecision(mousePoint.y, 2)
                }
              }
            } else if (index > _points.length - 3) {
              for(let i = 0; i < 2; i++) {
                if (points[i].type === 'anchor' && _points[i].x === point.x && _points[i].y === point.y) {
                  _points[i].x = roundToPrecision(mousePoint.x, 2)
                  _points[i].y = roundToPrecision(mousePoint.y, 2)
                }
              }
            }
          }

          point.x = roundToPrecision(mousePoint.x, 2)
          point.y = roundToPrecision(mousePoint.y, 2)
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
    // 骨架自由编辑模式：不做 modifyComponentValue（该操作由 GlyphEditPanel 的 rebind 负责）
    if (this.resolveSkeletonContext()) {
      this.mousedown = false
      return
    }

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
    // 骨架自由编辑模式：Enter 不做清除选择
    if (this.resolveSkeletonContext()) {
      return
    }

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
    
    const transformed_points = transformPoints(points, { x, y, w, h, rotation, flipX, flipY }, fixedBounds)
    
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

    const patch: Partial<IComponent> = {
      value: {
        contour: contour,
        preview: preview_contour,
      } as IComponent['value'],
    }

    modifyComponent(uuid, patch as Partial<IComponent>)
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
   * 为骨架上下文转换钢笔点（替代 transformPenPoints 在骨架模式下的调用）
   */
  /**
   * 骨架自由编辑：将钢笔点从字形局部坐标变换到画布坐标
   * 仅做平移（ox/oy），不做缩放，与 glyphInstance.render 的行为保持一致
   */
  private transformPenPointsForContext(
    skCtx: NonNullable<ReturnType<typeof this.resolveSkeletonContext>>,
    canvasRatio: boolean,
  ): IPoint[] {
    const { penComponent } = skCtx
    const { points } = penComponent
    if (!points || points.length === 0) return []

    const ox = skCtx.bounds.x
    const oy = skCtx.bounds.y

    let _points = points.map((p: IPoint) => ({
      ...p,
      x: (p.x || 0) + ox,
      y: (p.y || 0) + oy,
    }))

    if (canvasRatio) {
      _points = _points.map((p: IPoint) => ({
        ...p,
        ...mapCanvasCoords({ x: p.x, y: p.y }),
      }))
    }
    return _points
  }

  /**
   * 骨架自由编辑模式下的鼠标移动处理
   */
  /**
   * 骨架自由编辑模式下的鼠标移动处理
   * 使用简单偏移（ox/oy）而非 transformPoints 的缩放逻辑
   */
  private onMouseMoveForSkeletonContext(
    e: MouseEvent,
    skCtx: NonNullable<ReturnType<typeof this.resolveSkeletonContext>>,
  ): void {
    let offsetX = e.offsetX
    let offsetY = e.offsetY
    const target = e.target as HTMLElement
    if (target !== this.canvas && !this.canvas.contains(target)) {
      const rect = this.canvas.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
    }

    const { x: ox, y: oy, rotation } = skCtx.bounds
    const { points } = skCtx.penComponent

    // 鼠标在逻辑坐标中的位置
    const mx = this.getCoord(offsetX)
    const my = this.getCoord(offsetY)

    // 如果有旋转，反向旋转鼠标坐标到局部空间
    let _x: number, _y: number
    if (rotation !== 0) {
      const centerX = ox + (skCtx.bounds.w || 100) / 2
      const centerY = oy + (skCtx.bounds.h || 100) / 2
      const rotated = rotatePoint({ x: mx, y: my }, { x: centerX, y: centerY }, -rotation)
      _x = rotated.x
      _y = rotated.y
    } else {
      _x = mx
      _y = my
    }

    // 鼠标在字形局部坐标中的位置（减去 ox/oy）
    const localX = _x - ox
    const localY = _y - oy

    if (this.mousedown && this.selectPenPoint) {
      const _points = R.clone(points)
      _points.forEach((point: IPoint, index: number) => {
        if (this.selectPenPoint === point.uuid) {
          // 闭合路径：起始和收尾锚点同步移动
          if (point.type === 'anchor' && index < 2) {
            for (let i = _points.length - 2; i < _points.length; i++) {
              if (_points[i].type === 'anchor' && _points[i].x === point.x && _points[i].y === point.y) {
                _points[i].x = roundToPrecision(localX, 2)
                _points[i].y = roundToPrecision(localY, 2)
              }
            }
          } else if (point.type === 'anchor' && index > _points.length - 3) {
            for (let i = 0; i < 2; i++) {
              if (points[i].type === 'anchor' && _points[i].x === point.x && _points[i].y === point.y) {
                _points[i].x = roundToPrecision(localX, 2)
                _points[i].y = roundToPrecision(localY, 2)
              }
            }
          }

          point.x = roundToPrecision(localX, 2)
          point.y = roundToPrecision(localY, 2)
        }
      })

      skCtx.penComponent.points = _points
      this.triggerRender()
    }

    if (!this.mousedown) {
      // hover 检测：点已由 transformPenPointsForContext 转换到画布坐标
      const _points = this.transformPenPointsForContext(skCtx, false)
      const oldHoverPenPoint = this.hoverPenPoint
      this.hoverPenPoint = ''
      const d = getStrokeWidth() * 2

      for (let i = 0; i < _points.length; i++) {
        const p = _points[i]
        if (distance(mx, my, p.x, p.y) <= d) {
          const originalPoint = points.find((op: IPoint) => op.uuid === p.uuid)
          if (originalPoint) {
            if (originalPoint.type === 'control' && i === points.length - 1 && points.length >= 2 && originalPoint.x === points[1].x && originalPoint.y === points[1].y) {
              continue
            }
            this.hoverPenPoint = originalPoint.uuid
            break
          }
        }
      }

      if (oldHoverPenPoint !== this.hoverPenPoint) {
        this.triggerRender()
      }
    }

    this.lastX = _x
    this.lastY = _y
  }

  /**
   * 骨架自由编辑模式下的渲染
   */
  private renderForSkeletonContext(
    canvas: HTMLCanvasElement,
    skCtx: NonNullable<ReturnType<typeof this.resolveSkeletonContext>>,
  ): void {
    const { penComponent, penUUID, bounds } = skCtx
    const { points } = penComponent
    if (!points || points.length === 0) return

    const { x, y, w, h, rotation } = bounds
    const _x = mapCanvasX(x)
    const _y = mapCanvasY(y)
    const _w = mapCanvasWidth(w)
    const _h = mapCanvasHeight(h)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const strokeWidth = getStrokeWidth()
    ctx.lineWidth = strokeWidth
    ctx.save()

    if (rotation !== 0) {
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
    }

    const _points = this.transformPenPointsForContext(skCtx, true)

    let bx = _x, by = _y, bw = _w, bh = _h
    if (_points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of _points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
      bx = minX; by = minY; bw = maxX - minX; bh = maxY - minY
    }

    const d = strokeWidth * 2
    ctx.strokeStyle = '#79bbff'
    ctx.strokeRect(bx, by, bw, bh)
    ctx.strokeRect(bx - d, by - d, d * 2, d * 2)
    ctx.strokeRect(bx + bw - d, by - d, d * 2, d * 2)
    ctx.strokeRect(bx - d, by + bh - d, d * 2, d * 2)
    ctx.strokeRect(bx + bw - d, by + bh - d, d * 2, d * 2)

    const _map = listToMap(_points, 'uuid')

    const { index, pointType } = (() => {
      for (let i = 0; i < _points.length; i++) {
        if (_points[i].uuid === this.selectAnchor) return { index: i, pointType: _points[i].type }
      }
      return { index: -1, pointType: '' }
    })()

    ctx.strokeStyle = '#153063'

    if (!this.selectAnchor) {
      for (let i = 0; i < _points.length; i++) {
        if (_points[i].type === 'anchor') {
          ctx.beginPath()
          ctx.ellipse(_points[i].x, _points[i].y, d, d, 0, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.closePath()
        }
      }
    } else {
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
          if (originAnchor) {
            ctx.strokeRect(_points[i].x - d, _points[i].y - d, 2 * d, 2 * d)
            ctx.beginPath()
            ctx.moveTo(_points[i].x, _points[i].y)
            ctx.lineTo(originAnchor.x, originAnchor.y)
            ctx.stroke()
            ctx.closePath()
          }
        }
        if (index === _points.length - 1 && _points[i].type === 'control' && i === 1) {
          const originUUID = _points[i].origin as string
          const originAnchor: IPoint = _map[originUUID]
          if (originAnchor) {
            ctx.strokeRect(_points[i].x - d, _points[i].y - d, 2 * d, 2 * d)
            ctx.beginPath()
            ctx.moveTo(_points[i].x, _points[i].y)
            ctx.lineTo(originAnchor.x, originAnchor.y)
            ctx.stroke()
            ctx.closePath()
          }
        }
      }
    }

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

  /**
   * 渲染钢笔编辑器
   */
  render(canvas: HTMLCanvasElement): void {
    // 骨架自由编辑模式：使用上下文数据渲染
    const skCtx = this.resolveSkeletonContext()
    if (skCtx) {
      this.renderForSkeletonContext(canvas, skCtx)
      return
    }

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

    const _points = this.transformPenPoints(selectedComponent, true)

    // 编辑态包围框随当前点集 AABB（画布坐标），不再固定为组件 x,y,w,h
    let bx = _x
    let by = _y
    let bw = _w
    let bh = _h
    if (_points.length > 0) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of _points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
      bx = minX
      by = minY
      bw = maxX - minX
      bh = maxY - minY
    }

    const d = strokeWidth * 2 // 顶点控件内部宽高为 strokeWidth 的两倍
    ctx.strokeStyle = '#79bbff'
    ctx.strokeRect(bx, by, bw, bh)
    ctx.strokeRect(bx - d, by - d, d * 2, d * 2)
    ctx.strokeRect(bx + bw - d, by - d, d * 2, d * 2)
    ctx.strokeRect(bx - d, by + bh - d, d * 2, d * 2)
    ctx.strokeRect(bx + bw - d, by + bh - d, d * 2, d * 2)
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
