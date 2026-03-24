/**
 * 基础拖拽器抽象类
 * 提供统一的拖拽逻辑，子类实现特定场景的处理
 */

import { throttle } from '@/utils/performance'
import { JointManager } from './JointManager'
import { ScriptExecutor } from './ScriptExecutor'
import type { IDragContext, IDraggerConfig, IJoint } from './types'
import type { ICustomGlyph, IComponent, IGlyphComponent } from '@/core/types'
import { computeGlyphComponentBoundingBox } from '@/core/utils/glyphBounds'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import {
  collectStraightAxisLinesFromPenComponents,
  getSnapRefline,
  mergeSnapAxisLines,
  type SnapAxisLine,
} from './reflineSnap'

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
  private initialOx = 0  // 记录拖拽开始时的初始 ox
  private initialOy = 0  // 记录拖拽开始时的初始 oy
  private _isActive: boolean = false
  
  // 节流函数（单例，避免重复创建）
  private throttledSkeletonDrag = throttle(
    (glyph: ICustomGlyph, componentUUID: string, joint: IJoint, dx: number, dy: number) => {
      console.log('[BaseGlyphDragger.throttledSkeletonDrag] START:', {
          componentUUID,
          jointName: joint.name,
          dx,
          dy,
        hasOnRender: !!this.config.onRender,
        hasGlyph: !!glyph
        })
      
      console.log('[BaseGlyphDragger.throttledSkeletonDrag] Calling ScriptExecutor.executeDrag')
      ScriptExecutor.executeDrag(glyph, componentUUID, {
        draggingJoint: joint,
        deltaX: dx,
        deltaY: dy
      })
      console.log('[BaseGlyphDragger.throttledSkeletonDrag] ScriptExecutor.executeDrag completed')
      
      // 骨架拖拽后，需要同步参数到组件 value，确保修改被保存
      if (this.context.component && this.context.component.type === 'glyph') {
        console.log('[BaseGlyphDragger.throttledSkeletonDrag] Syncing parameters to component.value')
        
        // 获取字形实例，确保参数已更新
        // ScriptExecutor.executeDrag 已经获取了实例，这里直接获取已存在的实例
        // 使用和 ScriptExecutor 相同的方式获取实例
        let glyphInstance: CustomGlyph | null = null
        const isTemporary = instanceManager.isTemporary(componentUUID)
        console.log('[BaseGlyphDragger.throttledSkeletonDrag] Instance check:', {
          componentUUID,
          isTemporary
        })
        
        if (isTemporary) {
          glyphInstance = instanceManager.acquireTemporaryInstance(
            componentUUID,
            () => new CustomGlyph(glyph),
            'glyph'
          ) as CustomGlyph
        } else {
          // 如果实例不存在，说明有问题，但为了兼容性，仍然尝试获取
          console.warn('[BaseGlyphDragger.throttledSkeletonDrag] Instance not temporary, creating new one')
          glyphInstance = instanceManager.acquireTemporaryInstance(
            componentUUID,
            () => new CustomGlyph(glyph),
            'glyph'
          ) as CustomGlyph
        }
        
        console.log('[BaseGlyphDragger.throttledSkeletonDrag] Got instance:', {
          hasInstance: !!glyphInstance,
          hasParameters: !!glyphInstance?._glyph?.parameters,
          parametersLength: glyphInstance?._glyph?.parameters?.length || 0,
          parameters: glyphInstance?._glyph?.parameters
        })
        
        if (glyphInstance && glyphInstance._glyph.parameters) {
          // 从字形实例获取最新的参数（使用 _glyph 而不是传入的 glyph）
          const updatedGlyphValue: ICustomGlyph = {
            ...glyphInstance._glyph, // 使用实例的 _glyph，确保包含所有最新数据
            parameters: [...(glyphInstance._glyph.parameters || [])], // 创建新数组以触发响应式更新
          }
          
          const oldValue = (this.context.component as IComponent).value as any
          console.log('[BaseGlyphDragger.throttledSkeletonDrag] Updating component.value:', {
            componentUUID,
            oldParameters: oldValue?.parameters,
            newParameters: updatedGlyphValue.parameters
          })
          
          // 更新 component.value
          ;(this.context.component as IComponent).value = updatedGlyphValue
          
          // 直接调用 store 的 modifyComponent 方法，确保参数被正确保存
          // 检查是否有 characterStore 或 glyphStore
          if ((this.config as any).characterStore) {
            console.log('[BaseGlyphDragger.throttledSkeletonDrag] Calling characterStore.modifyComponent')
            ;(this.config as any).characterStore.modifyComponent(
              (this.context.component as IComponent).uuid,
              { value: updatedGlyphValue }
            )
          } else if ((this.config as any).glyphStore) {
            console.log('[BaseGlyphDragger.throttledSkeletonDrag] Calling glyphStore.modifyComponent')
            ;(this.config as any).glyphStore.modifyComponent(
              (this.context.component as IComponent).uuid,
              { value: updatedGlyphValue }
            )
          } else {
            console.warn('[BaseGlyphDragger.throttledSkeletonDrag] No store found!')
          }
          
          // 触发 onUpdate 回调，确保组件更新被保存
          console.log('[BaseGlyphDragger.throttledSkeletonDrag] Calling onUpdate callback')
          this.config.onUpdate?.(this.context.component)
        } else {
          console.warn('[BaseGlyphDragger.throttledSkeletonDrag] No instance or parameters, still calling onUpdate')
          // 如果没有实例，仍然触发 onUpdate（可能是其他类型的更新）
          this.config.onUpdate?.(this.context.component)
        }
      } else {
        console.log('[BaseGlyphDragger.throttledSkeletonDrag] Not a glyph component, skipping parameter sync')
      }
      
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

  /**
   * 吸附参考线来源：字符/字形编辑下顶层兄弟 glyph 组件（排除当前拖拽 uuid）。
   */
  protected abstract getSnapKeyLinePeers(
    excludeComponentUuid: string,
  ): Array<IComponent | IGlyphComponent>
  
  /**
   * 获取拖拽开始时的初始位置
   * 用于在 handleGlyphDrag 中计算新位置（初始值 + dx/dy）
   */
  protected getInitialOrigin(): { ox: number; oy: number } {
    return { ox: this.initialOx, oy: this.initialOy }
  }
  
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
  
  /**
   * 由于 dragger 实例（context.component）在某些操作后可能指向“旧引用”的组件对象，
   * 会导致 bbox/joints 计算基于过期的 component.value。
   *
   * 每次真正触发拖拽（mousedown）前，从 store 按 componentUUID 取最新 selected component，
   * 以保证 bbox 计算完全一致。
   */
  private syncContextFromStore() {
    const cfg: any = this.config
    const { mode } = this.context

    if (mode === 'character' && cfg.characterStore) {
      const store = cfg.characterStore
      const latest = store.selectedComponent
      if (latest) {
        this.context.componentUUID = latest.uuid
        this.context.component = latest
        // character 拖拽器：只有当 selected component 自身是 glyph 才需要 glyph 实例
        this.context.glyph = latest.type === 'glyph' ? latest.value : undefined
      }
    }

    if (mode === 'glyph' && cfg.glyphStore) {
      const store = cfg.glyphStore
      const latest = store.selectedComponent
      if (latest) {
        this.context.componentUUID = latest.uuid
        this.context.component = latest
        this.context.glyph = latest.type === 'glyph' ? latest.value : undefined
      }
    }
  }

  /**
   * 计算字形组件的包围框（基于实际轮廓点）
   * 遍历外部组件（不在实例中）和内部组件（实例中存储的脚本组件）的实际轮廓点数据
   */
  protected getComponentBoundingBox(component: IComponent, componentUUID: string): { x: number; y: number; w: number; h: number } | null {
    if (component.type !== 'glyph') {
      return null
    }
    
    const origin = this.getOrigin()
    return computeGlyphComponentBoundingBox(component, origin)
  }
  
  /**
   * 检测点是否在包围框内
   */
  protected isPointInBoundingBox(
    x: number,
    y: number,
    bbox: { x: number; y: number; w: number; h: number } | null
  ): boolean {
    if (!bbox) return false
    return (
      x >= bbox.x &&
      x <= bbox.x + bbox.w &&
      y >= bbox.y &&
      y <= bbox.y + bbox.h
    )
  }

  /**
   * 从实例池读取 pen 轮廓，在 (ox, oy) 下提取轴对齐参考线。
   *
   * @param requireExistingInstance
   *   true  → peer 模式：只使用已存在于实例池的实例，不创建新空实例。
   *           创建空实例会 (1) 导致 renderJoints 找到空实例无关键点（拖拽时闪烁）；
   *           (2) 触发 LRU cleanupPool，驱逐有效实例（关键点较多的字符如"黄"尤甚）。
   *   false → 当前组件模式：允许创建实例，并在 _components 为空时执行脚本确保填充，
   *           解决"首次整体拖拽时吸附不生效"的问题。
   */
  private getSnapLinesForGlyphComponent(
    comp: IComponent | IGlyphComponent,
    ox: number,
    oy: number,
    requireExistingInstance: boolean = false,
  ): SnapAxisLine[] {
    if (comp.type !== 'glyph') return []
    const gv = comp.value as ICustomGlyph | undefined
    if (!gv) return []

    // peer 模式：实例不在池中则跳过，避免创建空实例污染池和触发 LRU
    if (requireExistingInstance && !instanceManager.hasInstance(comp.uuid)) {
      return []
    }

    const instance = instanceManager.acquireTemporaryInstance(
      comp.uuid,
      () => new CustomGlyph(gv),
      'glyph',
    ) as CustomGlyph

    // 当前组件模式：首次整体拖拽时 _components 可能为空（onMouseDown 不调用脚本），
    // 主动执行脚本确保首次 mousemove 时吸附参考线即可生效
    if (!requireExistingInstance && instance._components.length === 0 &&
        (gv.script || gv.script_reference || gv.skeleton)) {
      executeGlyphScript(gv, comp.uuid)
    }

    return collectStraightAxisLinesFromPenComponents(instance._components, ox, oy)
  }

  /** 其它顶层字形组件提供的参考线（不含当前拖拽组件） */
  private getAutoSnapKeyLines(): SnapAxisLine[] {
    const peers = this.getSnapKeyLinePeers(this.context.componentUUID)
    // requireExistingInstance=true：只使用已存在的实例，不为 peer 创建空实例
    const groups = peers.map((p) =>
      this.getSnapLinesForGlyphComponent(p, p.ox ?? 0, p.oy ?? 0, true),
    )
    return mergeSnapAxisLines(groups)
  }

  private applySnapDelta(dx: number, dy: number): { adjDx: number; adjDy: number } {
    const comp = this.context.component
    if (!comp || comp.type !== 'glyph') {
      return { adjDx: dx, adjDy: dy }
    }
    const tempOx = this.initialOx + dx
    const tempOy = this.initialOy + dy
    const keylines = this.getAutoSnapKeyLines()
    const reflines = this.getSnapLinesForGlyphComponent(comp, tempOx, tempOy)
    const snap = getSnapRefline(keylines, reflines)
    return {
      adjDx: dx + (snap?.dx ?? 0),
      adjDy: dy + (snap?.dy ?? 0),
    }
  }
  
  // 统一的事件处理
  protected onMouseDown = (e: MouseEvent) => {
    console.log('[BaseGlyphDragger.onMouseDown] START', {
      canDrag: this.canDrag(),
      hasComponent: !!this.context.component,
      componentType: this.context.component?.type,
      componentUUID: this.context.componentUUID,
      hasGlyph: !!this.context.glyph,
      isActive: this._isActive
    })
    
    if (!this.canDrag()) {
      console.log('[BaseGlyphDragger.onMouseDown] Cannot drag, returning')
      return
    }

    // 切换到真正开始拖拽之前，先确保 context.component 是 store 的最新对象引用
    this.syncContextFromStore()
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    
    // 将鼠标坐标从显示尺寸转换为坐标尺寸
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    
    console.log('[BaseGlyphDragger.onMouseDown] Mouse position:', {
      mouseX,
      mouseY,
      coordX,
      coordY
    })
    
    const joints = this.getJoints()
    console.log('[BaseGlyphDragger.onMouseDown] Joints:', {
      jointsCount: joints.length,
      joints: joints.map(j => ({ name: j.name, x: typeof j.x === 'function' ? j.x() : j.x, y: typeof j.y === 'function' ? j.y() : j.y }))
    })
    
    let hitJoint: IJoint | null = null
    
    // 检测是否点击了关键点
    if (this.shouldCheckJoints()) {
      hitJoint = JointManager.findHitJoint(joints, coordX, coordY, 20)
      console.log('[BaseGlyphDragger.onMouseDown] Hit joint check:', {
        shouldCheckJoints: this.shouldCheckJoints(),
        hitJoint: hitJoint ? { name: hitJoint.name } : null
      })
    }
    
    // 检测是否在组件包围框内（且并非关键点）
    let isInBoundingBox = false
    if (!hitJoint && this.context.component && this.context.component.type === 'glyph') {
      const bbox = this.getComponentBoundingBox(
        this.context.component as IComponent,
        this.context.componentUUID
      )
      isInBoundingBox = this.isPointInBoundingBox(coordX, coordY, bbox)
      console.log('[BaseGlyphDragger.onMouseDown] Bounding box check:', {
        bbox,
        isInBoundingBox
      })
    }
    
    if (hitJoint) {
      // 点击了关键点，拖拽关键点
      this.draggingJoint = hitJoint
      this.isDraggingFirstJoint = JointManager.isFirstJoint(hitJoint, joints)
      
        console.log('[BaseGlyphDragger.onMouseDown] Hit joint:', {
          jointName: hitJoint.name,
          isFirstJoint: this.isDraggingFirstJoint,
          hasGlyph: !!this.context.glyph,
          componentUUID: this.context.componentUUID
        })
      
      // 调用脚本回调（非第一个关键点）
      if (!this.isDraggingFirstJoint && this.context.glyph) {
        // 确保实例已创建并执行过脚本（如果还没有）
        // 这样 onSkeletonDragStart 等回调才能正确设置
        const instanceKey = this.context.componentUUID
        const isTemporary = instanceManager.isTemporary(instanceKey)
        console.log('[BaseGlyphDragger.onMouseDown] Instance check:', {
          instanceKey,
          isTemporary,
          hasGlyph: !!this.context.glyph
        })
        
        if (!isTemporary) {
          // 如果实例不存在，先执行脚本创建实例
          console.log('[BaseGlyphDragger.onMouseDown] Executing script to create instance')
          executeGlyphScript(this.context.glyph, instanceKey)
          
          // 检查实例是否创建成功
          const instanceAfter = instanceManager.isTemporary(instanceKey)
          console.log('[BaseGlyphDragger.onMouseDown] Instance after script execution:', {
            instanceKey,
            isTemporary: instanceAfter
          })
        }
        
        console.log('[BaseGlyphDragger.onMouseDown] Calling executeDragStart')
        ScriptExecutor.executeDragStart(
          this.context.glyph,
          this.context.componentUUID,
          hitJoint
        )
      } else {
        console.log('[BaseGlyphDragger.onMouseDown] Skipping executeDragStart:', {
          isFirstJoint: this.isDraggingFirstJoint,
          hasGlyph: !!this.context.glyph
        })
      }
    } else if (isInBoundingBox) {
      // 在包围框内但并非关键点，准备移动组件
      this.draggingJoint = null
      this.isDraggingFirstJoint = false
      
        console.log('[BaseGlyphDragger.onMouseDown] In bounding box, will drag component')
    } else {
      // 不在包围框内，也不在关键点上，不处理
      console.log('[BaseGlyphDragger.onMouseDown] Not in bounding box or on joint, returning')
      return
    }

    this._isDragging = true
    // 拖拽时清除悬停关键点，避免高亮显示在原位置
    this.hoverJoint = null
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    this.lastX = coordX
    this.lastY = coordY
    this.origin = this.getOrigin()
    // 记录初始的 ox 和 oy，用于拖拽时计算新位置（避免累加错误）
    this.initialOx = this.origin.ox
    this.initialOy = this.origin.oy
    
    console.log('[BaseGlyphDragger.onMouseDown] Drag started:', {
      isDragging: this._isDragging,
      draggingJoint: this.draggingJoint?.name,
      lastX: this.lastX,
      lastY: this.lastY,
      origin: this.origin
    })
    
    // 在 window 上监听 mousemove 和 mouseup，确保即使鼠标移出 canvas 也能继续拖拽
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
  }
  
  protected onMouseMove = (e: MouseEvent) => {
    console.log('[BaseGlyphDragger.onMouseMove] CALLED:', {
      isDragging: this._isDragging,
      draggingJoint: this.draggingJoint?.name,
      target: e.target,
      clientX: e.clientX,
      clientY: e.clientY
    })
    
    if (!this._isDragging) {
      // 更新悬停关键点（只在 canvas 上时更新）
      if (e.target === this.canvas || this.canvas.contains(e.target as Node)) {
      this.updateHoverJoint(e)
      }
      return
    }
    
    console.log('[BaseGlyphDragger.onMouseMove] Dragging:', {
      draggingJoint: this.draggingJoint?.name,
      isDraggingFirstJoint: this.isDraggingFirstJoint,
      hasGlyph: !!this.context.glyph,
      componentType: this.context.component?.type,
      target: e.target,
      isOnCanvas: e.target === this.canvas || this.canvas.contains(e.target as Node)
    })
    
    // 计算鼠标相对于 canvas 的位置（即使事件不在 canvas 上触发）
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    const dx = coordX - this.lastX
    const dy = coordY - this.lastY
    
    console.log('[BaseGlyphDragger.onMouseMove] Position delta:', {
      coordX,
      coordY,
      lastX: this.lastX,
      lastY: this.lastY,
      dx,
      dy
    })
    
    const movingWholeComponent =
      this.context.component?.type === 'glyph' &&
      (!this.draggingJoint || this.isDraggingFirstJoint)

    if (movingWholeComponent) {
      const { adjDx, adjDy } = this.applySnapDelta(dx, dy)
      console.log('[BaseGlyphDragger.onMouseMove] Calling throttledGlyphDrag (snap)', {
        adjDx,
        adjDy,
        isDraggingFirstJoint: this.isDraggingFirstJoint,
      })
      this.throttledGlyphDrag(adjDx, adjDy)
    } else if (this.draggingJoint && !this.isDraggingFirstJoint && this.context.glyph) {
      const { adjDx, adjDy } = this.applySnapDelta(dx, dy)
      console.log('[BaseGlyphDragger.onMouseMove] Calling throttledSkeletonDrag (snap)', {
        jointName: this.draggingJoint.name,
        adjDx,
        adjDy,
        componentUUID: this.context.componentUUID,
      })
      this.throttledSkeletonDrag(
        this.context.glyph,
        this.context.componentUUID,
        this.draggingJoint!,
        adjDx,
        adjDy,
      )
    } else {
      console.log('[BaseGlyphDragger.onMouseMove] No drag action:', {
        hasDraggingJoint: !!this.draggingJoint,
        isDraggingFirstJoint: this.isDraggingFirstJoint,
        hasGlyph: !!this.context.glyph,
        componentType: this.context.component?.type,
      })
    }
    
    // 注意：不要更新 lastX 和 lastY！
    // dx 和 dy 应该始终相对于 mousedown 时的初始位置计算
  }
  
  protected onMouseUp = (e: MouseEvent) => {
    console.log('[BaseGlyphDragger.onMouseUp] CALLED:', {
      isDragging: this._isDragging,
      draggingJoint: this.draggingJoint?.name,
      target: e.target
    })
    
    if (!this._isDragging) {
      console.log('[BaseGlyphDragger.onMouseUp] Not dragging, returning')
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
    
    console.log('[BaseGlyphDragger.onMouseUp] Drag end:', {
      dx,
      dy,
      draggingJoint: this.draggingJoint?.name
    })

    const movingWholeComponent =
      this.context.component?.type === 'glyph' &&
      (!this.draggingJoint || this.isDraggingFirstJoint)

    if (movingWholeComponent) {
      const { adjDx, adjDy } = this.applySnapDelta(dx, dy)
      if (typeof (this.throttledGlyphDrag as any).cancel === 'function') {
        ;(this.throttledGlyphDrag as any).cancel()
      }
      this.handleGlyphDrag(adjDx, adjDy)
      this.config.onRender?.()
    }

    // 调用脚本回调（非第一个关键点），delta 与 mousemove 吸附一致
    if (
      this.context.glyph &&
      this.draggingJoint &&
      !this.isDraggingFirstJoint
    ) {
      const { adjDx, adjDy } = this.applySnapDelta(dx, dy)
      if (typeof (this.throttledSkeletonDrag as any).cancel === 'function') {
        ;(this.throttledSkeletonDrag as any).cancel()
      }
      console.log('[BaseGlyphDragger.onMouseUp] Calling executeDragEnd (snap)', {
        adjDx,
        adjDy,
      })
      ScriptExecutor.executeDragEnd(
        this.context.glyph,
        this.context.componentUUID,
        {
          draggingJoint: this.draggingJoint,
          deltaX: adjDx,
          deltaY: adjDy,
        },
      )
    }
    
    console.log('[BaseGlyphDragger.onMouseUp] Calling handleDragEnd')
    this.handleDragEnd()
    console.log('[BaseGlyphDragger.onMouseUp] Calling cleanup')
    this.cleanup()
  }
  
  private updateHoverJoint(e: MouseEvent) {
    if (!this.shouldCheckJoints()) {
      const hadHoverJoint = this.hoverJoint !== null
      this.hoverJoint = null
      // 如果之前有 hoverJoint，现在清除了，需要重新渲染
      if (hadHoverJoint) {
        this.config.onRender?.()
      }
      return
    }
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    const joints = this.getJoints()
    
    // 过滤掉参考关键点（名称包含 _ref 的关键点），与原工程一致
    const filteredJoints = joints.filter(joint => !joint.name.includes('_ref'))
    
    // 将鼠标坐标从显示尺寸转换为坐标尺寸
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    
    // joints 已经是全局坐标（getJoints() 已经加上了正确的 ox, oy）
    // 使用转换后的坐标尺寸进行比较
    const newHoverJoint = JointManager.findHoverJoint(filteredJoints, coordX, coordY, 10)
    
    // 比较 hoverJoint 是否发生变化（通过 name 比较，因为对象引用可能不同）
    const oldHoverJointName = this.hoverJoint?.name
    const newHoverJointName = newHoverJoint?.name
    const hasChanged = oldHoverJointName !== newHoverJointName
    
    if (hasChanged) {
      this.hoverJoint = newHoverJoint
      // 触发重新渲染以显示高亮
      this.config.onRender?.()
    } else {
      this.hoverJoint = newHoverJoint
    }
  }
  
  private handleDefaultDrag(dx: number, dy: number): void {
    // 默认行为：移动组件位置
    this.handleGlyphDrag(dx, dy)
  }
  
  private cleanup() {
    if (this._isDragging) {
      console.log('[BaseGlyphDragger.cleanup] ⚠️ Cleaning up while dragging!', {
        stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
      })
    }
    this._isDragging = false
    this.draggingJoint = null
    this.isDraggingFirstJoint = false
    this.hoverJoint = null
    this.lastX = 0
    this.lastY = 0
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove) // 移除 window 上的监听器
  }
  
  // 公共方法
  getDraggingJoint(): IJoint | null {
    return this.draggingJoint
  }
  
  getHoverJoint(): IJoint | null {
    return this.hoverJoint
  }
  
  /**
   * 获取所有关键点（用于判断是否是第一个关键点）
   */
  getJointsForHighlight(): IJoint[] {
    return this.getJoints()
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
  
  /** 使用 capture 阶段，确保在 SelectTool 之前收到 mousedown，避免导入后首点被抢占导致无法移动 */
  private static readonly MOUSEDOWN_CAPTURE = true

  activate() {
    console.log('[BaseGlyphDragger.activate] Activating dragger:', {
      canvas: !!this.canvas,
      hasComponent: !!this.context.component,
      componentType: this.context.component?.type
    })
    this._isActive = true
    this.canvas.addEventListener('mousedown', this.onMouseDown, BaseGlyphDragger.MOUSEDOWN_CAPTURE)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    console.log('[BaseGlyphDragger.activate] Event listeners added')
  }
  
  deactivate() {
    this._isActive = false
    
    // 1. 移除所有事件监听器（capture 须与 add 时一致）
    this.canvas.removeEventListener('mousedown', this.onMouseDown, BaseGlyphDragger.MOUSEDOWN_CAPTURE)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousemove', this.onMouseMove) // 移除 window 上的监听器
    window.removeEventListener('mouseup', this.onMouseUp)
    
    // 2. 清理状态
    this.cleanup()
    
    // 3. 取消节流函数的pending调用
    this.cancelThrottledFunctions()
  }
}
