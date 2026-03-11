/**
 * Canvas 工具函数
 */
// 线条宽度相关常量
const strokeWidthRatio = 2.0 // 显示系数
const strokeWidth = 10.0 // 基础线条宽度

// 获取当前设备的线条宽度
export function getStrokeWidth(): number {
  return strokeWidthRatio * strokeWidth / (window.devicePixelRatio || 1)
}
