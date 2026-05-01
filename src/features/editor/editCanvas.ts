import { shallowRef } from "vue"

type GetCoord = (coord: number) => number
type OnRender = () => void

const editCanvasRef = shallowRef<HTMLCanvasElement | null>(null)
const editCanvasGetCoord = shallowRef<GetCoord | null>(null)
const editCanvasOnRender = shallowRef<OnRender | null>(null)

export const setEditCanvasContext = (ctx: {
  canvas: HTMLCanvasElement
  getCoord: GetCoord
  onRender: OnRender
}) => {
  editCanvasRef.value = ctx.canvas
  editCanvasGetCoord.value = ctx.getCoord
  editCanvasOnRender.value = ctx.onRender
}

export const clearEditCanvasContext = () => {
  editCanvasRef.value = null
  editCanvasGetCoord.value = null
  editCanvasOnRender.value = null
}

export const getEditCanvasContext = () => {
  if (!editCanvasRef.value || !editCanvasGetCoord.value || !editCanvasOnRender.value) {
    return null
  }
  return {
    canvas: editCanvasRef.value,
    getCoord: editCanvasGetCoord.value,
    onRender: editCanvasOnRender.value,
  }
}
