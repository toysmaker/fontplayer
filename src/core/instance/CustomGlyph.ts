/**
 * CustomGlyph 类
 * 字形实例，提供字形操作 API
 * 
 * 注意：这个类应该只在编辑时实例化，通过 InstanceManager 管理
 */

import type { ICustomGlyph, IComponent, IParameter } from '../types'
import { ParameterType } from '../types'
import type { IInstance } from './InstanceManager'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { useProjectStore } from '@/stores/project'

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
    
    // 将实例关联到字形数据
    glyph._o = this as any
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
  ) {
    // TODO: 实现渲染逻辑
    // 需要从原代码迁移 renderCanvas 和相关函数
    console.warn('CustomGlyph.render() not implemented yet')
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
    // 清理与字形数据的关联
    if (this._glyph._o && (this._glyph._o as any)._glyph === this._glyph) {
      delete this._glyph._o
    }
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
        return glyph._o || null
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
