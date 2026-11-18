/**
 * unicode 解析工具：兼容字符串（'U+4E00' / '0x4E00' / '4E00'）与数字（27979）两种格式。
 * 部分工程数据（旧格式/夹具）中 character.unicode 为数字，直接调字符串 API 会抛错。
 */

export function unicodeToCode(unicode: string | number): number {
  if (typeof unicode === 'number') return unicode
  const hex = unicode.replace(/^U\+/i, '').replace(/^0x/i, '').trim()
  const value = parseInt(hex, 16)
  return Number.isNaN(value) ? 0 : value
}

export function unicodeToHexString(unicode: string | number): string {
  return `U+${unicodeToCode(unicode).toString(16).toUpperCase()}`
}
