import { ref } from "vue"
import { pointToBoneDistance } from "@/features/glyphSkeletonBind"
import { mapCanvasX, mapCanvasY } from "@/utils/canvas"
import { useGlyphStore } from "@/stores/glyph"
import {
  selectedBone,
  brushSize,
  onWeightSetting,
  weightValue,
} from "@/stores/skeletonDragger"

type GetCoord = (coord: number) => number

const currentBone = ref<any>(null)

const setWeight = (mouseX: number, mouseY: number) => {
  const glyphStore = useGlyphStore()
  const editGlyph = (glyphStore as any).editingGlyph
  const { pointsBonesMap, originalPoints, bones: allBones } =
    editGlyph?.skeleton?.skeletonBindData || {}
  if (!pointsBonesMap) return

  for (let i = 0; i < pointsBonesMap.length; i++) {
    const { pointIndex, bones } = pointsBonesMap[i]
    const { x, y } = originalPoints[pointIndex]
    const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2)
    if (dist <= brushSize.value / 2) {
      let mark = false
      const _bone = bones.find((b: any) => b.boneIndex === selectedBone.value.index)
      const originWeight = _bone ? _bone.weight : 0
      for (let j = 0; j < bones.length; j++) {
        const { boneIndex, weight } = bones[j]
        if (boneIndex === selectedBone.value.index) {
          bones[j].weight = weightValue.value
          mark = true
        } else {
          if (_bone) {
            if (originWeight === 1) {
              bones[j].weight = 0
            } else {
              bones[j].weight = (bones[j].weight / (1 - originWeight)) * (1 - weightValue.value)
            }
          } else {
            bones[j].weight = bones[j].weight * (1 - weightValue.value)
          }
        }
      }
      if (!mark && weightValue.value > 0) {
        const { localCoords } = pointToBoneDistance(
          originalPoints[pointIndex],
          allBones[selectedBone.value.index],
        )
        bones.push({
          boneIndex: selectedBone.value.index,
          weight: weightValue.value,
          localCoords,
        })
      }
    }
  }
}

const getWeightColor = (point: any) => {
  const { weight, otherWeight } = point
  const undefinedWeight = 1 - otherWeight - weight
  const red = Math.round(weight * 255)
  const blue = Math.round(otherWeight * 255)
  const green = Math.round(undefinedWeight * 255)
  return `rgba(${red}, ${green}, ${blue}, 1)`
}

export const initWeightSelector = (
  canvas: HTMLCanvasElement,
  options: { getCoord: GetCoord; onRender: () => void },
) => {
  const { getCoord, onRender } = options
  const glyphStore = useGlyphStore()
  const { bones } = (glyphStore as any).editingGlyph?.skeleton?.skeletonBindData || { bones: [] }

  currentBone.value = null

  const onMouseDown = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    if (currentBone.value) {
      selectedBone.value = currentBone.value
      currentBone.value = null
    } else if (onWeightSetting.value && brushSize.value > 0) {
      setWeight(mouseX, mouseY)
    }
    onRender()
    renderBoneAndWeight(canvas, { mouseX, mouseY })
  }

  const onMouseMove = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    currentBone.value = null
    for (let i = 0; i < bones.length; i++) {
      const { distance } = pointToBoneDistance({ x: mouseX, y: mouseY }, bones[i])
      if (distance <= 20) {
        currentBone.value = bones[i]
        currentBone.value.index = i
      }
    }
    onRender()
    renderBoneAndWeight(canvas, { mouseX, mouseY })
  }

  const onMouseUp = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    currentBone.value = null
    onRender()
    renderBoneAndWeight(canvas, { mouseX, mouseY })
  }

  canvas.addEventListener("mouseup", onMouseUp)
  canvas.addEventListener("mousemove", onMouseMove)
  canvas.addEventListener("mousedown", onMouseDown)

  const close = () => {
    canvas.removeEventListener("mouseup", onMouseUp)
    canvas.removeEventListener("mousemove", onMouseMove)
    canvas.removeEventListener("mousedown", onMouseDown)
    currentBone.value = null
  }

  return close
}

export const renderBoneAndWeight = (
  canvas: HTMLCanvasElement,
  options?: { mouseX?: number; mouseY?: number },
) => {
  const bone = currentBone.value || selectedBone.value
  if (!bone) return

  const glyphStore = useGlyphStore()
  const { pointsBonesMap, originalPoints } =
    (glyphStore as any).editingGlyph?.skeleton?.skeletonBindData || {}
  if (!pointsBonesMap) return

  const _points: Array<any> = []
  if (selectedBone.value) {
    for (let i = 0; i < pointsBonesMap.length; i++) {
      const { pointIndex, bones } = pointsBonesMap[i]
      let _weight = 0
      let _otherWeight = 0
      for (let j = 0; j < bones.length; j++) {
        const { boneIndex, weight } = bones[j]
        if (boneIndex === bone.index) _weight = weight
        else _otherWeight += weight
      }
      if (_weight > 0) {
        _points.push({
          x: originalPoints[pointIndex].x,
          y: originalPoints[pointIndex].y,
          weight: _weight,
          otherWeight: _otherWeight,
        })
      }
    }
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // weight squares
  for (let i = 0; i < _points.length; i++) {
    const { x, y } = _points[i]
    ctx.fillStyle = getWeightColor(_points[i])
    ctx.fillRect(mapCanvasX(x), mapCanvasY(y), 10, 10)
  }

  // bone line
  const { start, end } = bone
  ctx.strokeStyle = "red"
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(mapCanvasX(start.x), mapCanvasY(start.y))
  ctx.lineTo(mapCanvasX(end.x), mapCanvasY(end.y))
  ctx.stroke()
  ctx.closePath()

  // brush circle
  if (!currentBone.value && onWeightSetting.value) {
    const { mouseX, mouseY } = options || {}
    // 没有鼠标坐标时不绘制笔刷圆，否则会在 (0,0) 出现一个被裁剪的四分之一圆
    if (mouseX === undefined || mouseY === undefined) return
    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return
    const _brushSize = mapCanvasX(brushSize.value)
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
    ctx.beginPath()
    ctx.ellipse(mapCanvasX(mouseX), mapCanvasY(mouseY), _brushSize / 2, _brushSize / 2, 0, 0, 2 * Math.PI)
    ctx.fill()
    ctx.closePath()
  }
}
