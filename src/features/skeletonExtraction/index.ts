/**
 * 骨架提取功能模块 - 主入口
 *
 * 完整流程：图片 → Rust骨架提取 → 折线合并 → 笔画分类 → 参数提取 → ICharacterSkeleton
 */

export { mergePolylines } from './mergePolylines'
export { classifyStroke, STROKE_NAMES } from './classifyStroke'
export type { StrokeClassification } from './classifyStroke'
export { extractStrokeParams } from './extractParams'

import { mergePolylines } from './mergePolylines'
import { classifyStroke } from './classifyStroke'
import { extractStrokeParams } from './extractParams'
import type { ICharacterSkeleton, ICharacterSkeletonStroke } from '@/core/types'
import type { Vec2 } from '@/utils/polyline'

/** 调试数据：保存中间结果用于可视化排查 */
export interface SkeletonDebugData {
  /** 细化后的骨架位图（0=背景, 1=前景） */
  bitmap: Uint8Array
  /** 位图宽度 */
  width: number
  /** 位图高度 */
  height: number
  /** 追踪出的原始折线段 */
  polylines: Array<Array<[number, number]>>
  /** 合并后的笔画折线段 */
  mergedPolylines?: Array<Array<[number, number]>>
}

let lastDebugData: SkeletonDebugData | null = null

/** 保存调试数据（同时写入 sessionStorage 防止 HMR 丢失） */
function saveDebugData(data: SkeletonDebugData) {
  lastDebugData = data
  try {
    // sessionStorage 备份：bitmap 转 base64，polylines 转 JSON
    const bitmapB64 = btoa(String.fromCharCode(...data.bitmap))
    sessionStorage.setItem('skeletonDebug_bitmap', bitmapB64)
    sessionStorage.setItem('skeletonDebug_width', String(data.width))
    sessionStorage.setItem('skeletonDebug_height', String(data.height))
    sessionStorage.setItem('skeletonDebug_polylines', JSON.stringify(data.polylines))
  } catch { /* ignore storage errors */ }
}

/** 获取最后一次提取的调试数据（优先内存，回退到 sessionStorage） */
export function getLastDebugData(): SkeletonDebugData | null {
  if (lastDebugData) return lastDebugData

  // 尝试从 sessionStorage 恢复（HMR 后内存变量丢失）
  try {
    const bitmapB64 = sessionStorage.getItem('skeletonDebug_bitmap')
    const polylinesJson = sessionStorage.getItem('skeletonDebug_polylines')
    if (bitmapB64 && polylinesJson) {
      const binary = atob(bitmapB64)
      const bitmap = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bitmap[i] = binary.charCodeAt(i)
      lastDebugData = {
        bitmap,
        width: Number(sessionStorage.getItem('skeletonDebug_width')) || 1000,
        height: Number(sessionStorage.getItem('skeletonDebug_height')) || 1000,
        polylines: JSON.parse(polylinesJson),
      }
      return lastDebugData
    }
  } catch { /* ignore */ }

  return null
}

/**
 * 从 Rust backend 返回的折线段数据提取字符骨架
 *
 * @param polylines Rust extract_skeleton 命令返回的折线段数据 [[[x,y],...], ...]
 * @returns 字符骨架数据
 */
export function buildSkeletonFromPolylines(
  polylines: Array<Array<[number, number]>>,
): ICharacterSkeleton {
  // 1. 转换格式 [number, number][] → Vec2[]
  const vec2Polylines: Vec2[][] = polylines.map((poly) =>
    poly.map(([x, y]) => ({ x, y })),
  )

  if (import.meta.env.DEV) {
    console.log(`[SkeletonExtraction] Input polylines: ${vec2Polylines.length}`)
    // 打印前5条折线的长度和首尾坐标
    const sample = vec2Polylines.slice(0, 5)
    sample.forEach((p, i) => {
      console.log(`[SkeletonExtraction]   poly ${i}: len=${p.length}, first=(${p[0].x},${p[0].y}), last=(${p[p.length-1].x},${p[p.length-1].y})`)
    })
    if (vec2Polylines.length > 5) console.log(`[SkeletonExtraction]   ... and ${vec2Polylines.length - 5} more`)
  }

  // 2. 合并碎片折线 → 完整笔画
  const merged = mergePolylines(vec2Polylines)

  // 保存合并后的折线到调试数据
  if (lastDebugData) {
    saveDebugData({
      ...lastDebugData,
      mergedPolylines: merged.map(p => p.map(({ x, y }) => [x, y] as [number, number])),
    })
  }

  if (import.meta.env.DEV) {
    console.log(`[SkeletonExtraction] After merge: ${merged.length} polylines`)
    const sample = merged.slice(0, 5)
    sample.forEach((p, i) => {
      console.log(`[SkeletonExtraction]   merged ${i}: len=${p.length}, first=(${p[0].x},${p[0].y}), last=(${p[p.length-1].x},${p[p.length-1].y})`)
    })
  }

  // 3. 逐条分类并提取参数
  const strokes: ICharacterSkeletonStroke[] = []
  let strokeIdx = 0
  for (let mi = 0; mi < merged.length; mi++) {
    const polyline = merged[mi]
    const classification = classifyStroke(polyline)
    const stroke = extractStrokeParams(
      classification.name,
      classification.correctedPolyline || polyline,
      classification.cornerPoints,
    )
    strokes.push(stroke)
    strokeIdx++

    if (import.meta.env.DEV) {
      const plen = polyline.length
      const s = polyline[0], e = polyline[plen - 1]
      const nJoints = Object.keys(stroke.joints).length
      console.log(
        `[SkeletonExtraction] merged[${mi}] → stroke#${strokeIdx}: "${stroke.name}" | poly=${plen}pt (${s.x},${s.y})→(${e.x},${e.y}) | corners=${classification.cornerPoints.length} | joints=${nJoints} | segTypes=${(classification.segmentTypes || []).join(',')}`,
      )
    }
  }

  // 过滤掉 joints 为空的笔画（被 filterShortArcs 删除的）
  const validStrokes = strokes.filter(s => Object.keys(s.joints).length >= 2)
  if (import.meta.env.DEV && validStrokes.length < strokes.length) {
    console.log(`[SkeletonExtraction] Filtered ${strokes.length - validStrokes.length} empty-joint strokes`)
  }

  // 保持与 mergePolylines 输出一致的顺序
  if (import.meta.env.DEV) {
    console.log('[SkeletonExtraction] ====== Final Skeleton Data (JSON) ======')
    console.log(JSON.stringify({ strokes: validStrokes }, null, 2))
    console.log('[SkeletonExtraction] ====== End Skeleton Data ======')
  }

  return { strokes: validStrokes }
}

/**
 * 打开文件选择器，读取图片，提取骨架
 * 支持 Tauri 和 Web 两种环境
 */
export async function extractSkeletonFromImageFile(): Promise<ICharacterSkeleton | null> {
  try {
    // 1. 使用 Canvas 读取并处理图片
    const imageData = await loadImageToCanvas()

    if (!imageData) {
      if (import.meta.env.DEV) console.log('[SkeletonExtraction] No image selected')
      return null
    }

    // 2. 转为二值 mask（同时运行 JS 细化用于调试）
    const maskBytes = imageDataToBinaryMask(imageData)

    // 3. 始终运行 JS 细化+追踪生成调试数据
    const jsPolylines = traceSkeletonInJS(imageData)
    // lastDebugData 已在 traceSkeletonInJS 中设置

    // 4. 调用后端提取骨架折线段
    // 优先使用 Tauri Rust 后端，失败则回退到 JS 结果
    let polylines: Array<Array<[number, number]>> = []

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      polylines = await invoke<Array<Array<[number, number]>>>(
        'extract_skeleton',
        { maskB64: maskBytes, width: 1000, height: 1000 },
      )
      if (import.meta.env.DEV) {
        console.log('[SkeletonExtraction] Rust backend returned', polylines.length, 'polylines')
      }
      // Tauri 模式下也更新调试数据中的 polylines 为 Rust 结果
      if (lastDebugData) {
        saveDebugData({
          ...lastDebugData,
          polylines: polylines.map(p => p.map(([x, y]) => [x, y] as [number, number])),
        })
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn('[SkeletonExtraction] Tauri backend unavailable, using JS fallback')
      }
      polylines = jsPolylines
    }

    if (!polylines || polylines.length === 0) {
      if (import.meta.env.DEV) console.warn('[SkeletonExtraction] No polylines extracted')
      return null
    }

    // 5. 合并、分类、提取参数
    const skeleton = buildSkeletonFromPolylines(polylines)
    return skeleton
  } catch (error) {
    console.error('[SkeletonExtraction] Error:', error)
    return null
  }
}

/**
 * 通过文件选择器加载图片到 Canvas
 */
async function loadImageToCanvas(): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/bmp'
    input.style.display = 'none'

    const cleanup = () => {
      if (input.parentNode) document.body.removeChild(input)
    }

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        cleanup()
        resolve(null)
        return
      }

      try {
        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
          URL.revokeObjectURL(url)
          // 绘制到 1000x1000 canvas
          const canvas = document.createElement('canvas')
          canvas.width = 1000
          canvas.height = 1000
          const ctx = canvas.getContext('2d')!

          // 白色背景
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, 1000, 1000)

          // 等比缩放居中绘制
          const scale = Math.min(1000 / img.width, 1000 / img.height)
          const dw = img.width * scale
          const dh = img.height * scale
          const dx = (1000 - dw) / 2
          const dy = (1000 - dh) / 2
          ctx.drawImage(img, dx, dy, dw, dh)

          const imageData = ctx.getImageData(0, 0, 1000, 1000)
          cleanup()
          resolve(imageData)
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          cleanup()
          resolve(null)
        }

        img.src = url
      } catch {
        cleanup()
        resolve(null)
      }
    }

    document.body.appendChild(input)
    input.click()
  })
}

/**
 * 将 ImageData 转为二值 mask 的 base64
 * 0 = 前景(ink/黑色), 255 = 背景(paper/白色)
 */
function imageDataToBinaryMask(imageData: ImageData): string {
  const pixels = imageData.data
  const bytes: number[] = new Array(1000 * 1000)
  let inkCount = 0

  for (let i = 0; i < 1000 * 1000; i++) {
    const offset = i * 4
    const r = pixels[offset]
    const g = pixels[offset + 1]
    const b = pixels[offset + 2]
    // 亮度阈值：< 128 视为前景（ink）
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    if (gray < 128) {
      bytes[i] = 0 // 前景 = 黑色（ink）
      inkCount++
    } else {
      bytes[i] = 255 // 背景 = 白色（paper）
    }
  }

  // 自动反转：如果前景（ink）超过 50%，说明图片是黑底白字
  if (inkCount > 500000) {
    if (import.meta.env.DEV) {
      console.log('[SkeletonExtraction] Auto-inverting mask (ink ratio > 50%)')
    }
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = 255 - bytes[i]
    }
  }

  // 转为 base64
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// ============================================================
// JS 回退方案：纯 TypeScript 的骨架追踪
// 当 Tauri 后端不可用时（如浏览器开发模式）使用
// Zhang-Suen 细化算法（标准编码：1=前景/ink, 0=背景/paper）
// ============================================================

/**
 * 在浏览器中使用纯 JS 实现骨架追踪
 */
function traceSkeletonInJS(imageData: ImageData): Array<Array<[number, number]>> {
  const W = 1000
  const H = 1000

  // 1. 提取灰度
  const gray = new Uint8Array(W * H)
  let darkCount = 0
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    gray[i] = Math.round(0.299*imageData.data[o] + 0.587*imageData.data[o+1] + 0.114*imageData.data[o+2])
    if (gray[i] < 128) darkCount++
  }
  if (darkCount > W*H/2) {
    if (import.meta.env.DEV) console.log('[SkeletonExtraction] Auto-inverting')
    for (let i = 0; i < W*H; i++) gray[i] = 255 - gray[i]
  }

  // 2. 初略二值化 → 检测孔洞 → 分级处理
  const binRough = new Uint8Array(W * H)
  for (let i = 0; i < W*H; i++) binRough[i] = gray[i] < 128 ? 1 : 0
  const holes = countHoles(binRough, W, H)

  // 三级：印刷体(≤50) / 钢笔(50-200) / 毛笔(>200)
  let level: 'print' | 'pen' | 'brush'
  if (holes <= 50) level = 'print'
  else if (holes <= 200) level = 'pen'
  else level = 'brush'

  let binary: Uint8Array
  let spurLen: number
  if (level === 'print') {
    binary = binRough
    spurLen = 12
  } else {
    const blurRadius = level === 'brush' ? 3 : 2
    const closeIter = level === 'brush' ? 6 : 4
    spurLen = level === 'brush' ? 35 : 25
    if (import.meta.env.DEV) console.log(`[SkeletonExtraction] ${level} (holes=${holes}) → blur=${blurRadius} close=${closeIter} spur=${spurLen}`)
    // 高斯模糊（毛笔用更大核半径）
    const blurred = gaussianBlurN(gray, W, H, blurRadius)
    const binBlur = new Uint8Array(W * H)
    for (let i = 0; i < W*H; i++) binBlur[i] = blurred[i] < 128 ? 1 : 0
    binary = morphClose(binBlur, W, H, closeIter)
  }

  // 4. Zhang-Suen 细化
  const thinned = zhangSuenThin(binary, W, H)

  // 5. 毛刺修剪
  const pruned = pruneSpurs(thinned, W, H, spurLen)
  if (import.meta.env.DEV) {
    const n = pruned.reduce((c, v) => c + v, 0)
    console.log(`[SkeletonExtraction] After prune: ${n} pixels`)
  }

  // 6. 追踪骨架为折线段
  const polylines = traceThinnedPixels(pruned, W, H)

  // 保存调试数据
  saveDebugData({
    bitmap: new Uint8Array(thinned),
    width: W,
    height: H,
    polylines: polylines.map(p => p.map(([x, y]) => [x, y] as [number, number])),
  })

  return polylines
}

/**
 * 标准 Zhang-Suen 细化算法
 * 编码：1=前景(ink), 0=背景(paper)
 * 反复剥除可移除的边界像素，直到只剩1像素宽的骨架
 */
/** 高斯模糊：可变半径 r=2→5x5, r=3→7x7 可分离核 */
function gaussianBlurN(gray: Uint8Array, w: number, h: number, r: number): Uint8Array {
  // 预计算核：sigma = r/2, 核大小 = 2*r+1
  const size = 2 * r + 1
  const kernel: number[] = []
  const sigma = r / 2
  for (let i = -r; i <= r; i++) {
    kernel.push(Math.exp(-(i*i)/(2*sigma*sigma)))
  }
  // 归一化
  const kSum = kernel.reduce((a, b) => a + b, 0)
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum

  const tmp = new Float32Array(w * h)
  const out = new Uint8Array(w * h)
  // 水平
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let d = -r; d <= r; d++) {
        const nx = x + d
        if (nx >= 0 && nx < w) s += gray[y*w + nx] * kernel[d + r]
      }
      tmp[y*w + x] = s
    }
  }
  // 竖直
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let d = -r; d <= r; d++) {
        const ny = y + d
        if (ny >= 0 && ny < h) s += tmp[ny*w + x] * kernel[d + r]
      }
      out[y*w + x] = Math.round(s)
    }
  }
  return out
}

/** 检测二值图中孔洞数量（> 50 → 手写体需要预处理） */
function countHoles(bin: Uint8Array, w: number, h: number): number {
  const vis = new Uint8Array(w * h)
  let holes = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y*w + x] === 1 || vis[y*w + x]) continue
      const q: [number, number][] = [[x, y]]
      vis[y*w + x] = 1
      let border = (x === 0 || x === w - 1 || y === 0 || y === h - 1)
      let head = 0
      while (head < q.length) {
        const [cx, cy] = q[head++]
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx+dx, ny = cy+dy
          if (nx<0||nx>=w||ny<0||ny>=h) continue
          if (bin[ny*w+nx]===0 && !vis[ny*w+nx]) {
            vis[ny*w+nx]=1; q.push([nx,ny])
            if (nx===0||nx===w-1||ny===0||ny===h-1) border=true
          }
        }
      }
      if (!border) holes++
    }
  }
  return holes
}

/** 闭运算：膨胀→腐蚀，填充笔画内孔洞 */
function morphClose(bin: Uint8Array, w: number, h: number, iter: number): Uint8Array {
  let src = bin
  for (let t = 0; t < iter; t++) {
    const d = new Uint8Array(w * h)
    for (let y = 1; y < h-1; y++)
      for (let x = 1; x < w-1; x++)
        d[y*w+x] = src[y*w+x]||src[y*w+x-1]||src[y*w+x+1]||src[(y-1)*w+x]||src[(y+1)*w+x]||src[(y-1)*w+x-1]||src[(y-1)*w+x+1]||src[(y+1)*w+x-1]||src[(y+1)*w+x+1] ? 1 : 0
    src = d
  }
  for (let t = 0; t < iter; t++) {
    const e = new Uint8Array(w * h)
    for (let y = 1; y < h-1; y++)
      for (let x = 1; x < w-1; x++)
        e[y*w+x] = src[y*w+x]&&src[y*w+x-1]&&src[y*w+x+1]&&src[(y-1)*w+x]&&src[(y+1)*w+x]&&src[(y-1)*w+x-1]&&src[(y-1)*w+x+1]&&src[(y+1)*w+x-1]&&src[(y+1)*w+x+1] ? 1 : 0
    src = e
  }
  return src
}

function zhangSuenThin(pixels: Uint8Array, w: number, h: number): Uint8Array {
  const result = new Uint8Array(pixels)
  let changed = true
  let iter = 0

  while (changed) {
    changed = false
    iter++
    const toRemove: number[] = []

    // 子迭代 1：南/东边界
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (result[idx] !== 1) continue
        if (zsCheck1(result, x, y, w)) toRemove.push(idx)
      }
    }
    for (const idx of toRemove) { result[idx] = 0; changed = true }

    // 子迭代 2：北/西边界
    toRemove.length = 0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (result[idx] !== 1) continue
        if (zsCheck2(result, x, y, w)) toRemove.push(idx)
      }
    }
    for (const idx of toRemove) { result[idx] = 0; changed = true }

    if (iter > 200) break // 安全上限
  }

  if (import.meta.env.DEV) {
    const remaining = result.reduce((c, v) => c + v, 0)
    console.log(`[SkeletonExtraction] ZS thinning: ${iter} iterations, ${remaining} skeleton pixels remain`)
  }

  return result
}

/** 获取标准 8 邻域（P2..P9 顺时针从上方开始，1=fg, 0=bg） */
function zsNeighbors(p: Uint8Array, x: number, y: number, w: number): number[] {
  return [
    p[(y - 1) * w + x],       // P2: 上
    p[(y - 1) * w + x + 1],   // P3: 右上
    p[y * w + x + 1],         // P4: 右
    p[(y + 1) * w + x + 1],   // P5: 右下
    p[(y + 1) * w + x],       // P6: 下
    p[(y + 1) * w + x - 1],   // P7: 左下
    p[y * w + x - 1],         // P8: 左
    p[(y - 1) * w + x - 1],   // P9: 左上
  ]
}

/** 非零邻居数 B(P1) = 2..6 */
function zsB(n: number[]): number {
  return n.reduce((c, v) => c + v, 0)
}

/** 0→1 转换次数 A(P1) */
function zsA(n: number[]): number {
  let count = 0
  for (let i = 0; i < 8; i++) {
    if (n[i] === 0 && n[(i + 1) % 8] === 1) count++
  }
  return count
}

/** 子迭代1：检查是否可移除 */
function zsCheck1(p: Uint8Array, x: number, y: number, w: number): boolean {
  const n = zsNeighbors(p, x, y, w)
  const b = zsB(n)
  if (b < 2 || b > 6) return false
  if (zsA(n) !== 1) return false
  // P2 * P4 * P6 = 0 (至少一个是背景)
  if (n[0] === 1 && n[2] === 1 && n[4] === 1) return false
  // P4 * P6 * P8 = 0
  if (n[2] === 1 && n[4] === 1 && n[6] === 1) return false
  return true
}

/** 子迭代2：检查是否可移除 */
function zsCheck2(p: Uint8Array, x: number, y: number, w: number): boolean {
  const n = zsNeighbors(p, x, y, w)
  const b = zsB(n)
  if (b < 2 || b > 6) return false
  if (zsA(n) !== 1) return false
  // P2 * P4 * P8 = 0
  if (n[0] === 1 && n[2] === 1 && n[6] === 1) return false
  // P2 * P6 * P8 = 0
  if (n[0] === 1 && n[4] === 1 && n[6] === 1) return false
  return true
}

/**
 * 去除毛刺（spur pruning）
 * 反复移除长度小于 minLen 的分支端点
 */
function pruneSpurs(pixels: Uint8Array, w: number, h: number, minLen: number): Uint8Array {
  const result = new Uint8Array(pixels)
  const dirs = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]
  let changed = true
  let iter = 0

  while (changed && iter < 50) {
    changed = false
    iter++
    const toRemove: number[] = []

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (result[idx] !== 1) continue
        // 只处理端点（1个邻居）
        let nc = 0
        for (const [dx, dy] of dirs) {
          if (result[(y+dy)*w + (x+dx)] === 1) nc++
        }
        if (nc !== 1) continue
        // 追踪到下一个交叉点，计算长度
        let cx = x, cy = y, length = 1
        let px = -1, py = -1 // 上一步
        while (true) {
          let nextX = -1, nextY = -1
          for (const [dx, dy] of dirs) {
            const nx = cx + dx, ny = cy + dy
            if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
                result[ny*w + nx] === 1 && (nx !== px || ny !== py)) {
              nextX = nx; nextY = ny; break
            }
          }
          if (nextX < 0) break
          px = cx; py = cy
          cx = nextX; cy = nextY
          length++
          // 到了交叉点或端点就停
          let nc2 = 0
          for (const [dx, dy] of dirs) {
            if (result[(cy+dy)*w + (cx+dx)] === 1) nc2++
          }
          if (nc2 !== 2) break
        }
        if (length < minLen) toRemove.push(idx)
      }
    }
    for (const idx of toRemove) { result[idx] = 0; changed = true }
  }

  if (import.meta.env.DEV && iter > 1) {
    const remaining = result.reduce((c, v) => c + v, 0)
    console.log(`[SkeletonExtraction] Spur pruning: ${iter} passes, ${remaining} pixels remain`)
  }
  return result
}

/**
 * 将细化后的1像素宽骨架追踪为折线段
 * 编码：1=前景(骨架像素), 0=背景
 */
function traceThinnedPixels(pixels: Uint8Array, w: number, h: number): Array<Array<[number, number]>> {
  const visited = new Uint8Array(w * h)
  const polylines: Array<Array<[number, number]>> = []
  const dirs = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]

  function countFg(x: number, y: number): number {
    let c = 0
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && pixels[ny * w + nx] === 1) c++
    }
    return c
  }

  function isJunctionOrEndpoint(x: number, y: number): boolean {
    return countFg(x, y) !== 2
  }

  function isLoopPixel(x: number, y: number): boolean {
    return countFg(x, y) === 2
  }

  // 从起点追踪，优先保持行进方向（避免锯齿路径）
  function traceFrom(sx: number, sy: number): Array<[number, number]> {
    const path: Array<[number, number]> = [[sx, sy]]
    let cx = sx, cy = sy
    let pdx = 0, pdy = 0 // 上一步方向

    if (countFg(cx, cy) === 2) visited[cy * w + cx] = 1

    while (true) {
      // 按与上一方向接近度排序邻域
      const candidates: [number, number, number][] = [] // [nx, ny, score]
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy
        if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
            pixels[ny * w + nx] === 1 && !visited[ny * w + nx]) {
          // score: 与上一方向点积 (越大越接近)
          const score = pdx * dx + pdy * dy
          candidates.push([nx, ny, score])
        }
      }
      if (candidates.length === 0) break

      // 选方向最接近的
      candidates.sort((a, b) => b[2] - a[2])
      const [nx, ny] = candidates[0]
      pdx = nx - cx; pdy = ny - cy

      cx = nx; cy = ny
      path.push([cx, cy])

      const nc = countFg(cx, cy)
      if (nc === 2) visited[cy * w + cx] = 1
      if (nc !== 2) break
    }

    return path
  }

  // 阶段 1: 从端点开始
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[y * w + x] !== 1 || visited[y * w + x]) continue
      if (countFg(x, y) !== 1) continue // 只从端点开始
      const path = traceFrom(x, y)
      if (path.length >= 8) polylines.push(path)
    }
  }

  // 阶段 2: 从交叉点的未访问出边追踪
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (pixels[idx] !== 1 || visited[idx]) continue
      if (countFg(x, y) < 3) continue // 只处理交叉点

      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
            pixels[ny * w + nx] === 1 && !visited[ny * w + nx]) {
          const rest = traceFrom(nx, ny)
          const full: Array<[number, number]> = [[x, y], ...rest]
          if (full.length >= 8) polylines.push(full)
        }
      }
      visited[idx] = 1 // 所有出边追踪完毕
    }
  }

  // 阶段 3: 闭环
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[y * w + x] !== 1 || visited[y * w + x]) continue
      const path = traceFrom(x, y)
      if (path.length >= 8) polylines.push(path)
    }
  }

  if (import.meta.env.DEV) {
    console.log(`[SkeletonExtraction] Traced ${polylines.length} polylines from thinned skeleton`)
  }
  return polylines
}

