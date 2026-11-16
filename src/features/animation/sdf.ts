/**
 * 动效渲染度量与颜色工具
 * （SDF 像素管线已移除：预览/导出改为编辑管线矢量渲染，见 vectorRender.ts）
 */

export interface SdfMetrics {
  unitsPerEm: number
  descender: number
  advanceWidth: number
}

/** hex 颜色转 RGB 分量（支持 #rgb / #rrggbb） */
export function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '#000').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full || '000000', 16)
  if (isNaN(num)) return [0, 0, 0]
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}
