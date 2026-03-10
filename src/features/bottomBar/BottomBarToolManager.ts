/**
 * BottomBar 工具管理器
 * 使用单例模式管理 BottomBar 功能状态（coordsViewer, zoom, translate等）
 * 与 toolbar 工具系统分离，可以同时存在
 */

import { useToolStore } from '@/stores/tool'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'

export type BottomBarTool = 'coordsViewer' | 'translate' | null

/**
 * BottomBar 工具管理器
 * 使用单例模式，确保全局只有一个实例
 */
export class BottomBarToolManager {
  private static instance: BottomBarToolManager | null = null

  // 当前激活的 BottomBar 工具
  private currentTool: BottomBarTool = null

  // CoordsViewer 相关
  private coordsViewerCanvas: HTMLCanvasElement | null = null
  private coordsViewerMouseMoveHandler: ((e: MouseEvent) => void) | null = null
  private isGlyphMode: boolean = false

  /**
   * 获取单例实例
   */
  static getInstance(): BottomBarToolManager {
    if (!BottomBarToolManager.instance) {
      BottomBarToolManager.instance = new BottomBarToolManager()
    }
    return BottomBarToolManager.instance
  }

  /**
   * 私有构造函数，防止外部实例化
   */
  private constructor() {
    // 单例模式，不允许外部实例化
  }

  /**
   * 获取当前激活的工具
   */
  getCurrentTool(): BottomBarTool {
    return this.currentTool
  }

  /**
   * 激活坐标查看工具
   * @param canvas Canvas 元素
   * @param isGlyph 是否为字形编辑模式
   */
  activateCoordsViewer(canvas: HTMLCanvasElement, isGlyph: boolean = false): void {
    // 如果已经激活，先停用
    if (this.currentTool === 'coordsViewer') {
      this.deactivateCoordsViewer()
    }

    // 停用其他工具
    if (this.currentTool !== null && this.currentTool !== 'coordsViewer') {
      this.deactivateCurrentTool()
    }

    this.coordsViewerCanvas = canvas
    this.isGlyphMode = isGlyph
    this.currentTool = 'coordsViewer'

    const toolStore = useToolStore()
    const projectStore = useProjectStore()

    // 创建鼠标移动事件处理函数
    this.coordsViewerMouseMoveHandler = (e: MouseEvent) => {
      if (!this.coordsViewerCanvas) return

      // 获取当前 zoom 值
      const editorStore = useEditorStore()
      const characterStore = useCharacterStore()
      const glyphStore = useGlyphStore()
      
      let currentZoom = 100
      if (isGlyph) {
        const editingGlyph = glyphStore.editingGlyph
        if (editingGlyph?.view?.zoom) {
          currentZoom = editingGlyph.view.zoom
        }
      } else {
        const editingCharacter = characterStore.editingCharacter
        if (editingCharacter?.view?.zoom) {
          currentZoom = editingCharacter.view.zoom
        }
      }

      // 使用固定的显示尺寸（500），与原版一致
      // 这样无论 zoom 如何变化，坐标都在 0-unitsPerEm 之间
      const baseDisplayWidth = 500
      const baseDisplayHeight = 500

      // 将 offsetX/offsetY 归一化到固定显示尺寸（500）
      // 当 zoom 改变时，canvas 显示尺寸 = 500 * zoom / 100
      // 所以需要将 offsetX 归一化：normalizedOffsetX = offsetX * 100 / zoom
      const normalizedOffsetX = (e.offsetX * 100) / currentZoom
      const normalizedOffsetY = (e.offsetY * 100) / currentZoom

      let unitsPerEm: number
      if (isGlyph) {
        // 字形编辑模式，固定使用 1000
        unitsPerEm = 1000
      } else {
        // 字符编辑模式，使用工程文件的 unitsPerEm
        const selectedFile = projectStore.selectedFile
        if (!selectedFile) return
        unitsPerEm = selectedFile.fontSettings?.unitsPerEm || 1000
      }

      // 计算坐标（基于固定显示尺寸，与原版一致）
      // 坐标取整
      const coordX = Math.round((normalizedOffsetX / baseDisplayWidth) * unitsPerEm)
      const coordY = Math.round((normalizedOffsetY / baseDisplayHeight) * unitsPerEm)

      // 更新坐标文本（保持与原版兼容，使用 toolStore）
      toolStore.setCoordsText(`${coordX}, ${coordY}`)
    }

    // 添加事件监听器
    canvas.addEventListener('mousemove', this.coordsViewerMouseMoveHandler)
  }

  /**
   * 停用坐标查看工具
   */
  deactivateCoordsViewer(): void {
    if (this.coordsViewerCanvas && this.coordsViewerMouseMoveHandler) {
      this.coordsViewerCanvas.removeEventListener('mousemove', this.coordsViewerMouseMoveHandler)
    }

    this.coordsViewerCanvas = null
    this.coordsViewerMouseMoveHandler = null

    if (this.currentTool === 'coordsViewer') {
      this.currentTool = null
    }
  }

  /**
   * 停用当前工具
   */
  private deactivateCurrentTool(): void {
    switch (this.currentTool) {
      case 'coordsViewer':
        this.deactivateCoordsViewer()
        break
      // translate 相关功能暂时注释
      // case 'translate':
      //   this.deactivateTranslate()
      //   break
      default:
        break
    }
  }

  /**
   * 设置当前工具（内部方法）
   */
  private setCurrentTool(tool: BottomBarTool): void {
    // 如果切换工具，先停用当前工具
    if (this.currentTool !== null && this.currentTool !== tool) {
      this.deactivateCurrentTool()
    }
    this.currentTool = tool
  }

  /**
   * 清理所有资源（在组件卸载时调用）
   */
  cleanup(): void {
    this.deactivateCurrentTool()
    this.currentTool = null
  }
}

// 导出单例
export const bottomBarToolManager = BottomBarToolManager.getInstance()
