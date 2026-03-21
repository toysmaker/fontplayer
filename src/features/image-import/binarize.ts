/**
 * 黑白二值化（与原版 fontplayer features/image 行为一致）
 */

export interface RgbThresholds {
  r: number
  g: number
  b: number
}

export interface BlackWhiteRegionOptions {
  x: number
  y: number
  /** 区域边长；<0 表示整幅 width×height */
  size: number
  width: number
  height: number
}

/**
 * RGB 通道分别阈值：任一分量大于阈值则视为白，否则黑；alpha 固定为 1（与原版一致）
 */
export function toBlackWhiteBitMap(
  data: Uint8ClampedArray | number[],
  thresholds: RgbThresholds,
  options: BlackWhiteRegionOptions,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(data)
  const { x, y, width, height, size } = options
  let w = size
  let h = size
  if (size < 0) {
    w = width
    h = height
  }
  for (let i = x; i < x + w; i++) {
    for (let j = y; j < y + h; j++) {
      if (i >= width || i < 0) continue
      if (j >= height || j < 0) continue
      const idx = (j * width + i) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      if (r > thresholds.r || g > thresholds.g || b > thresholds.b) {
        pixels[idx] = 255
        pixels[idx + 1] = 255
        pixels[idx + 2] = 255
        pixels[idx + 3] = 1
      } else {
        pixels[idx] = 0
        pixels[idx + 1] = 0
        pixels[idx + 2] = 0
        pixels[idx + 3] = 1
      }
    }
  }
  return pixels
}
