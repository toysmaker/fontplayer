/**
 * 基础拖拽器抽象类
 * 提供统一的拖拽逻辑，子类实现特定场景的处理
 */

import { throttle } from '@/utils/performance'
import { JointManager } from './JointManager'
import { ScriptExecutor } from './ScriptExecutor'
import type { IDragContext, IDraggerConfig, IJoint } from './types'
import type { ICustomGlyph } from '@/core/types'

export abstract class BaseGlyphDragger {
  protected canvas: HTMLCanvasElement
  protected context: IDragContext
  protected config: IDraggerConfig
  
  private draggingJoint: IJoint | null = null
  private hoverJoint: IJoint | null = null
  private isDraggingFirstJoint = false
  private _isDragging = false
  private lastX = 0
  private lastY = 0
  private origin: { ox: number; oy: number } = { ox: 0, oy: 0 }
  private _isActive: boolean = false
  
  // 节流函数（单例，避免重复创建）
  private throttledSkeletonDrag = throttle(
    (glyph: ICustomGlyph, componentUUID: string, joint: IJoint, dx: number, dy: number) => {
      if (import.meta.env.DEV) {
        console.log('[BaseGlyphDragger.throttledSkeletonDrag] Executing:', {
          componentUUID,
          jointName: joint.name,
          dx,
          dy,
          hasOnRender: !!this.config.onRender
        })
      }
      ScriptExecutor.executeDrag(glyph, componentUUID, {
        draggingJoint: joint,
        deltaX: dx,
        deltaY: dy
      })
      if (import.meta.env.DEV) {
        console.log('[BaseGlyphDragger.throttledSkeletonDrag] Calling onRender')
      }
      this.config.onRender?.()
    },
    16, // 16ms ≈ 60fps
    { leading: true, trailing: true }
  )
  
  private throttledGlyphDrag = throttle(
    (dx: number, dy: number) => {
      this.handleGlyphDrag(dx, dy)
      this.config.onRender?.()
    },
    16,
    { leading: true, trailing: true }
  )
  
  constructor(config: IDraggerConfig) {
    this.canvas = config.canvas
    this.context = config.context
    this.config = config
  }
  
  // 抽象方法：由子类实现
  protected abstract getJoints(): IJoint[]
  protected abstract getOrigin(): { ox: number; oy: number }
  protected abstract handleGlyphDrag(dx: number, dy: number): void
  protected abstract handleDragEnd(): void
  
  // 工具方法
  protected getCoord(coord: number): number {
    return this.config.getCoord ? this.config.getCoord(coord) : coord
  }
  
  /**
   * 将显示坐标转换为坐标尺寸
   * 显示尺寸（CSS 样式尺寸，如 500px） -> 坐标尺寸（unitsPerEm，如 1000）
   */
  protected convertDisplayToCoord(displayCoord: number, isX: boolean = true): number {
    // 优先使用配置中的值，否则从 canvas 样式获取，最后使用默认值 500
    let displaySize: number
    if (isX) {
      displaySize = this.config.displayWidth ?? 
        (this.canvas.style.width ? parseFloat(this.canvas.style.width) : 500)
    } else {
      displaySize = this.config.displayHeight ?? 
        (this.canvas.style.height ? parseFloat(this.canvas.style.height) : 500)
    }
    
    const unitsPerEm = this.config.unitsPerEm ?? 1000
    
    // 转换公式：coord = (displayCoord / displaySize) * unitsPerEm
    return (displayCoord / displaySize) * unitsPerEm
  }
  
  protected canDrag(): boolean {
    return this.config.draggable ? this.config.draggable() : true
  }
  
  protected shouldCheckJoints(): boolean {
    return this.config.checkJoints ? this.config.checkJoints() : true
  }
  
  // 统一的事件处理
  protected onMouseDown = (e: MouseEvent) => {
    if (!this.canDrag()) return
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    
    const joints = this.getJoints()
    let hitJoint: IJoint | null = null
    
    if (this.shouldCheckJoints()) {
      // 将鼠标坐标从显示尺寸转换为坐标尺寸
      // mouseX, mouseY 是相对于显示尺寸（如 500px）的，需要转换为坐标尺寸（unitsPerEm = 1000）
      const coordX = this.convertDisplayToCoord(mouseX, true)
      const coordY = this.convertDisplayToCoord(mouseY, false)
      
      // joints 已经是全局坐标（getJoints() 已经加上了正确的 ox, oy）
      // 使用转换后的坐标尺寸进行比较
      hitJoint = JointManager.findHitJoint(joints, coordX, coordY, 20)
    }

    if (hitJoint) {
      this.draggingJoint = hitJoint
      this.isDraggingFirstJoint = JointManager.isFirstJoint(hitJoint, joints)
      
      if (import.meta.env.DEV) {
        console.log('[BaseGlyphDragger.onMouseDown] Hit joint:', {
          jointName: hitJoint.name,
          isFirstJoint: this.isDraggingFirstJoint,
          hasGlyph: !!this.context.glyph,
          componentUUID: this.context.componentUUID
        })
      }
      
      // 调用脚本回调（非第一个关键点）
      if (!this.isDraggingFirstJoint && this.context.glyph) {
        ScriptExecutor.executeDragStart(
          this.context.glyph,
          this.context.componentUUID,
          hitJoint
        )
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('[BaseGlyphDragger.onMouseDown] No joint hit, will drag component')
      }
    }
    
    this._isDragging = true
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    this.lastX = this.convertDisplayToCoord(mouseX, true)
    this.lastY = this.convertDisplayToCoord(mouseY, false)
    this.origin = this.getOrigin()
    
    window.addEventListener('mouseup', this.onMouseUp)
  }
  
  protected onMouseMove = (e: MouseEvent) => {
    if (!this._isDragging) {
      // 更新悬停关键点
      this.updateHoverJoint(e)
      return
    }
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    const dx = coordX - this.lastX
    const dy = coordY - this.lastY
    
    // 只处理骨架关键点拖拽，组件移动由 select 工具处理
    if (this.draggingJoint && !this.isDraggingFirstJoint && this.context.glyph) {
      // 拖拽骨架（如果脚本支持）
      // 执行骨架拖拽脚本，并在节流函数中触发重新渲染
      if (import.meta.env.DEV) {
        console.log('[BaseGlyphDragger.onMouseMove] Dragging skeleton joint:', {
          jointName: this.draggingJoint.name,
          dx,
          dy,
          componentUUID: this.context.componentUUID
        })
      }
      this.throttledSkeletonDrag(
        this.context.glyph,
        this.context.componentUUID,
        this.draggingJoint!,
        dx,
        dy
      )
    }
    // 如果没有选中关键点，不做任何改变（组件移动由 select 工具处理）
  }
  
  protected onMouseUp = (e: MouseEvent) => {
    if (!this._isDragging) return
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    const dx = coordX - this.lastX
    const dy = coordY - this.lastY
    
    // 调用脚本回调（非第一个关键点）
    if (
      this.context.glyph &&
      this.draggingJoint &&
      !this.isDraggingFirstJoint
    ) {
      ScriptExecutor.executeDragEnd(
        this.context.glyph,
        this.context.componentUUID,
        {
          draggingJoint: this.draggingJoint,
          deltaX: dx,
          deltaY: dy
        }
      )
    }
    
    this.handleDragEnd()
    this.cleanup()
  }
  
  private updateHoverJoint(e: MouseEvent) {
    if (!this.shouldCheckJoints()) {
      this.hoverJoint = null
      return
    }
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    const joints = this.getJoints()
    
    // 将鼠标坐标从显示尺寸转换为坐标尺寸
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    
    // joints 已经是全局坐标（getJoints() 已经加上了正确的 ox, oy）
    // 使用转换后的坐标尺寸进行比较
    this.hoverJoint = JointManager.findHoverJoint(joints, coordX, coordY, 10)
  }
  
  private handleDefaultDrag(dx: number, dy: number): void {
    // 默认行为：移动组件位置
    this.handleGlyphDrag(dx, dy)
  }
  
  private cleanup() {
    this._isDragging = false
    this.draggingJoint = null
    this.isDraggingFirstJoint = false
    this.hoverJoint = null
    this.lastX = 0
    this.lastY = 0
    window.removeEventListener('mouseup', this.onMouseUp)
  }
  
  // 公共方法
  getDraggingJoint(): IJoint | null {
    return this.draggingJoint
  }
  
  getHoverJoint(): IJoint | null {
    return this.hoverJoint
  }
  
  isDragging(): boolean {
    return this._isDragging
  }
  
  getMode(): 'character' | 'glyph' {
    return this.context.mode
  }
  
  isActive(): boolean {
    return this._isActive || false
  }
  
  updateContext(context: IDragContext): void {
    if (this.context.mode !== context.mode) {
      throw new Error('Cannot update context with different mode. Use createGlyphDragger instead.')
    }
    
    this.context = context
    this.cleanup()
  }
  
  updateConfig(config: Partial<IDraggerConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  private cancelThrottledFunctions(): void {
    if (typeof (this.throttledSkeletonDrag as any).cancel === 'function') {
      (this.throttledSkeletonDrag as any).cancel()
    }
    if (typeof (this.throttledGlyphDrag as any).cancel === 'function') {
      (this.throttledGlyphDrag as any).cancel()
    }
  }
  
  destroy(): void {
    this.deactivate()
    this.context = null as any
    this.config = null as any
    this.canvas = null as any
    this.cancelThrottledFunctions()
  }
  
  activate() {
    this._isActive = true
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
  }
  
  deactivate() {
    this._isActive = false
    
    // 1. 移除所有事件监听器
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    
    // 2. 清理状态
    this.cleanup()
    
    // 3. 取消节流函数的pending调用
    this.cancelThrottledFunctions()
  }
}
