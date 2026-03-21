/**
 * RGBA → 灰度后与阈值比较，得到 0/255 单通道掩码（对齐 OpenCV cvtColor + threshold 120）
 */
export function rgbaToBinaryMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 120,
): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const idx = (j * width + i) * 4
      const r = rgba[idx]
      const g = rgba[idx + 1]
      const b = rgba[idx + 2]
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      // OpenCV THRESH_BINARY: dst = src > thresh ? maxval : 0
      mask[j * width + i] = gray > threshold ? 255 : 0
    }
  }
  return mask
}
