/**
 * 关键点管理器
 * 负责关键点的查找和管理
 */

import type { IJoint } from './types'

export class JointManager {
  /**
   * 获取组件的所有关键点
   * TODO: 需要实现从组件中提取关键点的逻辑
   */
  static getJoints(
    rootComponent: any,
    _subComponentUUID: string
  ): IJoint[] {
    // TODO: 实现从组件树中提取关键点的逻辑
    // 临时返回空数组
    return []
  }

  /**
   * 查找鼠标位置附近的关键点
   */
  static findHitJoint(
    joints: IJoint[],
    x: number,
    y: number,
    threshold: number = 20
  ): IJoint | null {
    for (const joint of joints) {
      const jointX = typeof joint.x === 'function' ? joint.x() : joint.x
      const jointY = typeof joint.y === 'function' ? joint.y() : joint.y
      
      const distance = Math.sqrt(
        (jointX - x) ** 2 + (jointY - y) ** 2
      )
      if (distance <= threshold) {
        return joint
      }
    }
    return null
  }

  /**
   * 查找鼠标悬停的关键点（用于高亮显示）
   */
  static findHoverJoint(
    joints: IJoint[],
    x: number,
    y: number,
    threshold: number = 10
  ): IJoint | null {
    return this.findHitJoint(joints, x, y, threshold)
  }

  /**
   * 判断是否为第一个关键点
   */
  static isFirstJoint(joint: IJoint, joints: IJoint[]): boolean {
    if (joints.length === 0) return false
    return joint === joints[0] || joint.name === joints[0].name
  }
}
