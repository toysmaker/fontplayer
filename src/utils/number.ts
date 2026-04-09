/**
 * 数值处理工具函数
 */

/**
 * 限制数值精度，保留指定小数位数
 * @param value 要处理的数值
 * @param precision 保留的小数位数，默认为1
 * @returns 处理后的数值
 * 
 * @example
 * roundToPrecision(123.456789, 1) // 123.5
 * roundToPrecision(123.456789, 2) // 123.46
 */
export const roundToPrecision = (value: number, precision: number = 1): number => {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

/**
 * 字形参数 UI / 存储共用的小数位规则：max 存在且 ≤10 时保留 2 位小数，否则为整数。
 * 与 GlyphEditPanel 中 n-input-number 的 precision 一致。
 */
export function precisionFromParamMax(max?: number): number {
  return max != null && max <= 10 ? 2 : 0
}
