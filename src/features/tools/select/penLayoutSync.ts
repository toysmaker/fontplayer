import type { IComponent } from '@/core/types'
import { getBound } from '@/core/utils/math'
import { roundToPrecision } from '@/utils/number'

/**
 * 与 plan 前 PenEditPanel 关闭「编辑模式」时相同的 x,y,w,h 计算。
 * 仅在关闭编辑模式时调用；编辑过程中不要改包围盒，否则公式依赖的 w/h 语义会错。
 */
export function computePenLayoutUpdatesFromFixedBounds(
  comp: IComponent,
  fixedBounds: { x: number; y: number; w: number; h: number },
  points: Array<{ x: number; y: number }>
): Pick<IComponent, 'x' | 'y' | 'w' | 'h'> | null {
  if (!points || points.length === 0) return null

  const { x: ox, y: oy, w: ow, h: oh } = fixedBounds
  const newRaw = getBound(points.map((pt) => ({ x: pt.x, y: pt.y })))
  const { x: nx, y: ny, w: nw, h: nh } = newRaw
  const { x, y, w, h } = comp

  if (!(ow > 0 && oh > 0)) return null

  const { rotation, flipX, flipY } = comp
  const r = ((rotation || 0) * Math.PI) / 180
  const cos_r = Math.cos(r)
  const sin_r = Math.sin(r)

  const Mx = (nx + nw / 2 - ox - ow / 2) * w / ow
  const My = (ny + nh / 2 - oy - oh / 2) * h / oh

  const sx = flipX ? (2 * (nx - ox) + (nw - ow)) * w / ow : 0
  const sy = flipY ? (2 * (ny - oy) + (nh - oh)) * h / oh : 0

  const dx = (cos_r - 1) * Mx - sin_r * My - (cos_r * sx - sin_r * sy)
  const dy = sin_r * Mx + (cos_r - 1) * My - (sin_r * sx + cos_r * sy)

  return {
    x: roundToPrecision(x + ((nx - ox) * w) / ow + dx),
    y: roundToPrecision(y + ((ny - oy) * h) / oh + dy),
    w: roundToPrecision((nw * w) / ow),
    h: roundToPrecision((nh * h) / oh),
  }
}
