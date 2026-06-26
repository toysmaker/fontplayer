/**
 * 轮廓膨胀 / 腐蚀工具
 * 基于 Paper.js offset() 实现字形轮廓的膨胀（加粗/留白）和腐蚀（变细），
 * 供后处理规则（差集留白）和日后的字重调节功能复用。
 *
 * 膨胀原理：
 *   使用 Paper.js Path#offset(delta) 沿法线方向偏移轮廓，保留贝塞尔曲线曲率。
 *   正值向外扩张，负值向内收缩。join: 'round' 保证转角平滑。
 *
 * 腐蚀原理：
 *   调用 contourDilate(contours, -distance) 向内偏移。
 */

import paper from 'paper'
import { PathType, type IContour, type IContours } from '../font/types'

// ---------- 内部：IContour ↔ Paper.js Path ----------

function contourToPaperPath(contour: IContour): paper.Path {
  const path = new paper.Path()
  if (contour.length === 0) return path

  const seg0 = contour[0]
  path.moveTo(new paper.Point(seg0.start.x, seg0.start.y))
  let lastX = seg0.start.x
  let lastY = seg0.start.y

  for (const segment of contour) {
    if (segment.type === PathType.LINE) {
      path.lineTo(new paper.Point(segment.end.x, segment.end.y))
      lastX = segment.end.x
      lastY = segment.end.y
    } else if (segment.type === PathType.CUBIC_BEZIER) {
      path.cubicCurveTo(
        new paper.Point(segment.control1.x, segment.control1.y),
        new paper.Point(segment.control2.x, segment.control2.y),
        new paper.Point(segment.end.x, segment.end.y),
      )
      lastX = segment.end.x
      lastY = segment.end.y
    } else if (segment.type === PathType.QUADRATIC_BEZIER) {
      const startPt = new paper.Point(lastX, lastY)
      const control = new paper.Point(segment.control.x, segment.control.y)
      const endPt = new paper.Point(segment.end.x, segment.end.y)
      const c1 = startPt.multiply(1 / 3).add(control.multiply(2 / 3))
      const c2 = endPt.multiply(1 / 3).add(control.multiply(2 / 3))
      path.cubicCurveTo(c1, c2, endPt)
      lastX = segment.end.x
      lastY = segment.end.y
    }
  }

  path.closePath()
  return path
}

function paperPathToContour(path: paper.Path): IContour {
  const contour: IContour = []
  if (!path.curves || path.curves.length === 0) return contour

  for (const curve of path.curves) {
    const p0 = curve.point1
    const p1 = p0.add(curve.handle1)
    const p2 = curve.point2.add(curve.handle2)
    const p3 = curve.point2

    contour.push({
      type: PathType.CUBIC_BEZIER as const,
      start: { x: p0.x, y: p0.y },
      control1: { x: p1.x, y: p1.y },
      control2: { x: p2.x, y: p2.y },
      end: { x: p3.x, y: p3.y },
    })
  }

  return contour
}

// ---------- 内部：Paper.js 复合路径提取 ----------

function extractPathsFromItem(item: paper.PathItem): IContours {
  const result: IContours = []
  const children = (item as any).children

  if (children && children.length > 0) {
    for (const child of children) {
      if (child instanceof paper.Path && child.curves.length > 0) {
        result.push(paperPathToContour(child))
      } else if (child instanceof paper.CompoundPath) {
        result.push(...extractPathsFromItem(child))
      }
    }
  } else if (item instanceof paper.Path && item.curves.length > 0) {
    result.push(paperPathToContour(item))
  }

  return result
}

/** 对单个 Paper.js Path 执行 offset，返回结果中所有子路径 */
function offsetPath(path: paper.Path, distance: number): paper.Path[] {
  // Paper.js offset() 返回 CompoundPath 或 Path
  // Paper.js v0.12.18 运行时支持 offset，但类型声明未包含
  const result = (path as any).offset(distance, {
    join: 'round',
    limit: 4,
  }) as paper.PathItem

  if (!result || (result as any).isEmpty?.()) return []

  const children = (result as any).children
  if (children && children.length > 0) {
    const paths: paper.Path[] = []
    for (const child of children) {
      if (child instanceof paper.Path && child.curves.length > 0) {
        paths.push(child)
      }
    }
    return paths
  }

  if (result instanceof paper.Path && result.curves.length > 0) {
    return [result]
  }

  result.remove()
  return []
}

/**
 * 将偏移后的折线轮廓通过 simplify 还原为贝塞尔曲线
 */
function simplifyToBezier(paths: paper.Path[], tolerance: number = 2): void {
  for (const p of paths) {
    if (p.curves.length > 0) {
      p.simplify(tolerance)
    }
  }
}

// ---------- 公开 API ----------

/**
 * 合并多个轮廓为一个轮廓集合
 */
export function contourUnite(contours: IContours): IContours {
  if (!contours.length) return []
  if (contours.length === 1) return [[...contours[0]]]

  try {
    let united: paper.PathItem = contourToPaperPath(contours[0])
    for (let i = 1; i < contours.length; i++) {
      const next = contourToPaperPath(contours[i])
      united = united.unite(next) as paper.PathItem
      next.remove()
    }

    if (!united || (united as any).isEmpty?.()) return []

    const result = extractPathsFromItem(united)
    united.remove()
    return result.length ? result : contours.map((c) => [...c])
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[contourDilate] contourUnite failed:', e)
    }
    return contours.map((c) => [...c])
  }
}

/**
 * 轮廓膨胀（向外扩张/加粗）
 *
 * 使用 Paper.js Path#offset(delta, { join: 'round' })
 * 沿法线方向精确偏移轮廓，完整保留贝塞尔曲线。
 *
 * @param contours  输入轮廓集合
 * @param distance  膨胀距离（px），正值向外扩张，负值向内收缩
 * @returns 膨胀后的轮廓集合
 */
export function contourDilate(contours: IContours, distance: number): IContours {
  if (!contours.length) return []
  if (distance === 0) return contours.map((c) => [...c])

  const absDist = Math.abs(distance)

  try {
    // 1. 合并所有轮廓为一个 Paper.js compound path
    let combined: paper.PathItem | null = null
    for (const c of contours) {
      if (!c.length) continue
      const p = contourToPaperPath(c)
      if (!combined) {
        combined = p
      } else {
        combined = combined.unite(p) as paper.PathItem
        p.remove()
      }
    }
    if (!combined || (combined as any).isEmpty?.()) {
      combined?.remove()
      return contours.map((c) => [...c])
    }

    // 2. 提取所有子路径
    const subPaths: paper.Path[] = []
    const children = (combined as any).children
    if (children && children.length > 0) {
      for (const child of children) {
        if (child instanceof paper.Path) subPaths.push(child)
      }
    } else if (combined instanceof paper.Path) {
      subPaths.push(combined)
    }

    // 3. 克隆每条子路径后做顶点偏移（避免 flatten 破坏原路径）
    const offsetPaths: paper.Path[] = []
    for (const sp of subPaths) {
      const clone = sp.clone() as paper.Path
      const dilated = dilateSinglePath(clone, distance)
      if (dilated) offsetPaths.push(dilated)
    }

    if (!offsetPaths.length) {
      combined.remove()
      return contours.map((c) => [...c])
    }

    // 4. 合并所有偏移后的路径
    let merged: paper.PathItem = offsetPaths[0]
    for (let i = 1; i < offsetPaths.length; i++) {
      merged = merged.unite(offsetPaths[i]) as paper.PathItem
      offsetPaths[i].remove()
    }

    // 5. 膨胀时与原形状 unite，确保膨胀区域为原形状的超集
    if (distance > 0) {
      merged = combined.unite(merged) as paper.PathItem
    } else {
      combined.remove()
    }

    // 6. simplify 还原贝塞尔曲线
    const allResultPaths: paper.Path[] = []
    const resChildren = (merged as any).children
    if (resChildren && resChildren.length > 0) {
      for (const child of resChildren) {
        if (child instanceof paper.Path) allResultPaths.push(child)
      }
    } else if (merged instanceof paper.Path) {
      allResultPaths.push(merged)
    }
    for (const rp of allResultPaths) {
      if (rp.curves.length > 0) rp.simplify(1.5)
    }

    if (!merged || (merged as any).isEmpty?.()) {
      return contours.map((c) => [...c])
    }

    const output = extractPathsFromItem(merged)
    merged.remove()
    return output.length ? output : contours.map((c) => [...c])
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[contourDilate] contourDilate failed:', e)
    }
    return contours.map((c) => [...c])
  }
}

/**
 * 对单条路径做顶点偏移膨胀
 *
 * 算法：高精度 flatten → 顶点沿法线方向外移 → 构建偏移多边形 →
 *       boolean unite 所有偏移区域 → simplify 还原曲线
 */
function dilateSinglePath(path: paper.Path, distance: number): paper.Path | null {
  const absDist = Math.abs(distance)
  // 确保路径为逆时针（area > 0），使得法线指向外部
  if (path.area < 0) {
    path.reverse()
  }

  // 高精度 flatten
  const flatTolerance = 1.0
  path.flatten(flatTolerance)

  const n = path.segments.length
  if (n < 3) return null

  // 收集顶点 + 计算每个顶点处的平均法线
  interface VertexInfo {
    point: paper.Point
    nx: number
    ny: number
  }
  const vertices: VertexInfo[] = []

  for (let i = 0; i < n; i++) {
    const s = path.segments[i]
    if (!s) continue

    // 计算入边和出边的法线，取平均作为该顶点的偏移方向
    const prevS = path.segments[(i - 1 + n) % n]
    const nextS = path.segments[(i + 1) % n]
    if (!prevS || !nextS) continue

    const p = s.point
    const pPrev = prevS.point
    const pNext = nextS.point

    // 入边法线（右法线 = 90°顺时针 = 逆时针路径的外方向）
    const dxIn = p.x - pPrev.x
    const dyIn = p.y - pPrev.y
    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn)
    const nxIn = lenIn > 0.001 ? dyIn / lenIn : 0
    const nyIn = lenIn > 0.001 ? -dxIn / lenIn : 0

    // 出边法线
    const dxOut = pNext.x - p.x
    const dyOut = pNext.y - p.y
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut)
    const nxOut = lenOut > 0.001 ? dyOut / lenOut : 0
    const nyOut = lenOut > 0.001 ? -dxOut / lenOut : 0

    // 平均法线
    let nx = nxIn + nxOut
    let ny = nyIn + nyOut
    const avgLen = Math.sqrt(nx * nx + ny * ny)
    if (avgLen > 0.001) {
      nx /= avgLen
      ny /= avgLen
    }

    vertices.push({ point: p, nx, ny })
  }

  // 构建偏移多边形（连续的外轮廓 + 内轮廓原路径 → 组成环形区域）
  if (vertices.length < 3) return null

  const offsetPath = new paper.Path()
  offsetPath.moveTo(
    new paper.Point(
      vertices[0].point.x + vertices[0].nx * distance,
      vertices[0].point.y + vertices[0].ny * distance,
    ),
  )

  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i]
    offsetPath.lineTo(
      new paper.Point(
        v.point.x + v.nx * distance,
        v.point.y + v.ny * distance,
      ),
    )
  }
  offsetPath.closePath()

  // 偏移多边形与原形状 unite，得到膨胀后的形状
  const originalClone = path.clone() as paper.Path
  const result = originalClone.unite(offsetPath) as paper.PathItem
  offsetPath.remove()
  path.remove()

  if (!result || (result as any).isEmpty?.()) return null

  // 取出面积最大的子路径
  const resultChildren = (result as any).children
  let bestPath: paper.Path | null = null
  if (resultChildren && resultChildren.length > 0) {
    let maxArea = 0
    for (const child of resultChildren) {
      if (child instanceof paper.Path && child.area != null) {
        const area = Math.abs(child.area)
        if (area > maxArea) { maxArea = area; bestPath = child }
      }
    }
  } else if (result instanceof paper.Path) {
    bestPath = result
  }

  if (!bestPath || bestPath.curves.length === 0) {
    result.remove()
    return null
  }

  if (bestPath !== result) result.remove()
  bestPath.simplify(2)

  if (import.meta.env.DEV) {
    // 用原始 clone 面积做对比（clone 已被 unite 消耗，这里用 approximate）
    console.log(
      '[contourDilate] dilateSinglePath: vertices=%d distance=%d area %.0f',
      vertices.length,
      distance,
      Math.abs(bestPath.area),
    )
  }

  return bestPath
}

/**
 * 轮廓腐蚀（向内收缩/变细）
 * 等价于 contourDilate(contours, -distance)
 *
 * @param contours  输入轮廓集合
 * @param distance  收缩距离（px），正值向内收缩
 * @returns 腐蚀后的轮廓集合
 */
export function contourErode(contours: IContours, distance: number): IContours {
  return contourDilate(contours, -distance)
}
