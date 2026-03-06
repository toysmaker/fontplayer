/**
 * 绘制透明背景
 */

import { mapCanvasWidth } from '@/utils/canvas'
import { useEditorStore } from '@/stores/editor'

/**
 * 绘制透明背景（棋盘格）
 * @param canvas 画布
 */
export function transparent(canvas: HTMLCanvasElement): void {
  const editorStore = useEditorStore()
  // TODO: 从 store 获取 grid 配置
  const precision = 20 // 默认精度
  
  const width = canvas.width
  const height = canvas.height
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d') as CanvasRenderingContext2D
  const d = mapCanvasWidth(precision)
  
  for (let i = 0; i < width; i += 2 * d) {
    for (let j = 0; j < height; j += 2 * d) {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(i, j, d, d)
      ctx.fillRect(i + d, j + d, d, d)
      ctx.fillStyle = '#EFEFEF'
      ctx.fillRect(i + d, j, d, d)
      ctx.fillRect(i, j + d, d, d)
    }
  }
}
