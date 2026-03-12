/**
 * 选择工具
 * 单例模式，负责组件选择和变换
 */

import { BaseTool } from '../base/BaseTool'
import type { IToolConfig, SelectControlType } from '../base/types'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { distance, rotatePoint, inComponentBound, leftTop, leftBottom, rightTop, rightBottom, angleBetween } from '@/core/utils/math'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight } from '@/utils/canvas'
import type { IComponent, IPenComponent, IGlyphComponent, ICustomGlyph, IPolygonComponent, IRectangleComponent, IEllipseComponent } from '@/core/types'
import { computeGlyphComponentBoundingBox } from '@/core/utils/glyphBounds'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { PenSelectTool } from './PenSelectTool'

/**
 * 选择工具单例
 */
export class SelectTool extends BaseTool {
  private static instance: SelectTool | null = null
  private selectControl: SelectControlType = 'null'
  private lastX: number = -1
  private lastY: number = -1
  private mousedown: boolean = false
  private mousemove: boolean = false
  private penSelectTool: PenSelectTool | null = null

  // 事件处理器引用（用于解绑）
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
  static getInstance(canvas?: HTMLCanvasElement, config?: IToolConfig): SelectTool {
    if (!SelectTool.instance) {
      if (!canvas || !config) {
        throw new Error('SelectTool: canvas and config are required for first initialization')
      }
      SelectTool.instance = new SelectTool(canvas, config)
    }
    return SelectTool.instance
  }

  /**
   * 重置单例（用于测试）
   */
  static reset(): void {
    if (SelectTool.instance) {
      SelectTool.instance.cleanup()
      SelectTool.instance = null
    }
  }

  get name(): string {
    return 'select'
  }

  /**
   * 获取当前选择控制状态（用于鼠标样式）
   */
  getSelectControl(): SelectControlType {
    return this.selectControl
  }

  async init(): Promise<void> {
    // 初始化钢笔编辑工具
    if (!this.penSelectTool) {
      this.penSelectTool = PenSelectTool.getInstance(this.canvas, this.config)
    }
  }

  activate(): void {
    this.isActive = true
    this.bindEvents()
    this.setRenderFunction(this.renderSelectEditor.bind(this))
    // 检查当前选中的组件是否是钢笔组件且处于编辑模式
    this.updatePenSelectToolState()
  }

  /**
   * 更新 penSelectTool 的激活状态
   * 根据当前选中的组件类型和编辑模式来决定是否激活 penSelectTool
   */
  private updatePenSelectToolState(): void {
    if (!this.penSelectTool) return

    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent

    // 检查是否是钢笔组件且处于编辑模式
    if (selectedComponent && selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      // 确保 editMode 属性存在（可能因为 modifyComponent 更新时被保留）
      if (penComponent && penComponent.editMode === true) {
        // 激活 penSelectTool
        if (!this.penSelectTool.isToolActive()) {
          // 重置初始边界框，确保每次进入编辑模式时重新计算
          this.penSelectTool.resetInitialBounds()
          this.penSelectTool.activate()
        }
        return
      }
    }

    // 不是钢笔组件或不在编辑模式，停用 penSelectTool
    // 但是，如果 penSelectTool 正在拖拽中，不要停用
    if (this.penSelectTool.isToolActive()) {
      // 检查是否正在拖拽
      if (!this.penSelectTool.isDragging()) {
        this.penSelectTool.deactivate()
        // 重置初始边界框，为下次进入编辑模式做准备
        this.penSelectTool.resetInitialBounds()
      }
    }
  }

  deactivate(): void {
    this.isActive = false
    this.unbindEvents()
    this.selectControl = 'null'
    this.mousedown = false
    this.mousemove = false
    this.lastX = -1
    this.lastY = -1
  }

  cleanup(): void {
    this.deactivate()
    if (this.penSelectTool) {
      this.penSelectTool.cleanup()
      this.penSelectTool = null
    }
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
   * 检查点是否在字形组件内部
   * 使用与 glyphDragger 相同的逻辑：基于实际轮廓点计算包围框
   */
  private glyphComponentContainsPoint(
    point: { x: number; y: number },
    component: IComponent,
    tolerance: number = 15
  ): boolean {
    if (!component || !component.visible || component.type !== 'glyph') {
      return false
    }

    // 计算字形组件的全局原点（与 glyphDragger 的 getOrigin 一致）
    const origin = {
      ox: (component as any).ox || 0,
      oy: (component as any).oy || 0,
    }

    const bbox = computeGlyphComponentBoundingBox(component, origin)
    if (!bbox) return false

    const { x, y, w, h } = bbox
    const px = point.x
    const py = point.y

    // 在包围框基础上增加容差
    if (
      px >= x - tolerance &&
      px <= x + w + tolerance &&
      py >= y - tolerance &&
      py <= y + h + tolerance
    ) {
      return true
    }

    return false
  }

  /**
   * 检查点是否在字形子组件内部
   */
  private glyphItemContainsPoint(
    point: { x: number; y: number },
    component: IGlyphComponent,
    offset: { x: number; y: number },
    tolerance: number
  ): boolean {
    if (!component) return false

    if (component.type === 'glyph') {
      // 递归处理嵌套的字形组件
      const childOffset = {
        x: offset.x + (component.ox || 0),
        y: offset.y + (component.oy || 0),
      }
      return this.glyphComponentContainsPoint(point, component as unknown as IComponent, tolerance)
    }

    // 先检查边界框
    const componentX = component.x + offset.x
    const componentY = component.y + offset.y
    const componentW = component.w
    const componentH = component.h

    if (!inComponentBound(point, {
      x: componentX,
      y: componentY,
      w: componentW,
      h: componentH,
      rotation: component.rotation || 0,
    }, tolerance)) {
      return false
    }

    // 根据组件类型进行精确检测
    const value = component.value
    if (!value) return false

    // 将点转换到组件坐标系（考虑旋转）
    const { x: _x, y: _y } = rotatePoint(
      point,
      { x: componentX + componentW / 2, y: componentY + componentH / 2 },
      -(component.rotation || 0)
    )

    const relativeX = _x - componentX
    const relativeY = _y - componentY

    switch (component.type) {
      case 'pen': {
        // 对于钢笔组件，检查点是否在路径附近
        const penValue = value as unknown as IPenComponent
        const points = penValue.points || []
        if (points.length === 0) return false

        // 简化实现：检查点是否在边界框内（可以后续优化为精确的路径检测）
        return true
      }
      case 'polygon': {
        // 对于多边形组件，检查点是否在多边形内部
        const polygonValue = value as unknown as IPolygonComponent
        const points = polygonValue.points || []
        if (points.length < 3) return false

        // 使用点在多边形内的算法
        return this.pointInPolygon({ x: relativeX, y: relativeY }, points)
      }
      case 'rectangle': {
        // 对于矩形组件，检查点是否在矩形内部
        const rectValue = value as unknown as IRectangleComponent
        const width = rectValue.width || componentW
        const height = rectValue.height || componentH
        return (
          relativeX >= -tolerance &&
          relativeX <= width + tolerance &&
          relativeY >= -tolerance &&
          relativeY <= height + tolerance
        )
      }
      case 'ellipse': {
        // 对于椭圆组件，检查点是否在椭圆内部
        const ellipseValue = value as unknown as IEllipseComponent
        const radiusX = ellipseValue.radiusX || componentW / 2
        const radiusY = ellipseValue.radiusY || componentH / 2
        const centerX = componentW / 2
        const centerY = componentH / 2

        const dx = relativeX - centerX
        const dy = relativeY - centerY
        const rx = radiusX + tolerance
        const ry = radiusY + tolerance

        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
      }
      default:
        // 对于其他类型，只检查边界框
        return true
    }
  }

  /**
   * 点在多边形内的检测算法（射线法）
   */
  private pointInPolygon(
    point: { x: number; y: number },
    vertices: Array<{ x: number; y: number }>
  ): boolean {
    if (!vertices.length) return false
    let inside = false
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x
      const yi = vertices[i].y
      const xj = vertices[j].x
      const yj = vertices[j].y
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    
    // 先检查点击位置，判断点击的是哪个组件
    const clickPoint = {
      x: this.getCoord(e.offsetX),
      y: this.getCoord(e.offsetY),
    }
    
    // 查找点击的组件
    const orderedList = isGlyph 
      ? (glyphStore as any).orderedListWithItemsForCurrentGlyph 
      : (characterStore as any).orderedListWithItemsForCurrentCharacterFile
    
    // 收集所有边界框包含点击点的组件
    const candidateComponents: Array<{ component: IComponent; distance: number }> = []
    
    for (let i = orderedList.length - 1; i >= 0; i--) {
      const component = orderedList[i]
      if (!component || !component.type || component.type === 'group' || !component.visible) continue
      
      // 先检查边界框
      let isInBounds = false
      if (component.type === 'glyph') {
        isInBounds =
          this.glyphComponentContainsPoint(clickPoint, component, 20) ||
          inComponentBound(clickPoint, component, 20)
      } else {
        isInBounds = inComponentBound(clickPoint, component, 20)
      }
      
      if (isInBounds) {
        const centerX = component.x + component.w / 2
        const centerY = component.y + component.h / 2
        const dist = Math.sqrt(
          Math.pow(clickPoint.x - centerX, 2) + Math.pow(clickPoint.y - centerY, 2)
        )
        candidateComponents.push({ component, distance: dist })
      }
    }
    
    // 如果有候选组件，找到最近的
    let clickedComponent: IComponent | null = null
    if (candidateComponents.length > 0) {
      candidateComponents.sort((a, b) => a.distance - b.distance)
      clickedComponent = candidateComponents[0].component
    }
    
    // 如果点击的是钢笔组件且处于编辑模式，且点击在当前选中的钢笔组件上
    // 让 penSelectTool 处理点编辑，SelectTool 不处理选择切换
    if (clickedComponent && clickedComponent.type === 'pen' && selectedComponent && selectedComponent.uuid === clickedComponent.uuid) {
      const penComponent = clickedComponent.value as unknown as IPenComponent
      if (penComponent.editMode && this.penSelectTool && this.penSelectTool.isToolActive()) {
        // 点击在当前选中的钢笔组件上，让 penSelectTool 处理点编辑
        // SelectTool 不处理选择切换（因为点击的就是当前选中的组件）
        return
      }
    }
    
    // 如果点击的是其他组件（不是当前选中的钢笔组件），正常处理选择切换
    // 但需要先检查是否点击在当前选中组件的控制点上

    this.mousedown = true
    this.mousemove = false

    if (!selectedComponent || !selectedComponent.visible) {
      // 没有选中组件，标记为需要处理点击选择，但不立即处理
      // 等到 onMouseUp 时再处理，避免重复调用
      this.mousedown = false
      this.selectControl = 'null'
      return
    }

    // 检查是否点击在组件或控制点上
    const { x, y, w, h, rotation } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(e.offsetX), y: this.getCoord(e.offsetY) },
      { x: x + w / 2, y: y + h / 2 },
      -rotation
    )

    const d = 10
    const left_top = { x, y }
    const left_bottom = { x, y: y + h }
    const right_top = { x: x + w, y }
    const right_bottom = { x: x + w, y: y + h }

    // 检查是否点击在控制点上
    const clickedOnScaleControl = 
      distance(_x, _y, left_top.x, left_top.y) <= d ||
      distance(_x, _y, right_top.x, right_top.y) <= d ||
      distance(_x, _y, left_bottom.x, left_bottom.y) <= d ||
      distance(_x, _y, right_bottom.x, right_bottom.y) <= d

    const clickedOnRotateControl =
      leftTop(_x, _y, left_top.x, left_top.y, d) ||
      rightTop(_x, _y, right_top.x, right_top.y, d) ||
      leftBottom(_x, _y, left_bottom.x, left_bottom.y, d) ||
      rightBottom(_x, _y, right_bottom.x, right_bottom.y, d)

    const clickedOnInnerArea = inComponentBound({ x: _x, y: _y }, selectedComponent)

    // 如果点击的是钢笔组件且处于编辑模式，且点击在当前选中的钢笔组件内部（非控制点），让 penSelectTool 处理
    if (selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      if (penComponent.editMode && clickedOnInnerArea && !clickedOnScaleControl && !clickedOnRotateControl) {
        // 点击在当前选中的钢笔组件内部（非控制点），让 penSelectTool 处理，不处理选择切换
        this.mousedown = false
        this.selectControl = 'null'
        return
      }
    }

    if (!clickedOnScaleControl && !clickedOnRotateControl && !clickedOnInnerArea) {
      // 点击空白处，标记为需要处理点击选择，但不立即处理
      // 等到 onMouseUp 时再处理，避免重复调用
      this.mousedown = false
      this.selectControl = 'null'
      return
    }

    this.lastX = _x
    this.lastY = _y

    // 根据点击位置设置 selectControl
    if (clickedOnScaleControl) {
      if (distance(_x, _y, left_top.x, left_top.y) <= d) {
        this.selectControl = 'scale-left-top'
      } else if (distance(_x, _y, right_top.x, right_top.y) <= d) {
        this.selectControl = 'scale-right-top'
      } else if (distance(_x, _y, left_bottom.x, left_bottom.y) <= d) {
        this.selectControl = 'scale-left-bottom'
      } else if (distance(_x, _y, right_bottom.x, right_bottom.y) <= d) {
        this.selectControl = 'scale-right-bottom'
      }
    } else if (clickedOnRotateControl) {
      if (leftTop(_x, _y, left_top.x, left_top.y, d)) {
        this.selectControl = 'rotate-left-top'
      } else if (rightTop(_x, _y, right_top.x, right_top.y, d)) {
        this.selectControl = 'rotate-right-top'
      } else if (leftBottom(_x, _y, left_bottom.x, left_bottom.y, d)) {
        this.selectControl = 'rotate-left-bottom'
      } else if (rightBottom(_x, _y, right_bottom.x, right_bottom.y, d)) {
        this.selectControl = 'rotate-right-bottom'
      }
    } else if (clickedOnInnerArea) {
      this.selectControl = 'inner-area'
    }
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    
    // 检查是否是钢笔组件且处于编辑模式
    // 如果是，penSelectTool 会处理事件，SelectTool 直接返回，不处理
    if (selectedComponent && selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      if (penComponent.editMode && this.penSelectTool && this.penSelectTool.isToolActive()) {
        // penSelectTool 已激活，让它处理事件，SelectTool 不处理
        return
      }
    }
    
    if (!selectedComponent || !selectedComponent.visible) return

    const { x, y, w, h, rotation, uuid } = selectedComponent
    const { x: _x, y: _y } = rotatePoint(
      { x: this.getCoord(e.offsetX), y: this.getCoord(e.offsetY) },
      { x: x + w / 2, y: y + h / 2 },
      -rotation
    )

    const modifyComponent = isGlyph ? (glyphStore as any).modifyComponent : (characterStore as any).modifyComponent

    if (this.mousedown && this.selectControl !== 'null') {
      switch (this.selectControl) {
        case 'scale-left-top':
          modifyComponent(uuid, {
            w: w + x - _x,
            h: h + y - _y,
            x: _x,
            y: _y,
          } as Partial<IComponent>)
          break
        case 'scale-right-top':
          modifyComponent(uuid, {
            w: _x - x,
            h: h + y - _y,
            y: _y,
          } as Partial<IComponent>)
          break
        case 'scale-left-bottom':
          modifyComponent(uuid, {
            w: w + x - _x,
            x: _x,
            h: _y - y,
          } as Partial<IComponent>)
          break
        case 'scale-right-bottom':
          modifyComponent(uuid, {
            w: _x - x,
            h: _y - y,
          } as Partial<IComponent>)
          break
        case 'inner-area':
          // 字形组件的移动由 glyphDragger 处理，SelectTool 不处理
          if (selectedComponent.type === 'glyph') {
            // 字形组件不在这里处理移动，由 glyphDragger 处理
            break
          }
          modifyComponent(uuid, {
            x: x + _x - this.lastX,
            y: y + _y - this.lastY,
          } as Partial<IComponent>)
          break
        case 'rotate-left-top': {
          const left_top = { x, y }
          modifyComponent(uuid, {
            rotation: rotation + angleBetween(
              { x: _x - (x + w / 2), y: _y - (y + h / 2) },
              { x: left_top.x - (x + w / 2), y: left_top.y - (y + h / 2) }
            )
          } as Partial<IComponent>)
          break
        }
        case 'rotate-right-top': {
          const right_top = { x: x + w, y }
          modifyComponent(uuid, {
            rotation: rotation + angleBetween(
              { x: _x - (x + w / 2), y: _y - (y + h / 2) },
              { x: right_top.x - (x + w / 2), y: right_top.y - (y + h / 2) }
            )
          } as Partial<IComponent>)
          break
        }
        case 'rotate-left-bottom': {
          const left_bottom = { x, y: y + h }
          modifyComponent(uuid, {
            rotation: rotation + angleBetween(
              { x: _x - (x + w / 2), y: _y - (y + h / 2) },
              { x: left_bottom.x - (x + w / 2), y: left_bottom.y - (y + h / 2) }
            )
          } as Partial<IComponent>)
          break
        }
        case 'rotate-right-bottom': {
          const right_bottom = { x: x + w, y: y + h }
          modifyComponent(uuid, {
            rotation: rotation + angleBetween(
              { x: _x - (x + w / 2), y: _y - (y + h / 2) },
              { x: right_bottom.x - (x + w / 2), y: right_bottom.y - (y + h / 2) }
            )
          } as Partial<IComponent>)
          break
        }
      }
      this.triggerRender()
    }

    if (!this.mousedown) {
      // 更新hover状态
      const left_top = { x, y }
      const left_bottom = { x, y: y + h }
      const right_top = { x: x + w, y }
      const right_bottom = { x: x + w, y: y + h }
      const d = 10

      if (distance(_x, _y, left_top.x, left_top.y) <= d) {
        this.selectControl = 'scale-left-top'
      } else if (distance(_x, _y, right_top.x, right_top.y) <= d) {
        this.selectControl = 'scale-right-top'
      } else if (distance(_x, _y, left_bottom.x, left_bottom.y) <= d) {
        this.selectControl = 'scale-left-bottom'
      } else if (distance(_x, _y, right_bottom.x, right_bottom.y) <= d) {
        this.selectControl = 'scale-right-bottom'
      } else if (leftTop(_x, _y, left_top.x, left_top.y, d)) {
        this.selectControl = 'rotate-left-top'
      } else if (rightTop(_x, _y, right_top.x, right_top.y, d)) {
        this.selectControl = 'rotate-right-top'
      } else if (leftBottom(_x, _y, left_bottom.x, left_bottom.y, d)) {
        this.selectControl = 'rotate-left-bottom'
      } else if (rightBottom(_x, _y, right_bottom.x, right_bottom.y, d)) {
        this.selectControl = 'rotate-right-bottom'
      } else if (inComponentBound({ x: _x, y: _y }, selectedComponent)) {
        this.selectControl = 'inner-area'
      } else {
        this.selectControl = 'null'
      }
    }

    this.lastX = _x
    this.lastY = _y
  }

  /**
   * 处理点击选择逻辑
   */
  private handleClickSelection(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'

    // 如果点击的不是canvas，忽略这个事件
    const target = e.target as HTMLElement
    if (target !== this.canvas && !this.canvas.contains(target)) {
      return
    }

    let offsetX = e.offsetX
    let offsetY = e.offsetY
    if (target !== this.canvas) {
      const rect = this.canvas.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
    }

    const clickPoint = {
      x: this.getCoord(offsetX),
      y: this.getCoord(offsetY),
    }

    // 查找点击的组件
    const orderedList = isGlyph 
      ? (glyphStore as any).orderedListWithItemsForCurrentGlyph 
      : (characterStore as any).orderedListWithItemsForCurrentCharacterFile

    // 收集所有边界框包含点击点的组件
    const candidateComponents: Array<{ component: IComponent; distance: number }> = []

    for (let i = orderedList.length - 1; i >= 0; i--) {
      const component = orderedList[i]
      if (!component || !component.type || component.type === 'group' || !component.visible) continue

      // 先检查边界框
      let isInBounds = false
      if (component.type === 'glyph') {
        // 对于字形组件，优先使用精确检测；如果失败则退回到边界框检测
        isInBounds =
          this.glyphComponentContainsPoint(clickPoint, component, 20) ||
          inComponentBound(clickPoint, component, 20)
      } else {
        // 对于其他组件，边界框检测已足够
        isInBounds = inComponentBound(clickPoint, component, 20)
      }

      if (isInBounds) {
        // 简化距离计算：使用边界框中心到点击点的距离
        const centerX = component.x + component.w / 2
        const centerY = component.y + component.h / 2
        const dist = Math.sqrt(
          Math.pow(clickPoint.x - centerX, 2) + Math.pow(clickPoint.y - centerY, 2)
        )
        candidateComponents.push({ component, distance: dist })
      }
    }

    // 如果点击的是已选中的组件，需要特殊处理
    // 对于字形组件：优先保持选中（不切换），让 glyphDragger 响应关键点拖拽
    // 对于钢笔组件且处于编辑模式：让 penSelectTool 处理点编辑，不切换选择
    // 对于其他组件：正常处理选择切换（虽然点击的是已选中的组件，但可能需要处理其他逻辑）
    const currentSelectedUUID = isGlyph
      ? (glyphStore as any).selectedComponentUUID
      : (characterStore as any).selectedComponentUUID
    if (currentSelectedUUID) {
      const currentSelected = candidateComponents.find(c => c.component.uuid === currentSelectedUUID)
      if (currentSelected) {
        // 如果是字形组件，优先保持选中（不切换），让 glyphDragger 响应关键点拖拽
        if (currentSelected.component.type === 'glyph') {
          return
        }
        // 如果是钢笔组件且处于编辑模式，让 penSelectTool 处理点编辑，不切换选择
        if (currentSelected.component.type === 'pen') {
          const penComponent = currentSelected.component.value as unknown as IPenComponent
          if (penComponent.editMode && this.penSelectTool && this.penSelectTool.isToolActive()) {
            // 点击在当前选中的钢笔组件上，让 penSelectTool 处理，不切换选择
            return
          }
        }
        // 对于其他组件，即使点击的是已选中的组件，也允许处理（比如可能需要重新触发某些逻辑）
        // 但这里不返回，继续处理选择切换
      }
    }

    // 如果有候选组件，选择距离最近的
    if (candidateComponents.length > 0) {
      // 按距离排序，选择最近的
      candidateComponents.sort((a, b) => a.distance - b.distance)
      const closestComponent = candidateComponents[0].component

      if (isGlyph) {
        (glyphStore as any).selectComponent(closestComponent.uuid)
      } else {
        (characterStore as any).selectComponent(closestComponent.uuid)
      }
      // 选择变更后触发重新渲染（包括控件框和 dragger）
      this.triggerRender()
      return
    }

    // 没有找到任何组件，清除选择
    if (isGlyph) {
      (glyphStore as any).clearSelection()
    } else {
      (characterStore as any).clearSelection()
    }
    // 清除选择后也需要重新渲染，移除控件框
    this.triggerRender()
  }

  /**
   * 鼠标抬起事件
   */
  private onMouseUp(e: MouseEvent): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent

    // 检查是否是钢笔组件且处于编辑模式，且 penSelectTool 正在拖拽
    // 如果是，penSelectTool 会处理事件，SelectTool 直接返回，不处理
    if (selectedComponent && selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      if (penComponent.editMode && this.penSelectTool && this.penSelectTool.isToolActive()) {
        // 如果 penSelectTool 正在拖拽，让它处理事件，SelectTool 不处理
        if (this.penSelectTool.isDragging()) {
          return
        }
        // 如果 penSelectTool 没有在拖拽，但点击的是当前选中的钢笔组件，也不处理选择切换
        // 这个逻辑已经在 onMouseDown 和 handleClickSelection 中处理了，这里不需要再次检查
      }
    }

    // 如果点击的不是canvas，忽略这个事件
    const target = e.target as HTMLElement
    if (target !== this.canvas && !this.canvas.contains(target)) {
      if (this.mousedown) {
        this.mousedown = false
        this.mousemove = false
        this.selectControl = 'null'
      }
      return
    }

    // 如果用户没有移动鼠标，说明是点击操作，需要处理点击选择
    if (!this.mousemove) {
      this.handleClickSelection(e)
    }

    if (selectedComponent && selectedComponent.visible && selectedComponent.type !== 'picture') {
      this.modifyComponentValue(selectedComponent, isGlyph)
    }

    this.mousedown = false
    this.mousemove = false
    this.selectControl = 'null'
  }

  /**
   * 键盘按下事件
   */
  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space' || e.code === 'Enter') {
      const characterStore = useCharacterStore()
      const glyphStore = useGlyphStore()
      const isGlyph = this.config.mode === 'glyph'
      
      const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
      if (!selectedComponent || !selectedComponent.visible) return

      if (selectedComponent.type !== 'picture') {
        this.modifyComponentValue(selectedComponent, isGlyph)
      }

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
    // TODO: 实现组件值的更新逻辑
    // 参考原工程 select.ts 的 modifyComponentValue 函数
    // 需要根据组件类型生成contour和preview
  }

  /**
   * 渲染选择编辑器
   */
  private renderSelectEditor(canvas: HTMLCanvasElement): void {
    const characterStore = useCharacterStore()
    const glyphStore = useGlyphStore()
    const isGlyph = this.config.mode === 'glyph'
    
    const selectedComponent = isGlyph ? (glyphStore as any).selectedComponent : (characterStore as any).selectedComponent
    if (!selectedComponent || !selectedComponent.visible) {
      // 没有选中组件时，停用 penSelectTool
      if (this.penSelectTool && this.penSelectTool.isToolActive()) {
        this.penSelectTool.deactivate()
      }
      return
    }

    // 检查是否是钢笔组件且处于编辑模式
    if (selectedComponent.type === 'pen') {
      const penComponent = selectedComponent.value as unknown as IPenComponent
      if (penComponent.editMode && this.penSelectTool) {
        // 确保 penSelectTool 已激活
        if (!this.penSelectTool.isToolActive()) {
          this.penSelectTool.activate()
        }
        // 使用钢笔编辑工具渲染
        this.penSelectTool.render(canvas)
        return
      } else {
        // 钢笔组件但不在编辑模式，停用 penSelectTool（除非正在拖拽）
        if (this.penSelectTool && this.penSelectTool.isToolActive()) {
          if (!this.penSelectTool.isDragging()) {
            this.penSelectTool.deactivate()
          }
        }
      }
    } else {
      // 不是钢笔组件，停用 penSelectTool（除非正在拖拽）
      if (this.penSelectTool && this.penSelectTool.isToolActive()) {
        if (!this.penSelectTool.isDragging()) {
          this.penSelectTool.deactivate()
        }
      }
    }

    // 渲染普通选择框（样式与各组件工具的预览选择框保持一致）
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let { x, y, w, h, rotation } = selectedComponent

    // 字形组件不一定有准确的 x,y,w,h，这里使用实际轮廓计算出来的包围框
    if (selectedComponent.type === 'glyph') {
      const origin = {
        ox: (selectedComponent as any).ox || 0,
        oy: (selectedComponent as any).oy || 0,
      }
      const bbox = computeGlyphComponentBoundingBox(selectedComponent, origin)
      if (bbox) {
        x = bbox.x
        y = bbox.y
        w = bbox.w
        h = bbox.h
      }
    }

    const _x = mapCanvasX(x)
    const _y = mapCanvasY(y)
    const _w = mapCanvasWidth(w)
    const _h = mapCanvasHeight(h)

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

    // 高亮边框和四个角的控制点（与 RectangleTool 样式一致）
    // 顶点控件内部宽高为 strokeWidth 的两倍
    const d = strokeWidth * 2
    ctx.strokeStyle = '#79bbff'
    ctx.strokeRect(_x, _y, _w, _h)
    ctx.strokeRect(_x - d, _y - d, d * 2, d * 2)
    ctx.strokeRect(_x + _w - d, _y - d, d * 2, d * 2)
    ctx.strokeRect(_x - d, _y + _h - d, d * 2, d * 2)
    ctx.strokeRect(_x + _w - d, _y + _h - d, d * 2, d * 2)

    ctx.restore()
  }
}
