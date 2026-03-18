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

    for (let i = 0; i < joints.length; i++) {
      const { x, y } = joints[i]
      if (distance(x, y, mouseDownX, mouseDownY) <= d) {
        draggingJoint.value = joints[i]
        if ((instance as any).onSkeletonDragStart) {
          ;(instance as any).onSkeletonDragStart({
            draggingJoint: draggingJoint.value,
            deltaX: 0,
            deltaY: 0,
          })
        }
      }
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
    const glyph = editGlyphOnDragging.value
    const instance =
      glyph?.uuid
        ? (instanceManager.getInstance(glyph.uuid, () => new CustomGlyph(glyph), "glyph") as unknown as CustomGlyph | null)
        : null

    if (mousedown) {
      if (draggingJoint.value && (instance as any)?.onSkeletonDrag) {
        ;(instance as any).onSkeletonDrag({
          draggingJoint: draggingJoint.value,
          deltaX: dx,
          deltaY: dy,
        })
        onRender()
      }
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

    window.removeEventListener("mouseup", onMouseUp)
    setEditing(false)
    mousedown = false
    lastX = 0
    lastY = 0
    putAtCoord.value = null
    draggingJoint.value = null
    editGlyphOnDragging.value = null
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
