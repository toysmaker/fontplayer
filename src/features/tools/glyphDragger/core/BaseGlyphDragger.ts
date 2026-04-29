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
import { skeletonFreeEdit } from '@/stores/skeletonDragger'
import {
  collectStraightAxisLinesFromPenComponents,
  collectStraightAxisLinesFromGlyphComponents,
  evaluateSnapReflineSticky,
  mergeSnapAxisLines,
  type SnapAxisLine,
} from './reflineSnap'

/** 进入吸附：仅当某 key/ref 对距离 < SNAP_IN（与旧版一致） */
const SNAP_IN = 20
/** 已锁定目标 key 线后，与该 key 的最近 ref 距离 ≤ SNAP_OUT 则保持吸附；略大于 SNAP_IN 以抑制阈值抖动 */
const SNAP_OUT = 24

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
  /** 拖拽开始时从 canvas 上卸下 mousemove，避免与 window 冒泡重复触发 */
  private canvasMouseMoveSuspended = false
  /** 吸附锁定：进入吸附时锁定的水平/垂直 key 线坐标（避免多参考线时每帧重选目标导致颤动） */
  private snapLockHKey: number | null = null
  private snapLockVKey: number | null = null

  /**
   * 字形拖拽由 glyphDragger 处理，SelectTool 对 glyph 的 mousedown 会提前 return，从不置 mousemove。
   * mouseup 时若本手势曾有位移，须跳过后续 handleClickSelection（否则误触发重叠组件轮换）。
   */
  private glyphDragMovedBeyondTap = false
  private static readonly GLYPH_DRAG_TAP_SUPPRESS_EPS_SQ = 1
  
  /**
   * 将拖拽中的临时字形实例参数写回组件 value（executeDrag 已在 applySnapDelta 中调用）。
   */
  private syncSkeletonGlyphValueToStore(
    glyph: ICustomGlyph,
    componentUUID: string,
    triggerRender: boolean,
  ): void {
    if (this.context.component && this.context.component.type === 'glyph') {
      const glyphInstance = instanceManager.acquireTemporaryInstance(
        componentUUID,
        () => new CustomGlyph(glyph),
        'glyph',
      ) as CustomGlyph

      if (glyphInstance && glyphInstance._glyph.parameters) {
        const updatedGlyphValue: ICustomGlyph = {
          ...glyphInstance._glyph,
          parameters: [...(glyphInstance._glyph.parameters || [])],
        }

        const comp = this.context.component as IComponent
        if ((this.config as any).characterStore) {
          ;(this.config as any).characterStore.modifyComponent(comp.uuid, {
            value: updatedGlyphValue,
          })
        } else if ((this.config as any).glyphStore) {
          ;(this.config as any).glyphStore.modifyComponent(comp.uuid, {
            value: updatedGlyphValue,
          })
        }
        if (comp.type === 'glyph') {
          this.context.glyph = comp.value as ICustomGlyph
        }

        this.config.onUpdate?.(this.context.component)
      } else {
        this.config.onUpdate?.(this.context.component)
      }
    }

    if (triggerRender) {
      this.config.onRender?.()
    }
  }

  /**
   * 骨架形变已在 applySnapDelta 内同步执行 executeDrag（先 raw 取线再 snapped），
   * 此处仅节流：把实例参数写回 store + 渲染，避免重复 executeDrag 与吸附判断用的几何不一致。
   */
  private throttledSkeletonSync = throttle(
    (glyph: ICustomGlyph, componentUUID: string) => {
      this.syncSkeletonGlyphValueToStore(glyph, componentUUID, false)
    },
    16,
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

  /** 与 Figma 等一致：拖动时按住 Ctrl（Windows）或 ⌘（Mac）临时关闭参考线吸附 */
  private pointerSnapSuppressed(e: MouseEvent): boolean {
    return e.ctrlKey || e.metaKey
  }
  
  /**
   * 由于 dragger 实例（context.component）在某些操作后可能指向“旧引用”的组件对象，
   * 会导致 bbox/joints 计算基于过期的 component.value。
   *
   * 每次真正触发拖拽（mousedown）前，从 store 按 componentUUID 取最新 selected component，
   * 以保证 bbox 计算完全一致。
   */
  /**
   * 画布点击改选组件后调用，使 context 与 store 的 selectedComponent 一致，
   * 避免下一轮拖拽骨架仍绑定旧 component 引用。
   */
  syncContextWithStoreSelection(): void {
    this.syncContextFromStore()
  }

  private syncContextFromStore() {
    const cfg: any = this.config
    const { mode } = this.context

    const prevUUID = this.context.componentUUID

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

    // 选中从 A 切到 B 时须重置拖拽基准。否则 mousedown 写在 initialOx/Oy 上的仍是 A，
    // 而同一 click 的 mouseup 里（window，晚于 SelectTool）handleGlyphDrag 已指向 B，
    // 会把 A 的原点误写进 B，表现为叠字点击切选后组件「跳到上一选区附近」。
    if (this.context.componentUUID !== undefined && this.context.componentUUID !== prevUUID) {
      const o = this.getOrigin()
      this.initialOx = o.ox ?? 0
      this.initialOy = o.oy ?? 0
      this.origin = o
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

    const lines = collectStraightAxisLinesFromPenComponents(instance._components, ox, oy)
    // 骨架字形：_components 永远为空（executeGlyphScript 走 strokeFn 分支后 early-return）；
    // 实际几何在 _glyph.components（type='pen'，由 applySkeletonTransformation 原地更新）。
    if (lines.length === 0 && instance._glyph?.components?.length) {
      return collectStraightAxisLinesFromGlyphComponents(instance._glyph.components as any[], ox, oy)
    }
    return lines
  }

  /**
   * 吸附前预热：为当前字形与所有 peer 建立临时实例并在需要时执行脚本，
   * 避免 getAutoSnapKeyLines 在 requireExistingInstance 下因 peer 无实例而拿不到参考线。
   */
  private primeSnapInstancesForPeerSnapping(): void {
    const comp = this.context.component
    if (!comp || comp.type !== 'glyph') return

    const seen = new Set<string>()

    const primeOne = (c: IComponent | IGlyphComponent) => {
      if (c.type !== 'glyph') return
      const uuid = c.uuid
      if (seen.has(uuid)) return
      seen.add(uuid)
      const v = c.value as ICustomGlyph | undefined
      if (!v) return
      const instance = instanceManager.acquireTemporaryInstance(
        uuid,
        () => new CustomGlyph(v),
        'glyph',
      ) as CustomGlyph
      if (
        instance._components.length === 0 &&
        (v.script || v.script_reference || v.skeleton)
      ) {
        executeGlyphScript(v, uuid)
      }
    }

    primeOne(comp as IComponent)
    for (const p of this.getSnapKeyLinePeers(this.context.componentUUID)) {
      primeOne(p)
    }
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

  /**
   * 临时实例上当前拖拽关节的世界坐标（局部 + initialOx/initialOy），与 collectStraightAxisLines* 一致。
   * 在第一次 executeDrag(raw) 之后调用。
   */
  private getDraggingJointWorldFromInstance(
    instance: CustomGlyph,
    draggingJoint: IJoint,
  ): { x: number; y: number } | null {
    const joints = instance.getJoints()
    const match = joints.find(
      (j: { uuid?: string; name?: string }) =>
        (draggingJoint.uuid != null && j.uuid === draggingJoint.uuid) ||
        j.name === draggingJoint.name,
    )
    if (!match) {
      return null
    }
    const lx =
      typeof match.x === 'function' ? match.x() : (match.x ?? match._x ?? 0)
    const ly =
      typeof match.y === 'function' ? match.y() : (match.y ?? match._y ?? 0)
    return {
      x: lx + this.initialOx,
      y: ly + this.initialOy,
    }
  }

  /**
   * @param forWholeGlyphTranslation
   *   true：整体平移组件，试探位置为 initialOrigin + 指针累积位移（与 handleGlyphDrag 一致）。
   *   false：拖骨架非首点，组件 ox/oy 不变；须先用指针累积位移 raw 更新实例再取 pen 轴对齐线，
   *   否则 reflines 仍是上一帧吸附后的轮廓，与当前 dx/dy 语义不一致，会在吸附线附近剧烈颤动。
   * @param snapSuppressed 为 true 时不做参考线吸附，并清除吸附锁（按住 Ctrl / ⌘ 拖动）。
   */
  private applySnapDelta(
    dx: number,
    dy: number,
    forWholeGlyphTranslation: boolean,
    snapSuppressed: boolean = false,
  ): { adjDx: number; adjDy: number } {
    const comp = this.context.component
    if (!comp || comp.type !== 'glyph') {
      return { adjDx: dx, adjDy: dy }
    }

    if (snapSuppressed) {
      this.snapLockHKey = null
      this.snapLockVKey = null
      if (!forWholeGlyphTranslation) {
        const glyph = this.context.glyph
        const joint = this.draggingJoint
        if (glyph && joint) {
          ScriptExecutor.executeDrag(glyph, comp.uuid, {
            draggingJoint: joint,
            deltaX: dx,
            deltaY: dy,
          })
        }
      }
      return { adjDx: dx, adjDy: dy }
    }

    if (forWholeGlyphTranslation) {
      const tempOx = this.initialOx + dx
      const tempOy = this.initialOy + dy
      const keylines = this.getAutoSnapKeyLines()
      const reflines = this.getSnapLinesForGlyphComponent(comp, tempOx, tempOy)
      const ev = evaluateSnapReflineSticky(
        keylines,
        reflines,
        SNAP_IN,
        SNAP_OUT,
        this.snapLockHKey,
        this.snapLockVKey,
      )
      this.snapLockHKey = ev.lockHNext
      this.snapLockVKey = ev.lockVNext
      return {
        adjDx: dx + ev.dx,
        adjDy: dy + ev.dy,
      }
    }

    const glyph = this.context.glyph
    const joint = this.draggingJoint
    if (!glyph || !joint) {
      return { adjDx: dx, adjDy: dy }
    }

    ScriptExecutor.executeDrag(glyph, comp.uuid, {
      draggingJoint: joint,
      deltaX: dx,
      deltaY: dy,
    })

    const snapInstance = instanceManager.acquireTemporaryInstance(
      comp.uuid,
      () => new CustomGlyph(glyph),
      'glyph',
    ) as CustomGlyph
    let reflines = collectStraightAxisLinesFromPenComponents(
      snapInstance._components,
      this.initialOx,
      this.initialOy,
    )
    // 骨架字形：_components 永远为空；回退到 _glyph.components（type='pen'）
    if (reflines.length === 0 && snapInstance._glyph?.components?.length) {
      reflines = collectStraightAxisLinesFromGlyphComponents(
        snapInstance._glyph.components as any[],
        this.initialOx,
        this.initialOy,
      )
    }

    const keylines = this.getAutoSnapKeyLines()
    const jointWorld = this.getDraggingJointWorldFromInstance(snapInstance, joint)
    const ev = evaluateSnapReflineSticky(
      keylines,
      reflines,
      SNAP_IN,
      SNAP_OUT,
      this.snapLockHKey,
      this.snapLockVKey,
      jointWorld,
    )
    this.snapLockHKey = ev.lockHNext
    this.snapLockVKey = ev.lockVNext

    const adjDx = dx + ev.dx
    const adjDy = dy + ev.dy

    ScriptExecutor.executeDrag(glyph, comp.uuid, {
      draggingJoint: joint,
      deltaX: adjDx,
      deltaY: adjDy,
    })

    return { adjDx, adjDy }
  }
  
  // 统一的事件处理
  protected onMouseDown = (e: MouseEvent) => {
    if (!this.canDrag()) {
      return
    }

    // 防止重复进入：若上一次拖拽的 mouseup 尚未触发（如事件顺序异常），忽略新的 mousedown
    if (this._isDragging) {
      return
    }

    // 骨架自由编辑模式下，glyphDragger 不介入拖拽，让 PenSelectTool 处理钢笔轮廓编辑
    if (skeletonFreeEdit.value) {
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
    
    const joints = this.getJoints()
    
    let hitJoint: IJoint | null = null
    
    // 检测是否点击了关键点
    if (this.shouldCheckJoints()) {
      hitJoint = JointManager.findHitJoint(joints, coordX, coordY, 20)
    }
    
    // 检测是否在组件包围框内（且并非关键点）
    let isInBoundingBox = false
    if (!hitJoint && this.context.component && this.context.component.type === 'glyph') {
      const bbox = this.getComponentBoundingBox(
        this.context.component as IComponent,
        this.context.componentUUID
      )
      isInBoundingBox = this.isPointInBoundingBox(coordX, coordY, bbox)
    }
    
    if (hitJoint) {
      // 点击了关键点，拖拽关键点
      this.draggingJoint = hitJoint
      this.isDraggingFirstJoint = JointManager.isFirstJoint(hitJoint, joints)
      
      // 调用脚本回调（非第一个关键点）
      if (!this.isDraggingFirstJoint && this.context.glyph) {
        const instanceKey = this.context.componentUUID
        const isTemporary = instanceManager.isTemporary(instanceKey)
        
        if (!isTemporary) {
          executeGlyphScript(this.context.glyph, instanceKey)
        }
        
        ScriptExecutor.executeDragStart(
          this.context.glyph,
          this.context.componentUUID,
          hitJoint
        )
      }
    } else if (isInBoundingBox) {
      // 在包围框内但并非关键点，准备移动组件
      this.draggingJoint = null
      this.isDraggingFirstJoint = false
    } else {
      return
    }

    this._isDragging = true
    this.glyphDragMovedBeyondTap = false
    // 拖拽时清除悬停关键点，避免高亮显示在原位置
    this.hoverJoint = null
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    this.lastX = coordX
    this.lastY = coordY
    this.origin = this.getOrigin()
    // 记录初始的 ox 和 oy，用于拖拽时计算新位置（避免累加错误）
    this.initialOx = this.origin.ox
    this.initialOy = this.origin.oy
    this.snapLockHKey = null
    this.snapLockVKey = null

    this.primeSnapInstancesForPeerSnapping()
    
    // 在 window 上监听 mousemove；暂停 canvas 上的 mousemove，避免同一事件冒泡导致处理两次
    if (!this.canvasMouseMoveSuspended) {
      this.canvas.removeEventListener('mousemove', this.onMouseMove)
      this.canvasMouseMoveSuspended = true
    }
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
  }
  
  protected onMouseMove = (e: MouseEvent) => {
    if (!this._isDragging) {
      // 更新悬停关键点（只在 canvas 上时更新）
      if (e.target === this.canvas || this.canvas.contains(e.target as Node)) {
        this.updateHoverJoint(e)
      }
      return
    }
    
    // 计算鼠标相对于 canvas 的位置（即使事件不在 canvas 上触发）
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = this.getCoord(e.clientX - rect.left)
    const mouseY = this.getCoord(e.clientY - rect.top)
    
    // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
    const coordX = this.convertDisplayToCoord(mouseX, true)
    const coordY = this.convertDisplayToCoord(mouseY, false)
    const dx = coordX - this.lastX
    const dy = coordY - this.lastY

    if (
      this._isDragging &&
      dx * dx + dy * dy > BaseGlyphDragger.GLYPH_DRAG_TAP_SUPPRESS_EPS_SQ
    ) {
      this.glyphDragMovedBeyondTap = true
    }

    const movingWholeComponent =
      this.context.component?.type === 'glyph' &&
      (!this.draggingJoint || this.isDraggingFirstJoint)

    if (movingWholeComponent) {
      const { adjDx, adjDy } = this.applySnapDelta(
        dx,
        dy,
        true,
        this.pointerSnapSuppressed(e),
      )
      this.throttledGlyphDrag(adjDx, adjDy)
    } else if (this.draggingJoint && !this.isDraggingFirstJoint && this.context.glyph) {
      this.applySnapDelta(dx, dy, false, this.pointerSnapSuppressed(e))
      this.config.onRender?.()
      this.throttledSkeletonSync(this.context.glyph, this.context.componentUUID)
    }
    
    // 注意：不要更新 lastX 和 lastY！
    // dx 和 dy 应该始终相对于 mousedown 时的初始位置计算
  }
  
  protected onMouseUp = (e: MouseEvent) => {
    if (!this._isDragging) {
      return
    }

    try {
      const rect = this.canvas.getBoundingClientRect()
      const mouseX = this.getCoord(e.clientX - rect.left)
      const mouseY = this.getCoord(e.clientY - rect.top)

      // 将显示坐标转换为坐标尺寸，用于计算拖拽增量
      const coordX = this.convertDisplayToCoord(mouseX, true)
      const coordY = this.convertDisplayToCoord(mouseY, false)
      const dx = coordX - this.lastX
      const dy = coordY - this.lastY

      const hasMoved =
        dx * dx + dy * dy > BaseGlyphDragger.GLYPH_DRAG_TAP_SUPPRESS_EPS_SQ

      if (hasMoved) {
        this.glyphDragMovedBeyondTap = true
      }

      const movingWholeComponent =
        this.context.component?.type === 'glyph' &&
        (!this.draggingJoint || this.isDraggingFirstJoint)

      if (movingWholeComponent && hasMoved) {
        const { adjDx, adjDy } = this.applySnapDelta(
          dx,
          dy,
          true,
          this.pointerSnapSuppressed(e),
        )
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
        const { adjDx, adjDy } = this.applySnapDelta(
          dx,
          dy,
          false,
          this.pointerSnapSuppressed(e),
        )
        if (typeof (this.throttledSkeletonSync as any).cancel === 'function') {
          ;(this.throttledSkeletonSync as any).cancel()
        }
        this.syncSkeletonGlyphValueToStore(this.context.glyph, this.context.componentUUID, false)
        ScriptExecutor.executeDragEnd(
          this.context.glyph,
          this.context.componentUUID,
          {
            draggingJoint: this.draggingJoint,
            deltaX: adjDx,
            deltaY: adjDy,
          },
        )
        this.config.onRender?.()
      }

      // 仅在确实发生过移动或骨架关节拖拽时才提交变更
      if (hasMoved || (this.draggingJoint && !this.isDraggingFirstJoint)) {
        this.handleDragEnd()
      }
    } finally {
      this.cleanup()
    }
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
    this._isDragging = false
    this.glyphDragMovedBeyondTap = false
    this.draggingJoint = null
    this.isDraggingFirstJoint = false
    this.hoverJoint = null
    this.snapLockHKey = null
    this.snapLockVKey = null
    this.lastX = 0
    this.lastY = 0
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    if (this.canvasMouseMoveSuspended && this.canvas) {
      this.canvas.addEventListener('mousemove', this.onMouseMove)
      this.canvasMouseMoveSuspended = false
    }
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

  /** 供 SelectTool：本 mouse 手势在字形拖拽中是否已产生位移（用于抑制重叠点击轮换） */
  shouldSuppressOverlapPickAfterGlyphDrag(): boolean {
    return this.glyphDragMovedBeyondTap
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
    if (typeof (this.throttledSkeletonSync as any).cancel === 'function') {
      ;(this.throttledSkeletonSync as any).cancel()
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
    this._isActive = true
    this.canvas.addEventListener('mousedown', this.onMouseDown, BaseGlyphDragger.MOUSEDOWN_CAPTURE)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
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
