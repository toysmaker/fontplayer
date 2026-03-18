import { shallowRef } from "vue"

type GetCoord = (coord: number) => number
type OnRender = () => void

const glyphEditCanvas = shallowRef<HTMLCanvasElement | null>(null)
const glyphEditGetCoord = shallowRef<GetCoord | null>(null)
const glyphEditOnRender = shallowRef<OnRender | null>(null)

export const setGlyphEditCanvasContext = (ctx: {
  canvas: HTMLCanvasElement
  getCoord: GetCoord
  onRender: OnRender
}) => {
  glyphEditCanvas.value = ctx.canvas
  glyphEditGetCoord.value = ctx.getCoord
  glyphEditOnRender.value = ctx.onRender
}

export const clearGlyphEditCanvasContext = () => {
  glyphEditCanvas.value = null
  glyphEditGetCoord.value = null
  glyphEditOnRender.value = null
}

export const getGlyphEditCanvasContext = () => {
  if (!glyphEditCanvas.value || !glyphEditGetCoord.value || !glyphEditOnRender.value) {
    return null
  }
  return {
    canvas: glyphEditCanvas.value,
    getCoord: glyphEditGetCoord.value,
    onRender: glyphEditOnRender.value,
  }
}

