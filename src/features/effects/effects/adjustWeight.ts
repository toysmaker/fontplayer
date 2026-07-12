/**
 * 调整字重效果
 * 膨胀：顶点沿法线外移 + 与原轮廓 unite
 * 腐蚀：顶点沿法线内移 → 直接作为结果轮廓
 * 支持棱角精度参数：高精度时检测棱角并使用斜接偏移（miter）代替圆角
 */

import paper from 'paper'
import type { IComponent, IContour } from '@/core/types'
import { penComponentsToContours, contoursToPenComponents } from '../utils/contourOps'
import type { IContour as IFontContour, IContours as IFontContours } from '@/core/font/types'
import { PathType } from '@/core/font/types'

// ---------- 辅助函数 ----------

function contourToPath(contour: IFontContour): paper.Path {
  const path = new paper.Path()
  const seg0 = contour[0]
  path.moveTo(new paper.Point(seg0.start.x, seg0.start.y))
  for (const seg of contour) {
    if (seg.type === PathType.LINE) {
      path.lineTo(new paper.Point(seg.end.x, seg.end.y))
    } else if (seg.type === PathType.CUBIC_BEZIER) {
      path.cubicCurveTo(
        new paper.Point(seg.control1.x, seg.control1.y),
        new paper.Point(seg.control2.x, seg.control2.y),
        new paper.Point(seg.end.x, seg.end.y),
      )
    } else if (seg.type === PathType.QUADRATIC_BEZIER) {
      const lp = path.lastSegment?.point || new paper.Point(seg.start.x, seg.start.y)
      const cp = new paper.Point(seg.control.x, seg.control.y)
      const ep = new paper.Point(seg.end.x, seg.end.y)
      path.cubicCurveTo(
        lp.multiply(1 / 3).add(cp.multiply(2 / 3)),
        ep.multiply(1 / 3).add(cp.multiply(2 / 3)),
        ep,
      )
    }
  }
  path.closePath()
  return path
}

function pathToContour(path: paper.Path): IFontContour {
  const contour: IFontContour = []
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

/**
 * 两条线段的交点
 * 线段1: a → b, 线段2: c → d（作为无限直线求交）
 */
function lineIntersection(
  a: paper.Point, b: paper.Point,
  c: paper.Point, d: paper.Point,
): paper.Point | null {
  const dx1 = b.x - a.x, dy1 = b.y - a.y
  const dx2 = d.x - c.x, dy2 = d.y - c.y
  const cross = dx1 * dy2 - dy1 * dx2
  if (Math.abs(cross) < 1e-10) return null
  const t = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / cross
  return new paper.Point(a.x + t * dx1, a.y + t * dy1)
}

/** 向量点积 */
function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}

/**
 * 顶点法线位移偏移（带棱角保留）
 *
 * @param path      原始轮廓
 * @param distance  偏移距离（正=外扩，负=内缩）
 * @param quality   棱角精度 0-100（0=全部圆角化，100=尽力保留所有棱角）
 */
function dilateOrErodePath(
  path: paper.Path,
  distance: number,
  quality: number,
): paper.Path | null {
  // 确保逆时针（area > 0），法线向外
  if (path.area < 0) {
    path.reverse()
  }

  // 根据精度计算参数（quality: 0-200）
  const q = quality / 200
  const flatTol = 2.0 - q * 1.9        // 2.0 → 0.1
  const cornerAngleDeg = 60 - q * 55    // 60° → 5°
  const cornerAngleRad = (cornerAngleDeg * Math.PI) / 180
  const miterLimit = 1 + q * 19         // 1 → 20
  const simplifyTol = 4 - q * 3.8       // 4 → 0.2

  path.flatten(flatTol)
  const n = path.segments.length
  if (n < 3) return null

  // 收集顶点及其入边/出边方向
  const rawVertices: Array<{
    point: paper.Point
    prev: paper.Point
    next: paper.Point
    nxIn: number; nyIn: number
    nxOut: number; nyOut: number
    edgeInLen: number
    edgeOutLen: number
  }> = []

  for (let i = 0; i < n; i++) {
    const s = path.segments[i]
    const prevS = path.segments[(i - 1 + n) % n]
    const nextS = path.segments[(i + 1) % n]
    if (!s || !prevS || !nextS) continue

    const p = s.point
    const pPrev = prevS.point
    const pNext = nextS.point

    const dxIn = p.x - pPrev.x
    const dyIn = p.y - pPrev.y
    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn)

    const dxOut = pNext.x - p.x
    const dyOut = pNext.y - p.y
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut)

    rawVertices.push({
      point: p,
      prev: pPrev,
      next: pNext,
      nxIn: lenIn > 0.001 ? dyIn / lenIn : 0,
      nyIn: lenIn > 0.001 ? -dxIn / lenIn : 0,
      nxOut: lenOut > 0.001 ? dyOut / lenOut : 0,
      nyOut: lenOut > 0.001 ? -dxOut / lenOut : 0,
      edgeInLen: lenIn,
      edgeOutLen: lenOut,
    })
  }

  if (rawVertices.length < 3) return null

  // 对每个顶点计算偏移后的位置
  const offsetPoints: paper.Point[] = []

  for (let i = 0; i < rawVertices.length; i++) {
    const v = rawVertices[i]
    const p = v.point

    // 计算入边和出边法线的夹角（判断是否为棱角）
    const cosAngle = dot(v.nxIn, v.nyIn, v.nxOut, v.nyOut)
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) // [0, π]

    // 棱角检测：出入边夹角大于阈值
    const isCorner = angle > cornerAngleRad

    if (isCorner && distance !== 0) {
      // --- 棱角：使用斜接偏移（miter） ---
      // 将入边和出边各沿其法线偏移 distance
      // 求两条偏移边的交点

      const prevPt = v.prev
      const nextPt = v.next

      // 入边偏移：prev → p，法线 (nxIn, nyIn)，偏移 distance
      const inA = new paper.Point(prevPt.x + v.nxIn * distance, prevPt.y + v.nyIn * distance)
      const inB = new paper.Point(p.x + v.nxIn * distance, p.y + v.nyIn * distance)

      // 出边偏移：p → next，法线 (nxOut, nyOut)，偏移 distance
      const outA = new paper.Point(p.x + v.nxOut * distance, p.y + v.nyOut * distance)
      const outB = new paper.Point(nextPt.x + v.nxOut * distance, nextPt.y + v.nyOut * distance)

      const miterPt = lineIntersection(inA, inB, outA, outB)

      if (miterPt) {
        // 检查斜接长度是否在限制内
        const miterDist = miterPt.getDistance(p)
        const maxMiterDist = Math.abs(distance) * miterLimit

        if (miterDist <= maxMiterDist || miterDist < Math.abs(distance) * 1.5) {
          offsetPoints.push(miterPt)
        } else {
          // 斜接过长（极尖锐的角），退化为圆角 + 截断
          const clampedDist = Math.min(miterDist, maxMiterDist)
          const dirX = miterPt.x - p.x
          const dirY = miterPt.y - p.y
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
          if (dirLen > 0.001) {
            offsetPoints.push(new paper.Point(
              p.x + (dirX / dirLen) * clampedDist,
              p.y + (dirY / dirLen) * clampedDist,
            ))
          } else {
            // 退化到平均法线
            let nx = v.nxIn + v.nxOut
            let ny = v.nyIn + v.nyOut
            const l = Math.sqrt(nx * nx + ny * ny)
            if (l > 0.001) { nx /= l; ny /= l }
            offsetPoints.push(new paper.Point(p.x + nx * distance, p.y + ny * distance))
          }
        }
      } else {
        // 平行边，用平均法线
        let nx = v.nxIn + v.nxOut
        let ny = v.nyIn + v.nyOut
        const l = Math.sqrt(nx * nx + ny * ny)
        if (l > 0.001) { nx /= l; ny /= l }
        offsetPoints.push(new paper.Point(p.x + nx * distance, p.y + ny * distance))
      }
    } else {
      // --- 平滑边：平均法线（圆角连接） ---
      let nx = v.nxIn + v.nxOut
      let ny = v.nyIn + v.nyOut
      const l = Math.sqrt(nx * nx + ny * ny)
      if (l > 0.001) { nx /= l; ny /= l }
      offsetPoints.push(new paper.Point(p.x + nx * distance, p.y + ny * distance))
    }
  }

  // 构建偏移多边形
  const offsetPath = new paper.Path()
  offsetPath.moveTo(offsetPoints[0])
  for (let i = 1; i < offsetPoints.length; i++) {
    offsetPath.lineTo(offsetPoints[i])
  }
  offsetPath.closePath()

  let result: paper.PathItem

  if (distance >= 0) {
    // 膨胀：偏移多边形 + 原形状 unite
    const clone = path.clone() as paper.Path
    result = clone.unite(offsetPath) as paper.PathItem
    offsetPath.remove()
    path.remove()
  } else {
    // 腐蚀：直接用偏移多边形
    result = offsetPath.unite(offsetPath.clone()) as paper.PathItem
    path.remove()
  }

  if (!result || (result as any).isEmpty?.()) return null

  // 取面积最大的子路径
  let bestPath: paper.Path | null = null
  const children = (result as any).children
  if (children && children.length > 0) {
    let maxArea = 0
    for (const child of children) {
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
  bestPath.simplify(simplifyTol)
  return bestPath
}

// ---------- 公开 API ----------

export function applyAdjustWeight(
  components: IComponent[],
  params: Record<string, number>,
): IComponent[] {
  const weight = params.weight ?? 20
  const quality = params.quality ?? 50
  if (weight === 0) return components

  const distance = weight / 10

  try {
    if (distance >= 0) {
      const contours = penComponentsToContours(components)
      if (contours.length === 0) return components

      const resultPaths: paper.Path[] = []
      for (const c of contours) {
        const p = contourToPath(c as unknown as IFontContour)
        const dilated = dilateOrErodePath(p, distance, quality)
        if (dilated) resultPaths.push(dilated)
      }

      if (resultPaths.length === 0) return components

      let merged: paper.PathItem = resultPaths[0]
      for (let i = 1; i < resultPaths.length; i++) {
        merged = merged.unite(resultPaths[i]) as paper.PathItem
        resultPaths[i].remove()
      }

      const outContours: IFontContours = []
      const mc = (merged as any).children
      if (mc && mc.length > 0) {
        for (const child of mc) {
          if (child instanceof paper.Path && child.curves.length > 0) {
            outContours.push(pathToContour(child))
          }
        }
      } else if (merged instanceof paper.Path && merged.curves.length > 0) {
        outContours.push(pathToContour(merged))
      }
      merged.remove()

      if (outContours.length === 0) return components
      const result = contoursToPenComponents(outContours as unknown as IContour[], 'weight')
      return result.length > 0 ? result : components
    } else {
      const results: IComponent[] = []
      for (const comp of components) {
        const contours = penComponentsToContours([comp])
        if (contours.length === 0) {
          results.push(comp)
          continue
        }

        const erodedContours: IFontContours = []
        for (const c of contours) {
          const p = contourToPath(c as unknown as IFontContour)
          const eroded = dilateOrErodePath(p, distance, quality)
          if (eroded) {
            erodedContours.push(pathToContour(eroded))
            eroded.remove()
          }
        }

        if (erodedContours.length === 0) {
          results.push(comp)
          continue
        }

        const newComps = contoursToPenComponents(
          erodedContours as unknown as IContour[],
          comp.name || 'weight',
        )
        results.push(...(newComps.length > 0 ? newComps : [comp]))
      }

      return results.length > 0 ? results : components
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[adjustWeight] failed:', e)
    }
    return components
  }
}
