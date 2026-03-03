/**
 * 脚本执行器
 * 负责执行字形脚本中的骨架拖拽回调
 */

import type { ICustomGlyph } from '@/core/types'
import type { IDragEvent, IJoint } from './types'

export class ScriptExecutor {
  /**
   * 执行拖拽开始回调
   */
  static executeDragStart(
    glyph: ICustomGlyph,
    joint: IJoint
  ): void {
    if (glyph._o?.onSkeletonDragStart) {
      try {
        glyph._o.onSkeletonDragStart({
          draggingJoint: joint,
          deltaX: 0,
          deltaY: 0
        })
      } catch (error) {
        console.error('Error in onSkeletonDragStart:', error)
      }
    }
  }

  /**
   * 执行拖拽中回调
   */
  static executeDrag(
    glyph: ICustomGlyph,
    event: IDragEvent
  ): void {
    if (glyph._o?.onSkeletonDrag) {
      try {
        glyph._o.onSkeletonDrag(event)
      } catch (error) {
        console.error('Error in onSkeletonDrag:', error)
      }
    }
  }

  /**
   * 执行拖拽结束回调
   */
  static executeDragEnd(
    glyph: ICustomGlyph,
    event: IDragEvent
  ): void {
    if (glyph._o?.onSkeletonDragEnd) {
      try {
        glyph._o.onSkeletonDragEnd(event)
      } catch (error) {
        console.error('Error in onSkeletonDragEnd:', error)
      }
    }
  }
}
