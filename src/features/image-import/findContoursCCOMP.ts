/**
 * OpenCV RETR_CCOMP 风格的轮廓与层级（纯 TS，CHAIN_APPROX_NONE 像素链）
 * 不保证与 OpenCV 逐点一致，但层级 parent 用于 fillColor 与原版一致。
 */

export interface ContourPoint {
  x: number
  y: number
}

export interface FindContoursCCOMPResult {
  contours: ContourPoint[][]
  /** 每轮廓 4 元组 [next, prev, firstChild, parent]，与 OpenCV 一致；当前仅 parent 可靠填充 */
  hierarchy: Int32Array
}

/** 顺时针：E, SE, S, SW, W, NW, N, NE */
const DX = [1, 1, 0, -1, -1, -1, 0, 1]
const DY = [0, 1, 1, 1, 0, -1, -1, -1]

function dirFromTo(fx: number, fy: number, tx: number, ty: number): number {
  const dx = tx - fx
  const dy = ty - fy
  for (let d = 0; d < 8; d++) {
    if (DX[d] === dx && DY[d] === dy) return d
  }
  return 0
}

/**
 * Moore 边界跟踪；坐标为 padding 后图像 (1..width, 1..height)
 */
function mooreTrace(
  P: Uint8Array,
  pw: number,
  sx: number,
  sy: number,
): ContourPoint[] {
  const at = (x: number, y: number) => P[y * pw + x]
  const contour: ContourPoint[] = []
  let x = sx
  let y = sy
  // 从西侧背景进入：当前点到「上一格」的方向为 W = 4
  let dirToPrev = 4
  const maxSteps = pw * P.length
  for (let step = 0; step < maxSteps; step++) {
    contour.push({ x: x - 1, y: y - 1 })
    let nx = x
    let ny = y
    let nd = -1
    // 从 dirToPrev 的下一格顺时针依次看 8 邻域，第一个前景点为下一步
    for (let i = 0; i < 8; i++) {
      const d = (dirToPrev + 1 + i) % 8
      const tx = x + DX[d]
      const ty = y + DY[d]
      if (at(tx, ty) === 1) {
        nx = tx
        ny = ty
        nd = d
        break
      }
    }
    if (nd < 0) break
    const ox = x
    const oy = y
    x = nx
    y = ny
    dirToPrev = dirFromTo(x, y, ox, oy)
    if (x === sx && y === sy) break
  }
  return contour
}

function polygonSignedArea(pts: ContourPoint[]): number {
  if (pts.length < 3) return 0
  let a = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return a / 2
}

function centroid(pts: ContourPoint[]): ContourPoint {
  let sx = 0
  let sy = 0
  for (const p of pts) {
    sx += p.x
    sy += p.y
  }
  const n = Math.max(1, pts.length)
  return { x: sx / n, y: sy / n }
}

/** 射线法，边界上的点视为在外（避免歧义） */
export function pointInPolygon(pt: ContourPoint, poly: ContourPoint[]): boolean {
  const { x, y } = pt
  let inside = false
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    if (yi === yj) continue
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function buildHierarchy(contours: ContourPoint[][]): Int32Array {
  const n = contours.length
  const hierarchy = new Int32Array(n * 4)
  for (let i = 0; i < n; i++) {
    hierarchy[i * 4 + 0] = -1
    hierarchy[i * 4 + 1] = -1
    hierarchy[i * 4 + 2] = -1
    hierarchy[i * 4 + 3] = -1
  }
  if (n === 0) return hierarchy

  const areas = contours.map((c) => Math.abs(polygonSignedArea(c)))
  const reps = contours.map((c) => centroid(c))

  for (let j = 0; j < n; j++) {
    let best = -1
    let bestArea = Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      if (i === j) continue
      if (areas[i] <= areas[j]) continue
      if (!pointInPolygon(reps[j], contours[i])) continue
      if (areas[i] < bestArea) {
        bestArea = areas[i]
        best = i
      }
    }
    hierarchy[j * 4 + 3] = best
  }

  return hierarchy
}

/**
 * 在 0/255 或任意 >0 为前景的二值掩码上提取轮廓（整幅）
 */
export function findContoursCCOMP_TS(mask: Uint8Array, width: number, height: number): FindContoursCCOMPResult {
  const pw = width + 2
  const ph = height + 2
  const P = new Uint8Array(pw * ph)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      P[(y + 1) * pw + (x + 1)] = mask[y * width + x] > 0 ? 1 : 0
    }
  }
  const at = (x: number, y: number) => P[y * pw + x]

  const visitedLeftEdge = new Set<string>()
  const contours: ContourPoint[][] = []

  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      if (at(x, y) !== 1 || at(x - 1, y) !== 0) continue
      const key = `${x},${y}`
      if (visitedLeftEdge.has(key)) continue
      const c = mooreTrace(P, pw, x, y)
      if (c.length < 2) continue
      contours.push(c)
      for (const p of c) {
        const px = p.x + 1
        const py = p.y + 1
        if (at(px, py) === 1 && at(px - 1, py) === 0) {
          visitedLeftEdge.add(`${px},${py}`)
        }
      }
    }
  }

  const hierarchy = buildHierarchy(contours)
  return { contours, hierarchy }
}

export function hierarchyParent(hierarchy: Int32Array, i: number): number {
  return hierarchy[i * 4 + 3]
}
