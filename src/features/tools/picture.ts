/**
 * 图片组件生成工具
 */

import type { IComponent } from '@/core/types'
import { genUUID } from '@/utils/uuid'

function toPixels(img: HTMLImageElement): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, img.width, img.height)
  return ctx.getImageData(0, 0, img.width, img.height).data
}

export async function genPictureComponent(
  data: string,
  maxWidth: number,
  maxHeight: number,
): Promise<IComponent> {
  return new Promise((resolve, reject) => {
    const originImg = document.createElement('img')
    originImg.onload = () => {
      let w = originImg.width
      let h = originImg.height
      if (w > maxWidth || h > maxHeight) {
        if (h / maxHeight > w / maxWidth) {
          h = maxHeight
          w = (originImg.width / originImg.height) * h
        } else {
          w = maxWidth
          h = (originImg.height / originImg.width) * w
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(originImg, 0, 0, originImg.width, originImg.height, 0, 0, w, h)
      const img = document.createElement('img')
      const imgData = canvas.toDataURL()
      img.onload = () => {
        const pixels = toPixels(img)
        resolve({
          uuid: genUUID(),
          type: 'picture',
          name: 'picture',
          lock: false,
          visible: true,
          value: {
            data: imgData,
            img,
            pixels,
            originImg,
            pixelMode: false,
          },
          x: 0,
          y: 0,
          w,
          h,
          rotation: 0,
          flipX: false,
          flipY: false,
          opacity: 0.5,
          usedInCharacter: false,
        })
      }
      img.onerror = () => reject(new Error('Failed to load scaled image'))
      img.src = imgData
    }
    originImg.onerror = () => reject(new Error('Failed to load origin image'))
    originImg.src = data
  })
}
