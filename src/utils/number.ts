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
