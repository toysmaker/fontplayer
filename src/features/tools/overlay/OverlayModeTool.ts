/**
 * 不接管画布指针的工具占位（度量、网格等仅用 UI 覆盖层）
 */
import { BaseTool } from '../base/BaseTool'
import type { IToolConfig, ToolType } from '../base/types'

export class OverlayModeTool extends BaseTool {
  constructor(
    canvas: HTMLCanvasElement,
    config: IToolConfig,
    private readonly toolType: ToolType,
  ) {
    super(canvas, config)
  }

  get name(): string {
    return this.toolType
  }

  async init(): Promise<void> {
    this.setRenderFunction(null)
  }

  activate(): void {
    this.isActive = true
  }

  deactivate(): void {
    this.isActive = false
  }

  cleanup(): void {
    this.deactivate()
  }
}
