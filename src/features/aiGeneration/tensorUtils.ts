/**
 * 图像 ↔ 张量 工具
 *
 * 与 Python 侧 (demo6 sample.py / demo9 infer.py) 的处理一致:
 *   PNG alpha 通道 → 缩放 size×size → alpha>30 → {0,1} float32
 *   模型输出 sigmoid ∈[0,1] → >threshold → 二值 → 放大为画布
 */

/** 骨架 PNG → size×size {0,1} float32 (alpha>30, 与 cv2.INTER_AREA 缩放阈值化等价) */
export async function loadPngAlphaMask(url: string, size: number): Promise<Float32Array> {
  const img = await loadImageFromUrl(url)
  return imageToAlphaMask(img, size)
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`图片加载失败: ${url}`))
    img.src = url
  })
}

/** 任意图片 → size×size {0,1} alpha 二值掩码 */
export function imageToAlphaMask(img: HTMLImageElement, size: number): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  const mask = new Float32Array(size * size)
  for (let i = 0; i < size * size; i++) {
    mask[i] = data[i * 4 + 3] > 30 ? 1 : 0
  }
  return mask
}

/** 批量张量: [N,1,H,W] 拼装为单一 Float32Array */
export function stackMasks(masks: Float32Array[], size: number): { data: Float32Array; dims: number[] } {
  const n = masks.length
  const data = new Float32Array(n * size * size)
  for (let b = 0; b < n; b++) {
    data.set(masks[b], b * size * size)
  }
  return { data, dims: [n, 1, size, size] }
}

/** 风格向量广播: 同一 z 复制 n 份 → [n, dim] */
export function broadcastStyleVec(z: Float32Array, n: number): Float32Array {
  const out = new Float32Array(n * z.length)
  for (let b = 0; b < n; b++) {
    out.set(z, b * z.length)
  }
  return out
}

/**
 * 模型输出 (n,1,size,size) float → 阈值二值 → 放大为 outSize×outSize 画布
 * 画布透明背景 + 黑字, 供 traceHandDrawnImageToPenComponents 直接使用
 */
export function outputTensorToCanvas(
  output: Float32Array,
  size: number,
  outSize: number,
  threshold = 0.5,
): HTMLCanvasElement {
  // 取单张 (调用方按 batch 索引切片传入)
  const up = document.createElement('canvas')
  up.width = size
  up.height = size
  const uctx = up.getContext('2d')!
  const imageData = uctx.createImageData(size, size)
  const px = imageData.data
  for (let i = 0; i < size * size; i++) {
    const v = output[i] > threshold ? 255 : 0
    px[i * 4] = 0
    px[i * 4 + 1] = 0
    px[i * 4 + 2] = 0
    px[i * 4 + 3] = v
  }
  uctx.putImageData(imageData, 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = outSize
  canvas.height = outSize
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, outSize, outSize)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(up, 0, 0, outSize, outSize)
  return canvas
}

/** canvas → Image (供 traceHandDrawnImageToPenComponents 使用) */
export function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画布转图片失败'))
    img.src = canvas.toDataURL('image/png')
  })
}
