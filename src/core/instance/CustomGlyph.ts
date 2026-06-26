/**
 * CustomGlyph 类
 * 字形实例，提供字形操作 API
 * 
 * 注意：这个类应该只在编辑时实例化，通过 InstanceManager 管理
 */

import type { ICustomGlyph, IComponent, IParameter, IPenComponent } from '../types'
import { ParameterType } from '../types'
import type { IContour, IContours } from '../font/types'
import { PathType } from '../font/types'
import { interpolateGlyphOutline, getPreviewDisplayUUIDs } from '@/features/variableInterpolation'
import { instanceManager, type IInstance } from './InstanceManager'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { useProjectStore } from '@/stores/project'
import { getGlobalConstantsMap } from '../script/ParametersMap'
import { renderCanvas } from '../canvas/EditorCanvasRenderer'
import { fontRenderStyle } from '../script/globals'
import { computeCoords, type ILayoutTransformGrid } from '../utils/grid'
import { precisionFromParamMax, roundToPrecision } from '@/utils/number'
import { mapCanvasX, mapCanvasY } from '@/utils/canvas'

// 可变参数差值渲染前浅克隆组件，避免原地修改 reactive 数据触发 Vue deep watcher 死循环
function cloneGlyphComponentsForVarInterp(comps: any[]): any[] {
  return comps.map((c: any) => {
    if (c.type === 'pen') {
      const pv = c.value
      return {
        ...c,
        value: {
          ...pv,
          points: (pv.points || []).map((p: any) => ({ ...p })),
        },
      }
    }
    return { ...c, value: { ...c.value } }
  })
}

// TODO: 需要从原代码迁移 Component 类型
// type Component = PenComponent | PolygonComponent | EllipseComponent | RectangleComponent

export class CustomGlyph implements IInstance {
  public uuid: string
  public type: 'glyph' = 'glyph'
  public lastUsed: number = Date.now()

  public _glyph: ICustomGlyph
  private _joints: Array<any> = []
  private _reflines: Array<any> = []
  public _components: Array<any> = []
  /** 后处理轮廓缓存：组件名称 -> { contour, preview } */
  public _postProcessedContours: Map<string, { contour: IContour; preview: IContour }> = new Map()
  
  // 回调函数
  public onSkeletonDrag: Function | null = null
  public onSkeletonDragEnd: Function | null = null
  public onSkeletonDragStart: Function | null = null
  public getSkeleton: Function | null = null
  public getComponentsBySkeleton: Function | null = null
  public computeParamsByJoints: Function | null = null
  public updateParamsByJoints: Function | null = null
  public tempData: any = null

  constructor(glyph: ICustomGlyph) {
    this._glyph = glyph
    this.uuid = glyph.uuid
    
    // 确保 parameters 是数组（不使用 ParametersMap 以节省内存）
    if (glyph.parameters && !Array.isArray(glyph.parameters)) {
      // 如果 parameters 是 ParametersMap 实例，提取其 parameters 数组
      if ((glyph.parameters as any).parameters && Array.isArray((glyph.parameters as any).parameters)) {
        (glyph as any).parameters = (glyph.parameters as any).parameters
      }
    }
    
    // Do not attach instance to glyph data (no `_o`); use InstanceManager only.
  }

  /**
   * 获取所有关节
   */
  getJoints(): Array<any> {
    if (this._glyph.joints) {
      return [...this._glyph.joints, ...this._joints]
    } else {
      return this._joints
    }
  }

  /**
   * 获取非参考关节
   */
  getNonRefJoints(): Array<any> {
    if (this._glyph.joints) {
      return [
        ...this._glyph.joints.filter((joint: any) => !joint.name?.includes('ref')),
        ...this._joints.filter((joint: any) => !joint.name?.includes('ref')),
      ]
    } else {
      return this._joints.filter((joint: any) => !joint.name?.includes('ref'))
    }
  }

  /**
   * 获取参考线
   */
  getRefLines(): Array<any> {
    return this._glyph.reflines
      ? [...this._glyph.reflines, ...this._reflines]
      : [...this._reflines]
  }

  /**
   * 添加关节
   */
  addJoint(joint: any) {
    this._joints.push(joint)
  }

  /**
   * 添加组件
   */
  addComponent(component: any) {
    this._components.push(component)
  }

  /**
   * 添加参考线
   */
  addRefLine(refline: any) {
    this._reflines.push(refline)
  }

  /**
   * 清除所有临时数据
   */
  clear() {
    this._joints = []
    this._components = []
    this._reflines = []
    this._postProcessedContours.clear()
  }

  /**
   * 在 canvas 上绘制编辑空间的轮廓（使用 mapCanvas 做 1000→2000 坐标映射）
   */
  private drawEditContour(
    ctx: CanvasRenderingContext2D,
    contour: IContour,
    offset: { x: number; y: number },
    scale: number,
  ): void {
    if (!contour.length) return
    if (import.meta.env.DEV) {
      console.log('[drawEditContour] offset=(' + offset.x + ',' + offset.y + ') scale=' + scale + ' contour=' + contour.length + '段 首点=(' + contour[0].start.x.toFixed(0) + ',' + contour[0].start.y.toFixed(0) + ') 调用栈:', new Error().stack)
    }
    const cx = (px: number) => mapCanvasX(px + offset.x) * scale
    const cy = (py: number) => mapCanvasY(py + offset.y) * scale
    // 重置起点到轮廓的真实第一点，防止 ctx 上残留的 moveTo（如 ox/oy=0 时的 p0 点）污染绘制
    ctx.moveTo(cx(contour[0].start.x), cy(contour[0].start.y))
    for (const path of contour) {
      if (path.type === PathType.LINE) {
        ctx.lineTo(cx(path.end.x), cy(path.end.y))
      } else if (path.type === PathType.CUBIC_BEZIER) {
        ctx.bezierCurveTo(
          cx(path.control1.x), cy(path.control1.y),
          cx(path.control2.x), cy(path.control2.y),
          cx(path.end.x), cy(path.end.y),
        )
      } else if (path.type === PathType.QUADRATIC_BEZIER) {
        ctx.quadraticCurveTo(
          cx(path.control.x), cy(path.control.y),
          cx(path.end.x), cy(path.end.y),
        )
      }
    }
    ctx.closePath()
  }

  /**
   * 渲染字形
   */
  render(
    canvas: HTMLCanvasElement,
    renderBackground: boolean = true,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    fill: boolean = false,
    scale: number = 1,
    fillColor: string = '#000',
    needsBeginPath: boolean = false,
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (import.meta.env.DEV) {
      console.log(`[CG.render] ENTER glyph="${this._glyph.name}" fill=${fill} fontRenderStyle="${fontRenderStyle.value}" _components=${this._components.length}`)
    }
    
    // 获取 Canvas 的显示尺寸（CSS style）
    const computedStyle = window.getComputedStyle(canvas)
    const displayWidth = parseFloat(computedStyle.width) || 0
    const displayHeight = parseFloat(computedStyle.height) || 0
    
    // 渲染字形组件列表（components，即字形内部的组件，如 pen, polygon 等）
    // 浅克隆组件避免原地修改 reactive 数据触发 Vue deep watcher 死循环
    const allGlyphComponents = cloneGlyphComponentsForVarInterp(orderedListWithItemsForGlyph(this._glyph))

    // 可变参数差值：当存在可变参数时，仅渲染显示图层组件并应用差值
    let glyphComponents = allGlyphComponents
    if (this._glyph.variables && this._glyph.variables.length > 0) {
      const displayUUIDs = getPreviewDisplayUUIDs(this._glyph)
      glyphComponents = allGlyphComponents.filter((c: any) => displayUUIDs.has(c.uuid))
      if (import.meta.env.DEV) {
        const vals = this._glyph.variables.map((v: any) => v.value)
        const layerKeys = this._glyph.layers ? Object.keys(this._glyph.layers) : []
        const kfLayers = this._glyph.variables[0]?.keyframes?.map((k: any) => k.layer) || []
        console.log(`[CG.render] glyph="${this._glyph.name}" uuid=${this._glyph.uuid.slice(-8)} vars=${this._glyph.variables.length} vals=[${vals}] layerKeys=[${layerKeys}] kfLayers=[${kfLayers}] displayUUIDs=${displayUUIDs.size} allComps=${allGlyphComponents.length} filtered=${glyphComponents.length}`)
      }

      const interpolationResult = interpolateGlyphOutline(this._glyph)
      if (interpolationResult.success && interpolationResult.interpolatedComponents) {
        for (const comp of glyphComponents) {
          if (comp.type === 'pen') {
            const interp = interpolationResult.interpolatedComponents.get(comp.uuid)
            if (interp) {
              const penValue = comp.value as IPenComponent
              if (penValue.points) {
                penValue.points = interp.points.map((p, i) => ({
                  ...(Array.isArray(penValue.points) && penValue.points[i] ? penValue.points[i] : {}),
                  x: p.x,
                  y: p.y,
                }))
                comp.x = interp.x
                comp.y = interp.y
                comp.w = interp.w
                comp.h = interp.h
                comp.rotation = interp.rotation
                comp.flipX = interp.flipX
                comp.flipY = interp.flipY
              }
            }
          }
        }
      }
    }

    // ... rending happens ...

    if (import.meta.env.DEV) {
      console.log('[CustomGlyph.render] Rendering glyph:', {
        glyphUUID: this._glyph.uuid,
        glyphName: this._glyph.name,
        glyphComponentsCount: glyphComponents.length,
        _componentsCount: this._components.length,
        hasGlyphComponents: glyphComponents.length > 0,
        has_components: this._components.length > 0,
        canvasActualSize: { width: canvas.width, height: canvas.height },
        canvasDisplaySize: { width: displayWidth, height: displayHeight },
        canvasSizeRatio: {
          widthRatio: canvas.width / (displayWidth || 1),
          heightRatio: canvas.height / (displayHeight || 1)
        },
        offset: offset,
        scale: scale
      })
    }
    if (glyphComponents.length > 0) {
      renderCanvas(glyphComponents, canvas, {
        needsBeginPath: needsBeginPath,
        offset,
        scale: scale,
        fill: false,
        forceUpdate: false,
        layerTint: fillColor,
      })
    }

    // 确保清除renderCanvas可能留下的路径状态
    if (fontRenderStyle.value === 'color') {
      ctx.beginPath()
    }
    
    // 渲染脚本生成的组件（_components，即脚本生成的 glyph-pen, glyph-ellipse 等）
    // glyphSkeleton 类型不渲染脚本组件（骨架仅用于变形绑定笔组件）
    const isGlyphSkeleton = this._glyph.skeleton?.type === 'glyphSkeleton'
    if (import.meta.env.DEV) {
      console.log('[CustomGlyph.render] Rendering _components:', {
        _componentsCount: this._components.length,
        componentTypes: this._components.map((c: any) => c.type || 'unknown'),
        isGlyphSkeleton,
      })
    }
    if (!isGlyphSkeleton) {
    this._components.forEach((component: any, index: number) => {
      if (component._postProcessed && component.contour?.length) {
        if (import.meta.env.DEV) console.log('[render] drawEditContour glyph=' + this._glyph.name + ' offset=(' + offset.x + ',' + offset.y + ')')
        this.drawEditContour(ctx, component.contour as IContour, offset, scale)
      } else if (component.render) {
        component.render(canvas, {
          offset,
          scale: scale,
          fillColor: fillColor,
        })
      } else {
        if (import.meta.env.DEV) {
          console.warn(`[CustomGlyph.render] _component ${index} has no render method:`, {
            type: component.type,
            component: component
          })
        }
      }
    })
    } // !isGlyphSkeleton

    // 根据渲染样式填充
    if (fontRenderStyle.value === 'black' || fill) {
      if (import.meta.env.DEV) {
        console.log(`[CustomGlyph.render] fill("nonzero") for "${this._glyph.name}", _components: ${this._components.length}`)
        this._components.forEach((c: any, i: number) => {
          const pts = c.points || []
          if (pts.length >= 4) {
            const x1 = pts[1].x - pts[0].x, y1 = pts[1].y - pts[0].y
            const x2 = pts[2].x - pts[1].x, y2 = pts[2].y - pts[1].y
            console.log(`  [${i}] pts=${pts.length} (${pts[0].x.toFixed(0)},${pts[0].y.toFixed(0)})→(${pts[1].x.toFixed(0)},${pts[1].y.toFixed(0)})→(${pts[2].x.toFixed(0)},${pts[2].y.toFixed(0)}) ${x1*y2 - y1*x2 > 0 ? 'CW' : 'CCW'}`)
          }
        })
      }
      ctx.fillStyle = '#000'
      ctx.fill("nonzero")
      ctx.closePath()
    } else if (fontRenderStyle.value === 'color') {
      ctx.fillStyle = fillColor || '#000'
      ctx.fill("nonzero")
      ctx.closePath()
    } else {
      // 线框模式下，确保路径被清除，避免残留
      ctx.closePath()
    }
  }

  /**
   * 强制更新渲染字形
   */
  render_forceUpdate(
    canvas: HTMLCanvasElement,
    renderBackground: boolean = true,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    fill: boolean = false,
    scale: number = 1,
    fillColor: string = '#000',
    needsBeginPath: boolean = false,
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (import.meta.env.DEV) {
      console.log(`[CG.render_forceUpdate] ENTER glyph="${this._glyph.name}" fill=${fill} fontRenderStyle="${fontRenderStyle.value}" _components=${this._components.length}`)
    }
    
    // 渲染字形组件列表（强制更新）
    const allForceComps = cloneGlyphComponentsForVarInterp(orderedListWithItemsForGlyph(this._glyph))
    let forceComps = allForceComps
    if (this._glyph.variables && this._glyph.variables.length > 0) {
      const displayUUIDs = getPreviewDisplayUUIDs(this._glyph)
      forceComps = allForceComps.filter((c: any) => displayUUIDs.has(c.uuid))

      const interpolationResult = interpolateGlyphOutline(this._glyph)
      if (interpolationResult.success && interpolationResult.interpolatedComponents) {
        for (const comp of forceComps) {
          if (comp.type === 'pen') {
            const interp = interpolationResult.interpolatedComponents.get(comp.uuid)
            if (interp) {
              const penValue = comp.value as IPenComponent
              if (penValue.points) {
                penValue.points = interp.points.map((p, i) => ({
                  ...(Array.isArray(penValue.points) && penValue.points[i] ? penValue.points[i] : {}),
                  x: p.x,
                  y: p.y,
                }))
                comp.x = interp.x
                comp.y = interp.y
                comp.w = interp.w
                comp.h = interp.h
                comp.rotation = interp.rotation
                comp.flipX = interp.flipX
                comp.flipY = interp.flipY
              }
            }
          }
        }
      }
    }
    renderCanvas(forceComps, canvas, {
      needsBeginPath: needsBeginPath,
      offset,
      scale: scale,
      fill: false,
      forceUpdate: true,
      layerTint: fillColor,
    })

    // 确保清除renderCanvas可能留下的路径状态
    if (fontRenderStyle.value === 'color') {
      ctx.beginPath()
    }
    
    // 渲染脚本生成的组件（_components）
    if (this._glyph.skeleton?.type !== 'glyphSkeleton') {
    this._components.forEach((component: any) => {
      if (component._postProcessed && component.contour?.length) {
        this.drawEditContour(ctx, component.contour as IContour, offset, scale)
      } else if (component.render) {
        component.render(canvas, {
          offset,
          scale: scale,
          fillColor: fillColor,
        })
      }
    })
    }

    // 根据渲染样式填充
    if (fontRenderStyle.value === 'black' || fill) {
      ctx.fillStyle = '#000'
      ctx.fill("nonzero")
      ctx.closePath()
    } else if (fontRenderStyle.value === 'color') {
      ctx.fillStyle = fillColor || '#000'
      ctx.fill("nonzero")
      ctx.closePath()
    } else {
      // 线框模式下，确保路径被清除，避免残留
      ctx.closePath()
    }
  }

  render_grid(
    canvas: HTMLCanvasElement,
    renderBackground: boolean = true,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    fill: boolean = false,
    scale: number = 1,
    grid: ILayoutTransformGrid,
    useSkeletonGrid: boolean = false,
    fillColor: string = '#000',
    needsBeginPath: boolean = false,
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const allGridComps = cloneGlyphComponentsForVarInterp(orderedListWithItemsForGlyph(this._glyph))
    let gridComps = allGridComps
    if (this._glyph.variables && this._glyph.variables.length > 0) {
      const displayUUIDs = getPreviewDisplayUUIDs(this._glyph)
      gridComps = allGridComps.filter((c: any) => displayUUIDs.has(c.uuid))
      const interpRes = interpolateGlyphOutline(this._glyph)
      if (interpRes.success && interpRes.interpolatedComponents) {
        for (const comp of gridComps) {
          if (comp.type === 'pen') {
            const interp = interpRes.interpolatedComponents.get(comp.uuid)
            if (interp) {
              const penValue = comp.value as IPenComponent
              if (penValue.points) {
                penValue.points = interp.points.map((p, i) => ({
                  ...(penValue.points[i] || {}),
                  x: p.x,
                  y: p.y,
                }))
                comp.x = interp.x; comp.y = interp.y; comp.w = interp.w; comp.h = interp.h
                comp.rotation = interp.rotation; comp.flipX = interp.flipX; comp.flipY = interp.flipY
              }
            }
          }
        }
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[CG.render_grid] "${this._glyph.name}" gridComps=${gridComps.length} types=[${gridComps.map(c => c.type).join(',')}] useSkeletonGrid=${useSkeletonGrid}`)
    }
    renderCanvas(gridComps, canvas, {
      needsBeginPath: needsBeginPath,
      offset,
      scale,
      fill: false,
      forceUpdate: false,
      grid,
      useSkeletonGrid,
      skipPrimitivesForSkeletonPreview: useSkeletonGrid,
    })

    if (!useSkeletonGrid) {
      // glyphSkeleton 类型跳过脚本组件渲染（骨架仅用于变形绑定笔组件）
      if (this._glyph.skeleton?.type !== 'glyphSkeleton') {
      if (fontRenderStyle.value === 'black' || fontRenderStyle.value === 'color' || fill) {
        // Start fresh path after renderCanvas, then use component.render()
        // (same as script/CustomGlyph) to avoid grid coord transforms breaking non-zero winding.
        // component.render() does NOT call beginPath internally, so all sub-paths accumulate naturally.
        if (fontRenderStyle.value === 'color') {
          ctx.beginPath()
        }
        const fillColorForComps = fontRenderStyle.value === 'black' ? '#000' : (fillColor || '#000')
        this._components.forEach((component: any) => {
          if (component._postProcessed && component.contour?.length) {
            this.drawEditContour(ctx, component.contour as IContour, offset, scale)
          } else if (component.render) {
            component.render(canvas, { offset, scale, fillColor: fillColorForComps })
          }
        })
      } else {
        this._components.forEach((component: any) => {
          if (component._postProcessed && component.contour?.length) {
            this.drawEditContour(ctx, component.contour as IContour, offset, scale)
          } else if (component.render_grid) {
            component.render_grid(canvas, { offset, scale, grid })
          }
        })
      }
      } // !glyphSkeleton
    } else if (this.getSkeleton && this.getComponentsBySkeleton) {
			if (fontRenderStyle.value === 'color') {
				ctx.beginPath()
			}
      const _skeleton = this.getSkeleton()
      const skeleton: Record<string, { x: number; y: number }> = {}
      const keys = Object.keys(_skeleton)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const _joint = _skeleton[key]
        const jx = typeof _joint.x === 'function' ? _joint.x() : _joint.x
        const jy = typeof _joint.y === 'function' ? _joint.y() : _joint.y
        const joint = { x: jx + offset.x, y: jy + offset.y }
        skeleton[key] = computeCoords(grid, joint)
      }
      const components = this.getComponentsBySkeleton(skeleton)
      for (let i = 0; i < components.length; i++) {
        components[i].render(canvas, { offset: { x: 0, y: 0 }, scale })
      }
    }

    if (fontRenderStyle.value === 'black' || fill) {
      if (import.meta.env.DEV) {
        console.log(`[CG.render_grid] fill("nonzero") for "${this._glyph.name}", _components=${this._components.length}`)
        this._components.forEach((c: any, i: number) => {
          const pts = c.points || []
          if (pts.length >= 4) {
            const x1 = pts[1].x - pts[0].x, y1 = pts[1].y - pts[0].y
            const x2 = pts[2].x - pts[1].x, y2 = pts[2].y - pts[1].y
            console.log(`  [${i}] pts=${pts.length} (${pts[0].x.toFixed(0)},${pts[0].y.toFixed(0)})→(${pts[1].x.toFixed(0)},${pts[1].y.toFixed(0)})→(${pts[2].x.toFixed(0)},${pts[2].y.toFixed(0)}) ${x1*y2 - y1*x2 > 0 ? 'CW' : 'CCW'}`)
          } else {
            console.log(`  [${i}] type=${c.type || c.constructor?.name} pts=${pts.length}`)
          }
        })
      }
      //ctx.fillStyle = '#000'
      //ctx.fill('nonzero')
      //ctx.closePath()
    } else if (fontRenderStyle.value === 'color') {
      ctx.fillStyle = fillColor || '#000'
      ctx.fill('nonzero')
      ctx.closePath()
    } else {
      ctx.closePath()
    }
  }

  render_grid_forceUpdate(
    canvas: HTMLCanvasElement,
    renderBackground: boolean = true,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    fill: boolean = false,
    scale: number = 1,
    grid: ILayoutTransformGrid,
    useSkeletonGrid: boolean = false,
    fillColor: string = '#000',
    needsBeginPath: boolean = false,
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
      needsBeginPath: needsBeginPath,
      offset,
      scale,
      fill: false,
      forceUpdate: true,
      grid,
      useSkeletonGrid,
      skipPrimitivesForSkeletonPreview: useSkeletonGrid,
    })

    if (!useSkeletonGrid) {
      // glyphSkeleton 类型跳过脚本组件渲染
      if (this._glyph.skeleton?.type !== 'glyphSkeleton') {
      if (fontRenderStyle.value === 'black' || fontRenderStyle.value === 'color' || fill) {
        if (fontRenderStyle.value === 'color') {
          ctx.beginPath()
        }
        this._components.forEach((component: any) => {
          if (component._postProcessed && component.contour?.length) {
            this.drawEditContour(ctx, component.contour as IContour, offset, scale)
          } else if (component.render_grid) {
            component.render_grid(canvas, { offset, scale, grid })
          }
        })
      } else {
        this._components.forEach((component: any) => {
          if (component._postProcessed && component.contour?.length) {
            this.drawEditContour(ctx, component.contour as IContour, offset, scale)
          } else if (component.render_grid) {
            component.render_grid(canvas, { offset, scale, grid })
          }
        })
      }
      } // !glyphSkeleton
    } else if (this.getSkeleton && this.getComponentsBySkeleton) {
      if (fontRenderStyle.value === 'color') {
        ctx.beginPath()
      }
      const _skeleton = this.getSkeleton()
      const skeleton: Record<string, { x: number; y: number }> = {}
      const keys = Object.keys(_skeleton)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const _joint = _skeleton[key]
        const jx = typeof _joint.x === 'function' ? _joint.x() : _joint.x
        const jy = typeof _joint.y === 'function' ? _joint.y() : _joint.y
        const joint = { x: jx + offset.x, y: jy + offset.y }
        skeleton[key] = computeCoords(grid, joint)
      }
      const components = this.getComponentsBySkeleton(skeleton)
      for (let i = 0; i < components.length; i++) {
        components[i].render(canvas, { offset: { x: 0, y: 0 }, scale })
      }
    }

    if (fontRenderStyle.value === 'black' || fill) {
      ctx.fillStyle = '#000'
      ctx.fill('nonzero')
      ctx.closePath()
    } else if (fontRenderStyle.value === 'color') {
      ctx.fillStyle = fillColor || '#000'
      ctx.fill('nonzero')
      ctx.closePath()
    } else {
      ctx.closePath()
    }
  }

  /**
   * 设置数据
   */
  setData(data: any) {
    // TODO: 实现数据设置逻辑
    // 需要从原代码迁移 setData 方法
    console.warn('CustomGlyph.setData() not implemented yet')
  }

  /**
   * 获取数据
   */
  getData(): any {
    // TODO: 实现数据获取逻辑
    // 需要从原代码迁移 getData 方法
    return {
      glyph: this._glyph,
      joints: this._joints,
      reflines: this._reflines,
      components: this._components,
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理临时数据
    this.clear()
    // 清理回调
    this.onSkeletonDrag = null
    this.onSkeletonDragEnd = null
    this.onSkeletonDragStart = null
    this.getSkeleton = null
    this.getComponentsBySkeleton = null
    this.computeParamsByJoints = null
    this.updateParamsByJoints = null
    this.tempData = null
  }

  /**
   * 获取字形数据
   */
  getGlyph(): ICustomGlyph {
    return this._glyph
  }

  /**
   * 获取组件列表（包括 orderedList 中的组件和脚本生成的组件）
   */
  get components(): Array<any> {
    try {
      return orderedListWithItemsForGlyph(this._glyph).concat(this._components || [])
    } catch (e) {
      // 如果出错，返回 _components
      console.error('Error getting components:', e)
      return this._components || []
    }
  }

  /**
   * 获取参数值（使用数组，不使用 ParametersMap）
   */
  getParam(name: string): any {
    if (!this._glyph.parameters || !Array.isArray(this._glyph.parameters)) {
      if (import.meta.env.DEV) {
        console.warn(`[CustomGlyph.getParam] No parameters array for glyph ${this._glyph.uuid}, name: ${name}`)
      }
      return undefined
    }
    
    const param = this._glyph.parameters.find((p: IParameter) => p.name === name)
    if (!param) {
      return undefined
    }
    
    // 处理不同类型的参数
    return this.getParameterValue(param)
  }

  /**
   * 获取参数的实际值（处理 Constant 类型等）
   */
  private getParameterValue(param: IParameter): any {
    // Number 或 RingController 类型，直接返回 value
    if (param.type === ParameterType.Number || param.type === ParameterType.RingController) {
      return param.value
    }

    // 高级编辑预览：字形参数已改为 AdvancedEditConstant，须走 setGlobalConstantsMap 注入的面板常量
    if (param.type === ParameterType.AdvancedEditConstant) {
      const uuidValue = String(param.value)
      const globalCm = getGlobalConstantsMap()
      if (globalCm && typeof globalCm.getByUUID === 'function' && uuidValue) {
        const resolved = globalCm.getByUUID(uuidValue)
        if (resolved !== undefined) return resolved
      }
      const projectStore = useProjectStore()
      const cm = projectStore.constantsMap
      if (cm && typeof cm.getByUUID === 'function' && uuidValue) {
        const resolved = cm.getByUUID(uuidValue)
        if (resolved !== undefined) return resolved
      }
      return param.value
    }
    
    // Constant 类型：与 ScriptExecutor 一致，先 getGlobalConstantsMap（字形编辑草稿 / 高级编辑注入），再 projectStore
    if (param.type === ParameterType.Constant) {
      const uuidValue = String(param.value)
      if (!uuidValue || uuidValue === '0' || uuidValue === '') {
        if (import.meta.env.DEV) {
          console.warn(`[CustomGlyph.getParam] ${param.name} (Constant): Invalid UUID value:`, param.value, 'returning as-is')
        }
        return param.value
      }
      const globalCm = getGlobalConstantsMap()
      if (globalCm && typeof globalCm.getByUUID === 'function') {
        const resolved = globalCm.getByUUID(uuidValue)
        if (resolved !== undefined) return resolved
      }
      const projectStore = useProjectStore()
      const constantsMap = projectStore.constantsMap
      if (constantsMap && typeof constantsMap.getByUUID === 'function') {
        const resolvedValue = constantsMap.getByUUID(uuidValue)
        if (resolvedValue !== undefined) {
          return resolvedValue
        }
        if (import.meta.env.DEV) {
          console.warn(`[CustomGlyph.getParam] ${param.name}: constantsMap.getByUUID('${uuidValue}') returned undefined, returning UUID`)
        }
        return param.value
      }
      if (import.meta.env.DEV) {
        console.warn(`[CustomGlyph.getParam] ${param.name} (Constant): constantsMap not available, returning UUID:`, param.value)
      }
      return param.value
    }
    
    // 如果 value 看起来像 UUID（但不是 Constant 类型），也尝试解析
    // 注意：排除数字 0，因为 0 可能是有效的参数值
    if (typeof param.value === 'string' && 
        param.value.length > 20 && 
        param.value.includes('-') &&
        /^[a-zA-Z0-9_-]+$/.test(param.value) &&
        param.value !== '0') {
      const globalCm = getGlobalConstantsMap()
      if (globalCm && typeof globalCm.getByUUID === 'function') {
        const resolved = globalCm.getByUUID(param.value)
        if (resolved !== undefined) {
          if (import.meta.env.DEV) {
            console.log(`[CustomGlyph.getParam] ${param.name} (UUID-like, global):`, {
              uuid: param.value,
              resolvedValue: resolved,
              paramType: param.type
            })
          }
          return resolved
        }
      }
      const projectStore = useProjectStore()
      const constantsMap = projectStore.constantsMap
      if (constantsMap && typeof constantsMap.getByUUID === 'function') {
        const resolvedValue = constantsMap.getByUUID(param.value)
        if (resolvedValue !== undefined) {
          if (import.meta.env.DEV) {
            console.log(`[CustomGlyph.getParam] ${param.name} (UUID-like):`, {
              uuid: param.value,
              resolvedValue: resolvedValue,
              type: typeof resolvedValue,
              paramType: param.type
            })
          }
          return resolvedValue
        }
      }
    }
    
    // Enum 或其他类型，直接返回 value
    return param.value
  }

  /**
   * 获取参数范围（使用数组）
   */
  getParamRange(name: string): any {
    if (!this._glyph.parameters || !Array.isArray(this._glyph.parameters)) {
      return undefined
    }
    
    const param = this._glyph.parameters.find((p: IParameter) => p.name === name)
    if (!param) {
      return undefined
    }
    
    return {
      min: param.min || 0,
      max: param.max === 0 ? 0 : param.max || 1000,
    }
  }

  /**
   * 设置参数值（使用数组）
   */
  setParam(name: string, value: number): void {
    if (!this._glyph.parameters || !Array.isArray(this._glyph.parameters)) {
      return
    }
    
    const param = this._glyph.parameters.find((p: IParameter) => p.name === name)
    if (param) {
      let next: number
      if (param.min !== undefined && value < param.min) {
        next = param.min as number
      } else if (param.max !== undefined && value > param.max) {
        next = param.max as number
      } else {
        next = value
      }
      param.value = roundToPrecision(next, precisionFromParamMax(param.max))
      if (param.type === ParameterType.Constant) {
        param.type = ParameterType.Number
      }
    }
  }

  /**
   * 获取比例布局（占位符实现）
   */
  getRatioLayout(value: string): number {
    // TODO: 实现 getRatioLayout 函数
    // 简化版本：返回 0
    console.warn('getRatioLayout not fully implemented')
    return 0
  }

  /**
   * 获取组件（通过名称）
   */
  getComponent(name: string): any {
    if (!this._glyph.components) return null
    for (let i = 0; i < this._glyph.components.length; i++) {
      if (this._glyph.components[i].name === name) {
        return this._glyph.components[i]
      }
    }
    return null
  }

  /**
   * 获取字形（通过名称）
   */
  getGlyphByName(name: string): any {
    if (!this._glyph.components) return null
    for (let i = 0; i < this._glyph.components.length; i++) {
      if (this._glyph.components[i].name === name && this._glyph.components[i].type === 'glyph') {
        const glyph = this._glyph.components[i].value as ICustomGlyph
        // 从 InstanceManager 获取实例
        return instanceManager.getOrCreateGlyphInstance(glyph, () => new CustomGlyph(glyph)) as any
      }
    }
    return null
  }

  /**
   * 获取关节（通过名称）
   */
  getJoint(name: string): any {
    const joints = this.getJoints()
    const arr = joints.filter((joint: any) => joint.name === name)
    return arr.length ? arr[0] : null
  }
}
