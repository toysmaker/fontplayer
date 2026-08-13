/**
 * 轮廓编辑覆盖层
 * 在 'params' 工具下激活 PenSelectTool 的钢笔编辑逻辑，
 * 用于骨架绑定的轮廓自由编辑模式。
 */

import { PenSelectTool } from '@/features/tools/select/PenSelectTool'
import type { IToolConfig } from '@/features/tools/base/types'

let activeOverlayCanvas: HTMLCanvasElement | null = null
let isActive = false

/**
 * 初始化轮廓编辑覆盖层
 * 复用 PenSelectTool 的钢笔编辑逻辑，不与 ToolManager 当前工具冲突
 *
 * @returns close 函数，调用后解除覆盖层
 */
export function initContourEditOverlay(
  canvas: HTMLCanvasElement,
  config: IToolConfig,
): () => void {
  if (isActive) {
    // 已激活则先关闭
    deactivateOverlay()
  }

  try {
    const tool = PenSelectTool.getInstance(canvas, config)
    const skCtx = PenSelectTool.skeletonFreeEditContext
    if (import.meta.env.DEV) {
      console.log('[SampledBind] initContourEditOverlay: mode=' + config.mode +
        ' hasSkeletonCtx=' + !!skCtx +
        ' penUUID=' + (skCtx?.penUUID || 'none') +
        ' penPoints=' + (skCtx?.penComponent?.points?.length || 0) +
        ' editMode=' + (skCtx?.penComponent?.editMode))
    }
    tool.resetInitialBounds()
    tool.activate()
    if (import.meta.env.DEV) {
      console.log('[SampledBind] initContourEditOverlay: activated, toolActive=' + tool.isToolActive())
    }

    activeOverlayCanvas = canvas
    isActive = true
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('[SampledBind] initContourEditOverlay FAILED:', e)
    }
  }

  return () => {
    deactivateOverlay()
  }
}

function deactivateOverlay(): void {
  if (activeOverlayCanvas) {
    try {
      const tool = PenSelectTool.getInstance(activeOverlayCanvas, {} as IToolConfig)
      if (!tool.isDragging()) {
        tool.deactivate()
      }
    } catch (_e) {
      // 忽略清理错误
    }
  }
  activeOverlayCanvas = null
  isActive = false
}

/**
 * 渲染轮廓编辑覆盖层
 * 幂等：无激活覆盖层时 no-op
 */
let renderCallCount = 0
export function renderContourEditOverlay(canvas: HTMLCanvasElement): void {
  if (!isActive || canvas !== activeOverlayCanvas) return

  if (import.meta.env.DEV && renderCallCount === 0) {
    console.log('[SampledBind] renderContourEditOverlay: first render, isActive=' + isActive)
  }
  renderCallCount++

  try {
    const tool = PenSelectTool.getInstance(canvas, {} as IToolConfig)
    if (typeof (tool as any).render === 'function') {
      ;(tool as any).render(canvas)
    }
  } catch (e) {
    if (import.meta.env.DEV && renderCallCount <= 3) {
      console.error('[SampledBind] renderContourEditOverlay error:', e)
    }
  }
}

/**
 * 检查是否有激活的轮廓编辑覆盖层
 */
export function isContourEditActive(): boolean {
  return isActive
}

/**
 * 强制清理覆盖层（不检查拖拽状态）
 */
export function forceCleanupOverlay(): void {
  activeOverlayCanvas = null
  isActive = false
}
