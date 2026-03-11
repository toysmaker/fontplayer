/**
 * 字形组件包围框计算工具
 * 复用 glyphDragger 中的逻辑，供选择工具等模块使用
 */

import type { IComponent, ICustomGlyph } from '../types'
import { getBound, transformPoints, getRectanglePoints, getEllipsePoints } from './math'
import { instanceManager } from '../instance/InstanceManager'
import { CustomGlyph } from '../instance/CustomGlyph'

/**
 * 计算字形组件的包围框（基于实际轮廓点）
 * 遍历外部组件（glyph.components）和内部组件（实例中的脚本组件）
 * @param component 顶层字形组件（type === 'glyph'）
 * @param origin 组件的全局偏移（ox, oy）
 * @returns { x, y, w, h } 或 null
 */
export function computeGlyphComponentBoundingBox(
  component: IComponent,
  origin: { ox: number; oy: number }
): { x: number; y: number; w: number; h: number } | null {
  if (!component || component.type !== 'glyph') return null

  const glyphValue = component.value as ICustomGlyph
  if (!glyphValue) return null

  const allPoints: Array<{ x: number; y: number }> = []

  try {
    // 获取字形实例（用于访问内部组件）
    const instanceKey = component.uuid
    const glyphInstance = instanceManager.acquireTemporaryInstance(
      instanceKey,
      () => new CustomGlyph(glyphValue),
      'glyph'
    ) as CustomGlyph

    if (!glyphInstance) {
      return null
    }

    // 1. 遍历外部组件（glyph.components 中的组件）
    if (glyphValue.components && Array.isArray(glyphValue.components)) {
      for (const extComp of glyphValue.components as any[]) {
        if (!extComp || extComp.usedInCharacter === false) continue

        const { x, y, w, h, rotation, flipX, flipY } = extComp
        let points: Array<{ x: number; y: number }> = []

        switch (extComp.type) {
          case 'pen': {
            const penValue = extComp.value as any
            if (penValue.points && Array.isArray(penValue.points)) {
              points = penValue.points
            }
            break
          }
          case 'polygon': {
            const polyValue = extComp.value as any
            if (polyValue.points && Array.isArray(polyValue.points)) {
              points = polyValue.points
            }
            break
          }
          case 'rectangle': {
            const rectValue = extComp.value as any
            points = getRectanglePoints(
              rectValue.width || 0,
              rectValue.height || 0,
              extComp.x || 0,
              extComp.y || 0
            )
            break
          }
          case 'ellipse': {
            const ellipseValue = extComp.value as any
            points = getEllipsePoints(
              ellipseValue.radiusX || 0,
              ellipseValue.radiusY || 0,
              1000,
              (extComp.x || 0) + (ellipseValue.radiusX || 0),
              (extComp.y || 0) + (ellipseValue.radiusY || 0)
            )
            break
          }
        }

        if (points.length > 0) {
          // 应用变换（缩放、旋转、翻转、偏移）
          const transformedPoints = transformPoints(points, {
            x: x || 0,
            y: y || 0,
            w: w || 1,
            h: h || 1,
            rotation: rotation || 0,
            flipX: flipX || false,
            flipY: flipY || false
          })
          // 加上组件的全局偏移
          transformedPoints.forEach(p => {
            allPoints.push({
              x: p.x + origin.ox,
              y: p.y + origin.oy
            })
          })
        }
      }
    }

    // 2. 遍历内部组件（实例中存储的脚本组件）
    if (glyphInstance._components && Array.isArray(glyphInstance._components)) {
      for (const intComp of glyphInstance._components as any[]) {
        if (!intComp || intComp.usedInCharacter === false) continue

        let points: Array<{ x: number; y: number }> = []

        if (intComp.type === 'glyph-pen' && intComp.points) {
          points = intComp.points
        } else if (intComp.type === 'glyph-polygon' && intComp.points) {
          points = intComp.points
        } else if (intComp.type === 'glyph-rectangle') {
          points = getRectanglePoints(
            intComp.width || 0,
            intComp.height || 0,
            intComp.x || 0,
            intComp.y || 0
          )
        } else if (intComp.type === 'glyph-ellipse') {
          points = getEllipsePoints(
            intComp.radiusX || 0,
            intComp.radiusY || 0,
            1000,
            intComp.centerX || 0,
            intComp.centerY || 0
          )
        }

        if (points.length > 0) {
          // 内部组件的点已经是在字形坐标系中，只需加上组件的全局偏移
          points.forEach(p => {
            allPoints.push({
              x: p.x + origin.ox,
              y: p.y + origin.oy
            })
          })
        }
      }
    }

    // 释放临时实例
    instanceManager.releaseTemporaryInstance(instanceKey)

    if (allPoints.length === 0) {
      return null
    }

    // 计算包围框
    return getBound(allPoints)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[computeGlyphComponentBoundingBox] Error:', error)
    }
    return null
  }
}

