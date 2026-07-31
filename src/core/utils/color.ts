/**
 * 颜色工具函数
 * 提供颜色格式转换功能
 */

/**
 * 将各种常用颜色表示法转换为 #RRGGBB 或 #RRGGBBAA 格式的十六进制字符串。
 *
 * 支持的输入格式：
 * - 十六进制: #RGB, #RRGGBB, #RRGGBBAA
 * - RGB: rgb(255, 0, 0), rgb(255 0 0)
 * - RGBA: rgba(255, 0, 0, 1), rgba(255 0 0 / 1)
 * - HSL: hsl(0, 100%, 50%), hsl(0deg 100% 50%), hsl(0turn 100% 50%), hsl(0rad 100% 50%)
 * - HSLA: hsla(0, 100%, 50%, 0.5), hsla(0deg 100% 50% / 0.5)
 * - CSS 命名颜色: red, blue, transparent 等
 *
 * @param color - 颜色字符串
 * @returns 十六进制颜色字符串，如 #ff0000 或 #ff000080；解析失败时返回空字符串
 */
export function parseColorToHex(color: string): string {
  if (!color) return ''

  const trimmed = color.trim().toLowerCase()

  // 1. 已经是 # 格式
  const hexMatch = trimmed.match(
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/,
  )
  if (hexMatch) {
    return normalizeHex(hexMatch[1])
  }

  // 2. rgb / rgba（兼容浮点数）
  const rgbMatch =
    trimmed.match(
      /^rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*[\s,]\s*(\d+(?:\.\d+)?)\s*[\s,]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/,
    )
  if (rgbMatch) {
    const r = clamp(Math.round(parseFloat(rgbMatch[1])), 0, 255)
    const g = clamp(Math.round(parseFloat(rgbMatch[2])), 0, 255)
    const b = clamp(Math.round(parseFloat(rgbMatch[3])), 0, 255)
    const a = parseAlpha(rgbMatch[4])
    return rgbaToHex(r, g, b, a)
  }

  // 3. hsl / hsla
  const hslMatch = trimmed.match(
    /^hsla?\s*\(\s*([\d.]+)(deg|turn|rad|grad)?\s*[\s,]\s*([\d.]+)%\s*[\s,]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/,
  )
  if (hslMatch) {
    let h = parseFloat(hslMatch[1])
    const hUnit = hslMatch[2] || 'deg'
    h = normalizeHue(h, hUnit)
    const s = clamp(parseFloat(hslMatch[3]), 0, 100) / 100
    const l = clamp(parseFloat(hslMatch[4]), 0, 100) / 100
    const a = parseAlpha(hslMatch[5])
    const [r, g, b] = hslToRgb(h, s, l)
    return rgbaToHex(r, g, b, a)
  }

  // 4. CSS 命名颜色
  const named = NAMED_COLORS[trimmed]
  if (named) {
    return named
  }

  return ''
}

/**
 * 将 0-255 的整数转换为两位十六进制字符串
 */
function toHex(value: number): string {
  const hex = Math.round(clamp(value, 0, 255)).toString(16)
  return hex.length === 1 ? '0' + hex : hex
}

/**
 * 归一化十六进制颜色，将 #RGB 扩展为 #RRGGBB
 */
function normalizeHex(hex: string): string {
  if (hex.length === 3) {
    return '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length === 4) {
    return (
      '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    )
  }
  return '#' + hex
}

/**
 * 将 RGBA 转换为十六进制字符串
 */
function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < 1) {
    const alphaHex = toHex(Math.round(a * 255))
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * 解析 alpha 值，支持百分比和纯数字
 */
function parseAlpha(alphaStr: string | undefined): number {
  if (!alphaStr) return 1
  let alpha: number
  if (alphaStr.endsWith('%')) {
    alpha = parseFloat(alphaStr) / 100
  } else {
    alpha = parseFloat(alphaStr)
  }
  return clamp(alpha, 0, 1)
}

/**
 * 将 HSL 转换为 RGB
 */
function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  h = ((h % 360) + 360) % 360

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (h < 60) {
    r = c; g = x; b = 0
  } else if (h < 120) {
    r = x; g = c; b = 0
  } else if (h < 180) {
    r = 0; g = c; b = x
  } else if (h < 240) {
    r = 0; g = x; b = c
  } else if (h < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

/**
 * 将角度单位统一为度数
 */
function normalizeHue(h: number, unit: string): number {
  switch (unit) {
    case 'turn':
      return h * 360
    case 'rad':
      return (h * 180) / Math.PI
    case 'grad':
      return h * 0.9
    case 'deg':
    default:
      return h
  }
}

/**
 * 将数值钳制在 [min, max] 范围内
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * CSS 常用命名颜色映射表
 */
const NAMED_COLORS: Record<string, string> = {
  transparent: '#00000000',
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  lime: '#00ff00',
  olive: '#808000',
  navy: '#000080',
  teal: '#008080',
  aqua: '#00ffff',
  orange: '#ffa500',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  coral: '#ff7f50',
  gold: '#ffd700',
  indigo: '#4b0082',
  ivory: '#fffff0',
  lavender: '#e6e6fa',
  beige: '#f5f5dc',
  salmon: '#fa8072',
  tan: '#d2b48c',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  plum: '#dda0dd',
  orchid: '#da70d6',
  khaki: '#f0e68c',
  chocolate: '#d2691e',
  crimson: '#dc143c',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgreen: '#006400',
  darkmagenta: '#8b008b',
  darkorange: '#ff8c00',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkviolet: '#9400d3',
  deepskyblue: '#00bfff',
  dodgerblue: '#1e90ff',
  forestgreen: '#228b22',
  hotpink: '#ff69b4',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  lightgreen: '#90ee90',
  lightpink: '#ffb6c1',
  lightyellow: '#ffffe0',
  limegreen: '#32cd32',
  mediumblue: '#0000cd',
  mediumpurple: '#9370db',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  olivedrab: '#6b8e23',
  orangered: '#ff4500',
  palevioletred: '#db7093',
  peachpuff: '#ffdab9',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  seagreen: '#2e8b57',
  sienna: '#a0522d',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  thistle: '#d8bfd8',
  whitesmoke: '#f5f5f5',
  yellowgreen: '#9acd32',
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  bisque: '#ffe4c4',
  blanchedalmond: '#ffebcd',
  blueviolet: '#8a2be2',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  cornsilk: '#fff8dc',
  cornflowerblue: '#6495ed',
  darkgoldenrod: '#b8860b',
  darkkhaki: '#bdb76b',
  darkolivegreen: '#556b2f',
  darkorchid: '#9932cc',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  deeppink: '#ff1493',
  dimgray: '#696969',
  dimgrey: '#696969',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  greenyellow: '#adff2f',
  honeydew: '#f0fff0',
  indianred: '#cd5c5c',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  linen: '#faf0e6',
  mediumaquamarine: '#66cdaa',
  mediumorchid: '#ba55d3',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  oldlace: '#fdf5e6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  papayawhip: '#ffefd5',
  peru: '#cd853f',
  powderblue: '#b0e0e6',
  rebeccapurple: '#663399',
  rosybrown2: '#bc8f8f',
  sandybrown: '#f4a460',
  seashell: '#fff5ee',
  snow: '#fffafa',
  mediumslateblue2: '#7b68ee',
}
