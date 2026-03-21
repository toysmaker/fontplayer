/**
 * 反色（与原版 fillRect 逐像素一致），便于单测与管线；不依赖 Canvas 读回
 */
export function reversePixelsData(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const index = (j * width + i) * 4
      out[index] = 255 - pixels[index]
      out[index + 1] = 255 - pixels[index + 1]
      out[index + 2] = 255 - pixels[index + 2]
      out[index + 3] = 255 - pixels[index + 3]
    }
  }
  return out
}

/**
 * 反色（与原版一致），返回新像素与 canvas（UI 预览可用）
 */
export function reversePixels(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
): { pixels: Uint8ClampedArray; canvas: HTMLCanvasElement } {
  const data = reversePixelsData(pixels, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(data, width, height), 0, 0)
  return { pixels: data, canvas }
}
