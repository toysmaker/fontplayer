/**
 * 字形骨架拖拽器
 * 简化版关节拖拽，不依赖 BaseGlyphDragger，无吸附、无复杂功能
 * 生命周期与 onSkeletonBind 绑定：true 时可拖拽，false 时锁定
 */

import type { CustomGlyph } from '@/core/instance/CustomGlyph'
import { glyphSkeletonRebind } from '@/features/glyphSkeletonBind'

type CoordFn = (coord: number) => number

const HIT_DISTANCE = 20 // UPM 单位

export class GlyphSkeletonDragger {
  private canvas: HTMLCanvasElement | null = null
  private getCoord: CoordFn | null = null
  private onRender: (() => void) | null = null

  private glyphInstance: CustomGlyph | null = null
  private draggingJoint: any = null
  private startDisplayX = 0
  private startDisplayY = 0
  private attached = false

  /** 设置 canvas 和坐标转换函数 */
  setup(canvas: HTMLCanvasElement, getCoord: CoordFn, onRender: () => void): void {
    this.canvas = canvas
    this.getCoord = getCoord
    this.onRender = onRender
  }

  /** 设置当前拖拽上下文（onSkeletonBind 变为 true 时调用） */
  setContext(glyphInstance: CustomGlyph): void {
    this.glyphInstance = glyphInstance
    if (!this.attached && this.canvas) {
      this.attach()
    }
  }

  /** 清除拖拽上下文（onSkeletonBind 变为 false 时调用） */
  clearContext(): void {
    this.glyphInstance = null
    this.draggingJoint = null
  }

  /** 销毁拖拽器 */
  destroy(): void {
    this.detach()
    this.glyphInstance = null
    this.canvas = null
    this.getCoord = null
    this.onRender = null
  }

  private attach(): void {
    if (!this.canvas || this.attached) return
    this.canvas.addEventListener('mousedown', this.onMouseDown, true)
    this.attached = true
  }

  private detach(): void {
    if (!this.canvas || !this.attached) return
    this.canvas.removeEventListener('mousedown', this.onMouseDown, true)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.onMouseUp)
    this.attached = false
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.glyphInstance || !this.getCoord || !this.canvas) return

    const rect = this.canvas.getBoundingClientRect()
    const displayX = e.clientX - rect.left
    const displayY = e.clientY - rect.top

    const joints = this.glyphInstance.getJoints()
    if (!joints || joints.length === 0) return

    // 命中测试：找距离鼠标最近的关节（跳过 ref 关节）
    const coordX = this.getCoord(displayX)
    const coordY = this.getCoord(displayY)
    let closestJoint: any = null
    let closestDist = HIT_DISTANCE

    for (const joint of joints) {
      if (joint.name?.includes('ref')) continue
      const jx = typeof joint.x === 'function' ? joint.x() : joint.x
      const jy = typeof joint.y === 'function' ? joint.y() : joint.y
      const dx = coordX - Number(jx)
      const dy = coordY - Number(jy)
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < closestDist) {
        closestDist = dist
        closestJoint = joint
      }
    }

    if (!closestJoint) return

    this.draggingJoint = closestJoint
    this.startDisplayX = e.clientX
    this.startDisplayY = e.clientY

    // 调用脚本的 onSkeletonDragStart（保存所有关节位置快照到 tempData）
    if (this.glyphInstance.onSkeletonDragStart) {
      this.glyphInstance.onSkeletonDragStart({
        draggingJoint: closestJoint,
        deltaX: 0,
        deltaY: 0,
      })
    } else {
      // 回退：手动保存关节快照
      this.glyphInstance.tempData = {}
      const allJoints = this.glyphInstance.getJoints()
      for (const j of allJoints) {
        this.glyphInstance.tempData[j.name] = {
          name: j.name,
          x: typeof j.x === 'function' ? j.x() : j.x,
          y: typeof j.y === 'function' ? j.y() : j.y,
        }
      }
    }

    // 额外保存 ox/oy（用于第一个关节整体平移时更新 skeleton.ox/oy）
    const skel = (this.glyphInstance._glyph as any)?.skeleton
    if (this.glyphInstance.tempData) {
      this.glyphInstance.tempData._ox = skel?.ox ?? 0
      this.glyphInstance.tempData._oy = skel?.oy ?? 0
    }

    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.onMouseUp)
    e.preventDefault()
    e.stopPropagation()
  }

  private convertDeltaToUPM(displayDeltaX: number, displayDeltaY: number): { x: number; y: number } {
    if (!this.getCoord) return { x: 0, y: 0 }

    // getCoord 将单个显示坐标转换为 UPM 坐标
    // 计算单位显示像素对应的 UPM 单位
    const originX = this.getCoord(0)
    const unitX = this.getCoord(1)
    const upmPerDisplayPixel = unitX - originX

    return {
      x: displayDeltaX * upmPerDisplayPixel,
      y: displayDeltaY * upmPerDisplayPixel,
    }
  }

  private lastDragTime = 0
  private readonly DRAG_THROTTLE_MS = 16

  private isFirstNonRefJoint(joint: any): boolean {
    const joints = this.glyphInstance?.getJoints?.() || []
    const nonRefJoints = joints.filter((j: any) => !j.name?.includes('_ref') && !j.name?.includes('ref'))
    return nonRefJoints.length > 0 && nonRefJoints[0].name === joint.name
  }

  /** 将 ox/oy 偏移应用到所有关节（脚本重新生成关节后，ox/oy 偏移会丢失，需要重新应用） */
  private applyOxOyOffset(): void {
    const skel = (this.glyphInstance?._glyph as any)?.skeleton
    if (!skel || (!skel.ox && !skel.oy)) return
    const ox = skel.ox || 0
    const oy = skel.oy || 0
    if (ox === 0 && oy === 0) return

    const allJoints = (this.glyphInstance as any)?.getJoints?.() || []
    for (const j of allJoints) {
      if (j._x !== undefined) { j._x += ox; j._y += oy }
      else if (typeof j.x !== 'function' && j.x !== undefined) { j.x += ox; j.y += oy }
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.glyphInstance || !this.draggingJoint) return

    const now = performance.now()
    if (now - this.lastDragTime < this.DRAG_THROTTLE_MS) return
    this.lastDragTime = now

    const displayDx = e.clientX - this.startDisplayX
    const displayDy = e.clientY - this.startDisplayY
    const delta = this.convertDeltaToUPM(displayDx, displayDy)

    // 拖拽第一个非 ref 关节：整体平移所有关节，更新 skeleton.ox/oy
    if (this.isFirstNonRefJoint(this.draggingJoint)) {
      const allJoints = (this.glyphInstance as any).getJoints?.() || []
      for (const j of allJoints) {
        if (!this.glyphInstance.tempData?.[j.name]) continue
        const td = this.glyphInstance.tempData[j.name]
        if (j._x !== undefined) { j._x = td.x + delta.x; j._y = td.y + delta.y }
        else if (typeof j.x !== 'function' && j.x !== undefined) { j.x = td.x + delta.x; j.y = td.y + delta.y }
      }
      // 更新 skeleton ox/oy（脚本重新生成关节后会重新应用此偏移）
      const skel2 = (this.glyphInstance._glyph as any)?.skeleton
      if (skel2 && this.glyphInstance.tempData) {
        if (skel2.ox !== undefined) skel2.ox = (this.glyphInstance.tempData._ox || 0) + delta.x
        if (skel2.oy !== undefined) skel2.oy = (this.glyphInstance.tempData._oy || 0) + delta.y
      }
    } else {
      // 其他关节：调用脚本的 onSkeletonDrag
      if (this.glyphInstance.onSkeletonDrag) {
        this.glyphInstance.onSkeletonDrag({
          draggingJoint: this.draggingJoint,
          deltaX: delta.x,
          deltaY: delta.y,
        })
      }
      // 脚本重新生成关节后，重新应用 ox/oy 偏移
      this.applyOxOyOffset()
    }

    // 清除脚本生成的视觉组件（glyphSkeleton 只用骨架）
    if (this.glyphInstance._components) {
      this.glyphInstance._components = []
    }

    // 如果已绑定（glyphSkeletonBindData 存在），重新计算骨骼变形
    const skeleton = (this.glyphInstance._glyph as any)?.skeleton
    if (skeleton?.glyphSkeletonBindData) {
      glyphSkeletonRebind(this.glyphInstance)
    }

    this.onRender?.()
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.glyphInstance || !this.draggingJoint) return

    const displayDx = e.clientX - this.startDisplayX
    const displayDy = e.clientY - this.startDisplayY
    const delta = this.convertDeltaToUPM(displayDx, displayDy)

    if (this.isFirstNonRefJoint(this.draggingJoint)) {
      // 位置已在 onMouseMove 中更新，ox/oy 已存储
    } else {
      // 其他关节：调用脚本的 onSkeletonDragEnd
      if (this.glyphInstance.onSkeletonDragEnd) {
        this.glyphInstance.onSkeletonDragEnd({
          draggingJoint: this.draggingJoint,
          deltaX: delta.x,
          deltaY: delta.y,
        })
      }
      // 重新应用 ox/oy 偏移
      this.applyOxOyOffset()
    }

    // 清除脚本生成的视觉组件
    if (this.glyphInstance._components) {
      this.glyphInstance._components = []
    }

    // 如果已绑定，最终重新变形
    const skeleton = (this.glyphInstance._glyph as any)?.skeleton
    if (skeleton?.glyphSkeletonBindData) {
      glyphSkeletonRebind(this.glyphInstance)
    }

    this.glyphInstance.tempData = null
    this.draggingJoint = null
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.onMouseUp)

    this.onRender?.()
  }
}
