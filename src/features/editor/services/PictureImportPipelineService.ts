/**
 * 图片识别：二值化 → 轮廓 → 归一化多边形 → fitCurve 钢笔
 */

import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import { getBound } from '@/core/utils/math'
import { fitCurve } from '@/core/utils/fitCurve'
import type { IComponent, IGlyphComponent, IPenComponent, IPolygonComponent } from '@/core/types'
import {
  toBlackWhiteBitMap,
  reversePixelsData,
  rgbaToBinaryMask,
  findContoursCCOMP_TS,
  hierarchyParent,
} from '@/features/image-import'
import type { usePictureImportStore } from '@/stores/pictureImport'

type PictureImportStore = ReturnType<typeof usePictureImportStore>

const GRAY_THRESHOLD = 120

function buildThumbnailCanvas(
  img: HTMLImageElement,
  maxEdge: number,
): { canvas: HTMLCanvasElement; pixels: Uint8ClampedArray; width: number; height: number } {
  const canvas = document.createElement('canvas')
  if (img.width > maxEdge || img.height > maxEdge) {
    canvas.width = maxEdge
    canvas.height = (maxEdge * img.height) / img.width
  } else {
    canvas.width = img.width
    canvas.height = img.height
  }
  const ctx = canvas.getContext('2d')!
  // 透明 PNG 在空白 canvas 上会得到 (0,0,0,0)，二值化后整图变黑；先铺白再绘制，与原工程视觉意图一致
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  return { canvas, pixels, width: canvas.width, height: canvas.height }
}

/**
 * 轮廓点与二值图同属「缩略图」像素坐标系；字符画布为 em 方格。
 * 须按整张图宽高线性映射到 em，勿再把「字形紧包围盒」放大到 normSize，否则会比右侧位图大一圈。
 */
function contourToPolygonComponents(
  contours: { x: number; y: number }[][],
  hierarchy: Int32Array,
  picW: number,
  picH: number,
  emW: number,
  emH: number,
): IComponent[] {
  if (picW <= 0 || picH <= 0 || emW <= 0 || emH <= 0) return []
  const sx = emW / picW
  const sy = emH / picH

  const out: IComponent[] = []
  for (let i = 0; i < contours.length; i++) {
    const raw = contours[i]
    if (raw.length < 2) continue

    const transformed: { uuid: string; x: number; y: number }[] = []
    for (const p of raw) {
      transformed.push({ uuid: genUUID(), x: p.x * sx, y: p.y * sy })
    }
    transformed.push({ uuid: genUUID(), x: raw[0].x * sx, y: raw[0].y * sy })

    const { x: _x, y: _y, w: _w, h: _h } = getBound(transformed)

    const fillColor = hierarchyParent(hierarchy, i) === -1 ? '#000' : '#fff'
    const comp: IComponent = {
      uuid: genUUID(),
      type: 'polygon',
      name: 'polygon',
      lock: false,
      visible: true,
      value: {
        points: transformed,
        fillColor,
        strokeColor: '#000',
        closePath: true,
      } as IPolygonComponent,
      x: _x,
      y: _y,
      w: _w,
      h: _h,
      rotation: 0,
      flipX: false,
      flipY: false,
      usedInCharacter: false,
    }
    out.push(comp)
  }
  return out
}

function polygonsToPenCurves(
  polygons: IComponent[],
  maxErr: number,
  drop: number,
): IComponent[] {
  const curves: IComponent[] = []
  for (const contourComponent of polygons) {
    if (contourComponent.type !== 'polygon') continue
    const pts = (contourComponent.value as IPolygonComponent).points as {
      x: number
      y: number
    }[]
    if (pts.length < drop) continue

    const beziers = fitCurve(pts, maxErr)
    if (!beziers.length) continue

    const penPoints: Array<{
      uuid: string
      x: number
      y: number
      type: string
      origin: string | null
      isShow: boolean
    }> = []

    penPoints.push({
      uuid: genUUID(),
      x: beziers[0][0].x,
      y: beziers[0][0].y,
      type: 'anchor',
      origin: null,
      isShow: true,
    })

    for (const bezier of beziers) {
      const uuid2 = genUUID()
      const uuid3 = genUUID()
      const uuid4 = genUUID()
      penPoints.push({
        uuid: uuid2,
        x: bezier[1].x,
        y: bezier[1].y,
        type: 'control',
        origin: penPoints[penPoints.length - 1].uuid,
        isShow: false,
      })
      penPoints.push({
        uuid: uuid3,
        x: bezier[2].x,
        y: bezier[2].y,
        type: 'control',
        origin: uuid4,
        isShow: false,
      })
      penPoints.push({
        uuid: uuid4,
        x: bezier[3].x,
        y: bezier[3].y,
        type: 'anchor',
        origin: null,
        isShow: true,
      })
    }

    const { x: penX, y: penY, w: penW, h: penH } = getBound(penPoints)
    const curveComponent = R.clone(contourComponent)
    curveComponent.uuid = genUUID()
    ;(curveComponent.value as IPenComponent).points = penPoints
    ;(curveComponent.value as IPenComponent).editMode = false
    curveComponent.type = 'pen'
    curveComponent.name = 'pic-contour'
    curveComponent.x = penX
    curveComponent.y = penY
    curveComponent.w = penW
    curveComponent.h = penH
    curveComponent.rotation = 0
    curveComponent.usedInCharacter = true
    curves.push(curveComponent)
  }
  return curves
}

export const PictureImportPipelineService = {
  /**
   * 解码后的图片：缩略图、bitmap、轮廓、曲线写入 store
   */
  bootstrapFromImage(store: PictureImportStore, dataUrl: string, img: HTMLImageElement, thumbnailMax = 1000) {
    const { canvas, pixels, width, height } = buildThumbnailCanvas(img, thumbnailMax)
    const processCopy = new Uint8ClampedArray(pixels)
    store.setEditCharacterPic({
      dataUrl,
      img,
      thumbnailCanvas: canvas,
      thumbnailPixels: pixels,
      processPixels: processCopy,
      width,
      height,
    })

    const bw = toBlackWhiteBitMap(
      store.editCharacterPic!.thumbnailPixels!,
      {
        r: store.rThreshold,
        g: store.gThreshold,
        b: store.bThreshold,
      },
      { x: 0, y: 0, size: -1, width, height },
    )
    store.setBitMap({ data: bw, width, height })
    // processPixels 保持为缩略图 RGBA，与原版一致；阈值变化时由 rebuild 再 toBlackWhiteBitMap

    this.rebuildContoursAndCurves(store)
  },

  /**
   * 与 FontPicEditPanel.setAllElements + setCurves 等价；轮廓点按缩略图→em 线性映射（importEmWidth/Height）
   */
  rebuildContoursAndCurves(store: PictureImportStore) {
    const pic = store.editCharacterPic
    if (!pic?.thumbnailCanvas || !pic.processPixels) return

    const w = pic.width
    const h = pic.height
    let pixels: Uint8ClampedArray
    if (!store.enableLocalBrush) {
      pixels = toBlackWhiteBitMap(
        pic.processPixels,
        { r: store.rThreshold, g: store.gThreshold, b: store.bThreshold },
        { x: 0, y: 0, size: -1, width: w, height: h },
      )
    } else {
      pixels = pic.processPixels as Uint8ClampedArray
    }

    store.setBitMap({ data: pixels, width: w, height: h })

    const reversed = reversePixelsData(pixels, w, h)
    const mask = rgbaToBinaryMask(reversed, w, h, GRAY_THRESHOLD)
    const { contours, hierarchy } = findContoursCCOMP_TS(mask, w, h)

    const polys = contourToPolygonComponents(
      contours,
      hierarchy,
      w,
      h,
      store.importEmWidth,
      store.importEmHeight,
    )
    store.setContoursComponents(polys)

    const curves = polygonsToPenCurves(polys, store.maxError, store.dropThreshold)
    store.setCurvesComponents(curves)
  },

  /** 仅按当前多边形重新拟合曲线（阈值不变） */
  rebuildCurvesOnly(store: PictureImportStore) {
    const polys = store.contoursComponents
    const curves = polygonsToPenCurves(polys, store.maxError, store.dropThreshold)
    store.setCurvesComponents(curves)
  },

  /**
   * 测试手绘模板等批处理场景：从解码后的位图走与 Pic 导入相同的
   * 二值化 → findContoursCCOMP_TS → 多边形 → fitCurve 钢笔链路（非 OpenCV）。
   * 对齐原工程 thumbnail + curvesComponents 过滤（总折线长、maxError）。
   */
  traceHandDrawnImageToPenComponents(
    img: HTMLImageElement,
    options: Partial<{
      thumbnailMax: number
      rThreshold: number
      gThreshold: number
      bThreshold: number
      maxError: number
      dropThreshold: number
      importEmWidth: number
      importEmHeight: number
      minPolylineLength: number
    }> = {},
  ): IGlyphComponent[] {
    const thumbnailMax = options.thumbnailMax ?? 1000
    const r = options.rThreshold ?? 128
    const g = options.gThreshold ?? 128
    const b = options.bThreshold ?? 128
    const maxErr = options.maxError ?? 5
    const drop = options.dropThreshold ?? 4
    const emW = options.importEmWidth ?? 1000
    const emH = options.importEmHeight ?? 1000
    const minLen = options.minPolylineLength ?? 200

    const { pixels, width, height } = buildThumbnailCanvas(img, thumbnailMax)
    const bw = toBlackWhiteBitMap(pixels, { r, g, b }, { x: 0, y: 0, size: -1, width, height })
    const reversed = reversePixelsData(bw, width, height)
    const mask = rgbaToBinaryMask(reversed, width, height, GRAY_THRESHOLD)
    const { contours, hierarchy } = findContoursCCOMP_TS(mask, width, height)
    const polys = contourToPolygonComponents(contours, hierarchy, width, height, emW, emH)
    const curves = polygonsToPenCurves(polys, maxErr, drop) as IGlyphComponent[]

    return curves.filter((component) => {
      const points = (component.value as IPenComponent).points
      if (!points?.length) return false
      let totalLength = 0
      let last = points[0]
      for (let j = 1; j < points.length; j++) {
        const p = points[j]
        totalLength += Math.hypot(p.x - last.x, p.y - last.y)
        last = p
      }
      return totalLength > minLen
    })
  },

  /** 重置 RGB 阈值与 processPixels 为缩略图原图，并重建轮廓/曲线 */
  reloadThumbnailDefaults(store: PictureImportStore) {
    const pic = store.editCharacterPic
    if (!pic?.thumbnailPixels) return
    store.rThreshold = 128
    store.gThreshold = 128
    store.bThreshold = 128
    store.enableLocalBrush = false
    const copy = new Uint8ClampedArray(pic.thumbnailPixels)
    store.setEditCharacterPic({ ...pic, processPixels: copy })
    this.rebuildContoursAndCurves(store)
  },
}
