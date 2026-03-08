/**
 * 关键点管理器
 * 负责关键点的查找和管理
 */

import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import type { IJoint } from './types'
import type { IComponent, IGlyphComponent } from '@/core/types'

export class JointManager {
  /**
   * 获取组件的所有关键点
   * 使用实例管理器获取字形实例，然后获取关键点
   * @param rootComponent 根组件
   * @param componentUUID 组件的 UUID，用作 instanceKey
   * @param ox 组件的 x 偏移量（可选，如果不提供则从 component 中读取）
   * @param oy 组件的 y 偏移量（可选，如果不提供则从 component 中读取）
   */
  static getJoints(
    rootComponent: IComponent | IGlyphComponent,
    componentUUID: string,
    ox?: number,
    oy?: number
  ): IJoint[] {
    // 如果组件不是字形组件，返回空数组
    if (rootComponent.type !== 'glyph') {
      return []
    }
    
    const glyphComp = rootComponent as IGlyphComponent
    const glyphValue = glyphComp.value as any
    
    if (!glyphValue) {
      return []
    }
    
    // 使用 componentUUID 作为 instanceKey，而不是 glyph.uuid
    const instanceKey = componentUUID
    let glyphInstance: CustomGlyph | null = null
    
    try {
      // 如果临时实例已存在，直接获取（说明脚本已执行）
      if (instanceManager.isTemporary(instanceKey)) {
        glyphInstance = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyphValue),
          'glyph'
        ) as CustomGlyph
      } else {
        // 如果实例不存在，创建临时实例
        glyphInstance = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyphValue),
          'glyph'
        ) as CustomGlyph
      }
      
      if (!glyphInstance) {
        return []
      }
      
      // 从实例获取 joints（局部坐标）
      const joints = glyphInstance.getJoints()
      if (!joints || joints.length === 0) {
        return []
      }
      
      // 获取组件的 ox 和 oy（如果未提供参数，则从 component 中读取）
      const componentOx = ox !== undefined ? ox : (glyphComp.ox || 0)
      const componentOy = oy !== undefined ? oy : (glyphComp.oy || 0)
      
      // 转换为全局坐标的 joints
      return joints.map((joint) => {
        // 所有情况都需要加上 ox 和 oy
        const x = (joint.x ?? joint._x ?? 0) + componentOx
        const y = (joint.y ?? joint._y ?? 0) + componentOy
        
        return {
          name: joint.name || '',
          x,
          y,
          uuid: joint.uuid
        } as IJoint
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[JointManager] Failed to get joints:', error)
      }
      return []
    }
  }

  /**
   * 查找鼠标位置附近的关键点
   * @param joints 关键点数组
   * @param x 鼠标 x 坐标
   * @param y 鼠标 y 坐标
   * @param threshold 距离阈值
   * @param ox 组件的 x 偏移量（可选，用于调整 joints 坐标）
   * @param oy 组件的 y 偏移量（可选，用于调整 joints 坐标）
   */
  static findHitJoint(
    joints: IJoint[],
    x: number,
    y: number,
    threshold: number = 20,
    ox: number = 0,
    oy: number = 0
  ): IJoint | null {
    for (const joint of joints) {
      if (joint.name.includes('_ref')) continue
      const jointX = typeof joint.x === 'function' ? joint.x() : joint.x
      const jointY = typeof joint.y === 'function' ? joint.y() : joint.y
      
      // 如果 joints 已经是全局坐标，ox 和 oy 应该为 0
      // 如果 joints 是局部坐标，需要加上 ox 和 oy
      const adjustedX = jointX + ox
      const adjustedY = jointY + oy
      
      const distance = Math.sqrt(
        (adjustedX - x) ** 2 + (adjustedY - y) ** 2
      )
      if (distance <= threshold) {
        return joint
      }
    }
    return null
  }

  /**
   * 查找鼠标悬停的关键点（用于高亮显示）
   * @param joints 关键点数组
   * @param x 鼠标 x 坐标
   * @param y 鼠标 y 坐标
   * @param threshold 距离阈值
   * @param ox 组件的 x 偏移量（可选，用于调整 joints 坐标）
   * @param oy 组件的 y 偏移量（可选，用于调整 joints 坐标）
   */
  static findHoverJoint(
    joints: IJoint[],
    x: number,
    y: number,
    threshold: number = 10,
    ox: number = 0,
    oy: number = 0
  ): IJoint | null {
    return this.findHitJoint(joints, x, y, threshold, ox, oy)
  }

  /**
   * 判断是否为第一个关键点
   */
  static isFirstJoint(joint: IJoint, joints: IJoint[]): boolean {
    if (joints.length === 0) return false
    const _joints = joints.filter(joint => !joint.name.includes('_ref'))
    return joint === _joints[0] || joint.name === _joints[0].name
  }
}
