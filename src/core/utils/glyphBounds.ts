/**
 * 字形组件包围框计算工具
 * 复用 glyphDragger 中的逻辑，供选择工具等模块使用
 */

import type { IComponent, ICustomGlyph } from '../types'
import { getBound, transformPoints, getRectanglePoints, getEllipsePoints } from './math'
import { instanceManager } from '../instance/InstanceManager'
import { CustomGlyph } from '../instance/CustomGlyph'
import { executeGlyphScript } from '../script/ScriptExecutor'

/** 字形数据里已有 pen/polygon 等可算包围盒的组件时，不必为填 _components 而执行脚本 */
function externalGlyphComponentsProvideDrawPoints(gv: ICustomGlyph): boolean {
  const comps = gv.components
  if (!comps || !Array.isArray(comps)) return false
  for (const c of comps as any[]) {
    if (!c || c.usedInCharacter === false) continue
    if (c.type === 'pen') {
      const pts = (c.value as any)?.points
      if (pts && Array.isArray(pts) && pts.length > 0) return true
    }
    if (c.type === 'polygon') {
      const pts = (c.value as any)?.points
      if (pts && Array.isArray(pts) && pts.length > 0) return true
    }
    if (c.type === 'rectangle') {
      const rv = c.value as any
      const rw = rv?.width ?? c.w
      const rh = rv?.height ?? c.h
      if (rw && rh) return true
    }
    if (c.type === 'ellipse') {
      const ev = c.value as any
      if (ev?.radiusX && ev?.radiusY) return true
    }
  }
  return false
}

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
    let glyphInstance = instanceManager.acquireTemporaryInstance(
      instanceKey,
      () => new CustomGlyph(glyphValue),
      'glyph'
    ) as CustomGlyph

    if (!glyphInstance) {
      if (import.meta.env.DEV) {
        console.warn('[computeGlyphComponentBoundingBox] glyphInstance is null', instanceKey)
      }
      return null
    }

    // 若 _components 为空但有 script：仅在为算包围盒「还缺几何」时才执行脚本。
    // 骨架绑定 / 带外部 pen 的字形：executeGlyphScript 走 strokeFn 后 _components 仍常为空，
    // 但 glyph.components 里已有笔迹点；若仍每次 bbox（SelectTool/Dragger 高频）都跑脚本，会打爆日志并可能触发响应式循环。
    const scriptHint = !!(glyphValue.script || glyphValue.script_reference)
    const needsScriptToPopulateInternal =
      (!glyphInstance._components || glyphInstance._components.length === 0) &&
      scriptHint &&
      !glyphValue.skeleton &&
      !externalGlyphComponentsProvideDrawPoints(glyphValue)

    if (needsScriptToPopulateInternal) {
      if (import.meta.env.DEV) {
        console.log('[computeGlyphComponentBoundingBox] Executing script to populate _components', instanceKey)
      }
      try {
        executeGlyphScript(glyphValue, instanceKey)
        glyphInstance = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyphValue),
          'glyph'
        ) as CustomGlyph
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[computeGlyphComponentBoundingBox] Failed to execute script:', error)
        }
      }
    }

    // 1. 遍历外部组件（glyph.components 中的组件）
    if (glyphValue.components && Array.isArray(glyphValue.components)) {
      if (import.meta.env.DEV) {
        console.log('[computeGlyphComponentBoundingBox] Processing external components', {
          instanceKey,
          componentCount: glyphValue.components.length,
        })
      }
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
    // 注意：_components 可能为空（如果脚本未执行），这不应该导致函数返回 null
    // 只要有外部组件，就应该能计算包围框
    if (glyphInstance._components && Array.isArray(glyphInstance._components) && glyphInstance._components.length > 0) {
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

    // 不在这里释放临时实例，让调用方管理生命周期
    // 这样可以避免在 mousedown 和 mouseup 之间实例被释放导致的问题
    // 调用方应该在适当时机调用 instanceManager.releaseTemporaryInstance(instanceKey) 释放实例

    // 如果没有收集到任何点，返回 null
    // 但要注意：即使没有内部组件，只要有外部组件，就应该能计算包围框
    if (allPoints.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[computeGlyphComponentBoundingBox] No points collected', {
          instanceKey,
          hasExternalComponents: glyphValue.components && Array.isArray(glyphValue.components) && glyphValue.components.length > 0,
          externalComponentCount: glyphValue.components && Array.isArray(glyphValue.components) ? glyphValue.components.length : 0,
          hasInternalComponents: glyphInstance._components && Array.isArray(glyphInstance._components) && glyphInstance._components.length > 0,
          internalComponentCount: glyphInstance._components && Array.isArray(glyphInstance._components) ? glyphInstance._components.length : 0,
        })
      }
      return null
    }

    if (import.meta.env.DEV) {
      console.log('[computeGlyphComponentBoundingBox] Collected points', {
        instanceKey,
        pointCount: allPoints.length,
      })
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

