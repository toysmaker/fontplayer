/**
 * 工具坐标转换工具函数
 * 参考原工程 src/utils/canvas.ts 的 getCoord 实现
 */

import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'

const default_unitsPerEm = 1000
const default_width = 500 // 原工程中 width.value 默认值为 500

/**
 * 将canvas坐标转换为逻辑坐标
 * 参考原工程 getCoord 实现
 * 需要考虑 zoom 的影响：当 zoom 改变时，canvas 显示尺寸 = 500 * zoom / 100
 * 所以需要将 offsetX 归一化：normalizedOffsetX = offsetX * 100 / zoom
 */
export function getCoord(coord: number, mode: 'character' | 'glyph', zoom: number = 100): number {
  const projectStore = useProjectStore()
  
  // 归一化到固定显示尺寸（500），考虑 zoom
  // 当 zoom 改变时，canvas 显示尺寸 = 500 * zoom / 100
  // 所以需要将 coord 归一化：normalizedCoord = coord * 100 / zoom
  const normalizedCoord = (coord * 100) / zoom
  
  if (mode === 'character') {
    // 字符编辑模式
    if (projectStore.selectedFile) {
      return normalizedCoord / default_width * projectStore.selectedFile.width
    }
  } else if (mode === 'glyph') {
    // 字形编辑模式
    return normalizedCoord / default_width * default_unitsPerEm
  }
  
  return normalizedCoord
}
