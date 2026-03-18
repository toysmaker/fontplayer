/**
 * CustomGlyph 类
 * 字形实例，提供字形操作 API
 * 
 * 注意：这个类应该只在编辑时实例化，通过 InstanceManager 管理
 */

import type { ICustomGlyph, IComponent, IParameter } from '../types'
import { ParameterType } from '../types'
import { instanceManager, type IInstance } from './InstanceManager'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { useProjectStore } from '@/stores/project'
import { renderCanvas } from '../canvas/EditorCanvasRenderer'
import { fontRenderStyle } from '../script/globals'

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
    fillColor: string = '#000'
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 获取 Canvas 的显示尺寸（CSS style）
    const computedStyle = window.getComputedStyle(canvas)
    const displayWidth = parseFloat(computedStyle.width) || 0
    const displayHeight = parseFloat(computedStyle.height) || 0
    
    // 渲染字形组件列表（components，即字形内部的组件，如 pen, polygon 等）
    const glyphComponents = orderedListWithItemsForGlyph(this._glyph)
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
        offset,
        scale: scale,
        fill: false,
        forceUpdate: false,
      })
    }
    
    // 确保清除renderCanvas可能留下的路径状态
    ctx.beginPath()
    
    // 渲染脚本生成的组件（_components，即脚本生成的 glyph-pen, glyph-ellipse 等）
    if (import.meta.env.DEV) {
      console.log('[CustomGlyph.render] Rendering _components:', {
        _componentsCount: this._components.length,
        componentTypes: this._components.map((c: any) => c.type || 'unknown')
      })
    }
    this._components.forEach((component: any, index: number) => {
      if (component.render) {
        if (import.meta.env.DEV) {
          // 获取点的坐标范围（用于调试）
          const points = component.points || []
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
          if (points.length > 0) {
            points.forEach((p: any) => {
              if (p.x !== undefined) {
                minX = Math.min(minX, p.x)
                maxX = Math.max(maxX, p.x)
              }
              if (p.y !== undefined) {
                minY = Math.min(minY, p.y)
                maxY = Math.max(maxY, p.y)
              }
            })
          }
          console.log(`[CustomGlyph.render] Rendering _component ${index}:`, {
            type: component.type,
            pointsCount: points.length,
            hasRender: !!component.render,
            pointBounds: points.length > 0 ? { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY } : null,
            firstPoint: points[0] ? { x: points[0].x, y: points[0].y } : null,
            lastPoint: points[points.length - 1] ? { x: points[points.length - 1].x, y: points[points.length - 1].y } : null,
            renderOptions: { offset, scale, fillColor }
          })
        }
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

  /**
   * 强制更新渲染字形
   */
  render_forceUpdate(
    canvas: HTMLCanvasElement,
    renderBackground: boolean = true,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    fill: boolean = false,
    scale: number = 1,
    fillColor: string = '#000'
  ): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 渲染字形组件列表（强制更新）
    renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
      offset,
      scale: scale,
      fill: false,
      forceUpdate: true,
    })
    
    // 确保清除renderCanvas可能留下的路径状态
    ctx.beginPath()
    
    // 渲染脚本生成的组件（_components）
    this._components.forEach((component: any) => {
      if (component.render) {
        component.render(canvas, {
          offset,
          scale: scale,
          fillColor: fillColor,
        })
      }
    })
    
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
      if (import.meta.env.DEV && (name === '水平延伸' || name === '竖直延伸' || name === '字重')) {
        console.warn(`[CustomGlyph.getParam] Parameter '${name}' not found for glyph ${this._glyph.uuid}. Available params:`, 
          this._glyph.parameters.map((p: IParameter) => p.name))
      }
      return undefined
    }
    
    // 调试：打印参数完整信息（特别是水平延伸和竖直延伸）
    if (import.meta.env.DEV && (name === '水平延伸' || name === '竖直延伸' || name === '字重' || name === '起笔风格')) {
      console.log(`[CustomGlyph.getParam] ${this._glyph.uuid} - Parameter '${name}':`, {
        uuid: param.uuid,
        name: param.name,
        type: param.type,
        value: param.value,
        valueType: typeof param.value,
        glyphUUID: this._glyph.uuid,
        glyphName: this._glyph.name,
      })
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
    
    // Constant 类型，需要从 constantsMap 解析
    if (param.type === ParameterType.Constant) {
      const projectStore = useProjectStore()
      const constantsMap = projectStore.constantsMap
      if (constantsMap && typeof constantsMap.getByUUID === 'function') {
        // 确保 value 是字符串类型
        const uuidValue = String(param.value)
        if (!uuidValue || uuidValue === '0' || uuidValue === '') {
          if (import.meta.env.DEV) {
            console.warn(`[CustomGlyph.getParam] ${param.name} (Constant): Invalid UUID value:`, param.value, 'returning as-is')
          }
          return param.value
        }
        
        const resolvedValue = constantsMap.getByUUID(uuidValue)
        if (resolvedValue !== undefined) {
          if (import.meta.env.DEV) {
            console.log(`[CustomGlyph.getParam] ${param.name} (Constant):`, {
              uuid: uuidValue,
              resolvedValue: resolvedValue,
              type: typeof resolvedValue
            })
          }
          return resolvedValue
        } else {
          if (import.meta.env.DEV) {
            console.warn(`[CustomGlyph.getParam] ${param.name}: constantsMap.getByUUID('${uuidValue}') returned undefined, returning UUID`)
          }
          return param.value
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn(`[CustomGlyph.getParam] ${param.name} (Constant): constantsMap not available, returning UUID:`, param.value)
        }
        return param.value
      }
    }
    
    // 如果 value 看起来像 UUID（但不是 Constant 类型），也尝试解析
    // 注意：排除数字 0，因为 0 可能是有效的参数值
    if (typeof param.value === 'string' && 
        param.value.length > 20 && 
        param.value.includes('-') &&
        /^[a-zA-Z0-9_-]+$/.test(param.value) &&
        param.value !== '0') {
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
      // 限制值在 min/max 范围内
      if (param.min !== undefined && value < param.min) {
        param.value = param.min
      } else if (param.max !== undefined && value > param.max) {
        param.value = param.max
      } else {
        param.value = value
      }
      // 如果原来是 Constant 类型，设置为 Number 类型
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
