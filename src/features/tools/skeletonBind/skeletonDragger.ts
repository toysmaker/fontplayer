import {
  mapCanvasX,
  mapCanvasY,
  mapCanvasWidth,
  mapCanvasHeight,
} from "@/utils/canvas"
import { useGlyphStore } from "@/stores/glyph"
import { instanceManager } from "@/core/instance/InstanceManager"
import { CustomGlyph } from "@/core/instance/CustomGlyph"
import {
  draggingJoint,
  putAtCoord,
  setEditing,
  movingJoint,
  editGlyphOnDragging,
} from "@/stores/skeletonDragger"
import { releaseStoredBindRuntimeData } from "@/features/skeletonSampling"
import { setSkeletonTransformPreview } from "@/features/glyphSkeletonBind"
import { throttle } from "@/utils/performance"
import * as R from "ramda"

type GetCoord = (coord: number) => number

const distance = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
}

const getBound = (joints: Array<{ x: number; y: number }>) => {
  let x_min = Infinity
  let y_min = Infinity
  let x_max = -Infinity
  let y_max = -Infinity
  joints.forEach((joint) => {
    const { x, y } = joint
    if (x < x_min) x_min = x
    if (x > x_max) x_max = x
    if (y < y_min) y_min = y
    if (y > y_max) y_max = y
  })
  return { x: x_min, y: y_min, w: x_max - x_min, h: y_max - y_min }
}

const getJoints = () => {
  const glyphStore = useGlyphStore()
  const baseGlyph = (glyphStore as any).editingGlyph
  const glyph = editGlyphOnDragging.value || baseGlyph
  if (!glyph?.uuid) return []

  const instance = instanceManager.getInstance(
    glyph.uuid,
    () => new CustomGlyph(glyph),
    "glyph",
  ) as unknown as CustomGlyph | null

  const joints = instance?.getJoints?.()?.map((joint: any) => {
    const { x, y } = joint.getCoords()
    return { name: joint.name, x, y }
  })
  return joints || []
}

/**
 * Skeleton dragger tool initializer.
 * Designed to match original interactions.
 */
export const initSkeletonDragger = (
  canvas: HTMLCanvasElement,
  options: { getCoord: GetCoord; onRender: () => void },
) => {
  const { getCoord, onRender } = options

  let mousedown = false
  let lastX = -1
  let lastY = -1

  /**
   * 骨架拖拽节流: 每 mousemove 的 onSkeletonDrag(整段轮廓重算) + onRender(整幅重绘)
   * 是拖拽卡顿的主要来源(JS 40% / Paint 60%); 按 16ms 节流, trailing 保证最终姿态。
   * delta 为相对 mousedown 的累计位移, 节流不改变语义。
   */
  const throttledDragMove = throttle(
    (dx: number, dy: number) => {
      const glyph = editGlyphOnDragging.value
      const instance = glyph?.uuid
        ? (instanceManager.getInstance(glyph.uuid, () => new CustomGlyph(glyph), "glyph") as unknown as CustomGlyph | null)
        : null
      if (draggingJoint.value && (instance as any)?.onSkeletonDrag) {
        const t0 = import.meta.env.DEV ? performance.now() : 0
        if (import.meta.env.DEV) {
          const j = draggingJoint.value
          console.log('[dragDiag] dragMove: joint=' + j?.name + ' dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1))
        }
        ;(instance as any).onSkeletonDrag({
          draggingJoint: draggingJoint.value,
          deltaX: dx,
          deltaY: dy,
        })
        const t1 = import.meta.env.DEV ? performance.now() : 0
        onRender()
        const t2 = import.meta.env.DEV ? performance.now() : 0
        if (import.meta.env.DEV) {
          const firstJ = getJoints().find((jj: any) => !jj.name?.includes('_ref'))
          console.log(
            `[dragCost][panel] 变换 ${(t1 - t0).toFixed(2)}ms | 渲染 ${(t2 - t1).toFixed(2)}ms | 组件数 ${((glyph as any)?.components?.length) ?? '?'}`,
          )
          if (firstJ) {
            console.log('[dragDiag] after dragMove firstJoint=' + firstJ.name + '@' + firstJ.x.toFixed(1) + ',' + firstJ.y.toFixed(1))
          }
        }
      }
    },
    16,
    { leading: true, trailing: true },
  )

  const onMouseDown = (e: MouseEvent) => {
    const glyphStore = useGlyphStore()
    editGlyphOnDragging.value = R.clone((glyphStore as any).editingGlyph)

    const joints = getJoints()
    const glyph = editGlyphOnDragging.value
    if (!glyph?.uuid) return
    const instance = instanceManager.getInstance(
      glyph.uuid,
      () => new CustomGlyph(glyph),
      "glyph",
    ) as unknown as CustomGlyph | null
    if (!instance) return

    const mouseDownX = getCoord(e.offsetX)
    const mouseDownY = getCoord(e.offsetY)
    const d = 20

    if (import.meta.env.DEV) {
      console.log('[dragDiag] mousedown at (' + mouseDownX.toFixed(1) + ',' + mouseDownY.toFixed(1) + ') joints=' +
        joints.map((j: any) => j.name + '@' + j.x.toFixed(0) + ',' + j.y.toFixed(0)).join(' ') +
        ' instUuid=' + (instance as any).uuid +
        ' _jointsLen=' + ((instance as any)._joints?.length ?? -1) +
        ' marker=' + ((instance as any).__dragDiagMarker ?? 'none') +
        ' isEditing=' + instanceManager.isEditing(glyph.uuid))
    }
    for (let i = 0; i < joints.length; i++) {
      const { x, y } = joints[i]
      if (distance(x, y, mouseDownX, mouseDownY) <= d) {
        if (import.meta.env.DEV) {
          console.log('[dragDiag] hit candidate: ' + joints[i].name + ' dist=' + distance(x, y, mouseDownX, mouseDownY).toFixed(1))
        }
        draggingJoint.value = joints[i]
        // 拖拽开始: 进入预览模式 (拖拽过程中折线渲染, 松手后拟合恢复)
        setSkeletonTransformPreview(true)
        if ((instance as any).onSkeletonDragStart) {
          ;(instance as any).onSkeletonDragStart({
            draggingJoint: draggingJoint.value,
            deltaX: 0,
            deltaY: 0,
          })
        }
      }
    }
    if (import.meta.env.DEV) {
      console.log('[dragDiag] final draggingJoint=' + (draggingJoint.value?.name || 'none') +
        ' hasDragStart=' + !!((instance as any).onSkeletonDragStart))
    }

    setEditing(true)
    mousedown = true
    lastX = getCoord(e.offsetX)
    lastY = getCoord(e.offsetY)
    window.addEventListener("mouseup", onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    const dx = getCoord(e.offsetX) - lastX
    const dy = getCoord(e.offsetY) - lastY

    if (mousedown) {
      throttledDragMove(dx, dy)
    } else {
      const joints = getJoints()
      const d = 10
      let mark = false
      const mouseMoveX = getCoord(e.offsetX)
      const mouseMoveY = getCoord(e.offsetY)
      for (let i = 0; i < joints.length; i++) {
        const { x, y } = joints[i]
        if (distance(x, y, mouseMoveX, mouseMoveY) <= d) {
          movingJoint.value = joints[i]
          mark = true
        }
      }
      if (!mark) movingJoint.value = null
    }
  }

  const onMouseUp = (e: MouseEvent) => {
    // 取消挂起的 trailing 节流(其最终态由下方 onSkeletonDragEnd + onRender 补齐)
    ;(throttledDragMove as any).cancel?.()
    // 先退出预览模式, 保证随后的 onSkeletonDragEnd 执行最终拟合
    setSkeletonTransformPreview(false)
    const glyph = editGlyphOnDragging.value
    const instance =
      glyph?.uuid
        ? (instanceManager.getInstance(glyph.uuid, () => new CustomGlyph(glyph), "glyph") as unknown as CustomGlyph | null)
        : null
    const dx = getCoord(e.offsetX) - lastX
    const dy = getCoord(e.offsetY) - lastY
    if ((instance as any)?.onSkeletonDragEnd && mousedown) {
      ;(instance as any).onSkeletonDragEnd({
        draggingJoint: draggingJoint.value,
        deltaX: dx,
        deltaY: dy,
      })
    }

    // 拖拽结束释放采样绑定运行时缓存（下次拖拽惰性重建）
    const skel = (instance as any)?._glyph?.skeleton
    releaseStoredBindRuntimeData(skel?.skeletonBindData)
    releaseStoredBindRuntimeData(skel?.glyphSkeletonBindData)

    window.removeEventListener("mouseup", onMouseUp)
    setEditing(false)
    mousedown = false
    lastX = 0
    lastY = 0
    putAtCoord.value = null
    draggingJoint.value = null
    editGlyphOnDragging.value = null
    // 收尾渲染: 最终拟合结果在 onSkeletonDragEnd 中完成, 需重绘一次呈现
    onRender()
  }

  canvas.addEventListener("mousedown", onMouseDown)
  canvas.addEventListener("mousemove", onMouseMove)

  const close = () => {
    canvas.removeEventListener("mousedown", onMouseDown)
    canvas.removeEventListener("mousemove", onMouseMove)
    editGlyphOnDragging.value = null
    setEditing(false)
  }

  return close
}

export const renderSkeletonSelector = (canvas: HTMLCanvasElement) => {
  const joints = getJoints()

  const getJoint = (name: string) => {
    for (let i = 0; i < joints.length; i++) {
      if (joints[i].name === name) return joints[i]
    }
    return { x: 0, y: 0 }
  }

  const { x, y, w, h } = getBound(joints)
  const _x = mapCanvasX(x)
  const _y = mapCanvasY(y)
  const _w = mapCanvasWidth(w)
  const _h = mapCanvasHeight(h)
  void _x
  void _y
  void _w
  void _h

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // moving joint highlight
  if (movingJoint.value) {
    const _d = 10
    const { x, y } = getJoint(movingJoint.value.name)
    ctx.fillStyle = "red"
    ctx.fillRect(mapCanvasX(x) - _d, mapCanvasY(y) - _d, 2 * _d, 2 * _d)
  }

  // dragging joint highlight
  if (draggingJoint.value) {
    const _d = 10
    const { x, y } = getJoint(draggingJoint.value.name)
    ctx.fillStyle = "red"
    ctx.fillRect(mapCanvasX(x) - _d, mapCanvasY(y) - _d, 2 * _d, 2 * _d)
  }

  // put-at coord marker
  if (putAtCoord.value && putAtCoord.value.id) {
    const d = 5
    const { x, y } = putAtCoord.value
    ctx.fillStyle = "red"
    ctx.fillRect(mapCanvasX(x) - d, mapCanvasY(y) - d, 2 * d, 2 * d)
  }
}
