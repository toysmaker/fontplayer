/**
 * 最小 GIF89a 编码器（灰度 256 色 + LZW，流式逐帧写入）
 *
 * 动效导出帧为黑色字形 + 白色背景（黑白预览风格），灰阶调色板无损失。
 * 流式接口逐帧压缩进输出缓冲，不在内存中同时保留全部原始帧，避免内存膨胀。
 */

function appendBytes(target: number[], ...values: number[]) {
  for (const v of values) target.push(v)
}

/** 小端 16 位 */
function le16(target: number[], v: number) {
  target.push(v & 0xff, (v >> 8) & 0xff)
}

/** 单帧 LZW 压缩（GIF 规范：最小码长 8，字典上限 4096，复位码 256，结束码 257） */
function lzwCompress(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  let nextCode = eoiCode + 1
  let codeSize = minCodeSize + 1

  const out: number[] = []
  let bitBuf = 0
  let bitCount = 0

  const writeCode = (code: number) => {
    bitBuf |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      out.push(bitBuf & 0xff)
      bitBuf >>= 8
      bitCount -= 8
    }
  }

  writeCode(clearCode)

  const dict = new Map<string, number>()
  let prefix = ''

  for (let i = 0; i < indices.length; i++) {
    const k = String.fromCharCode(indices[i])
    const key = prefix + k
    if (prefix !== '' && dict.has(key)) {
      prefix = key
    } else {
      if (prefix !== '') {
        writeCode(prefix.length === 1 ? prefix.charCodeAt(0) : dict.get(prefix)!)
        if (nextCode < 4096) {
          dict.set(key, nextCode++)
          if (nextCode > 1 << codeSize) codeSize++
        } else {
          // 字典满：写复位码
          writeCode(clearCode)
          dict.clear()
          nextCode = eoiCode + 1
          codeSize = minCodeSize + 1
        }
      }
      prefix = k
    }
  }
  if (prefix !== '') {
    writeCode(prefix.length === 1 ? prefix.charCodeAt(0) : dict.get(prefix)!)
  }
  writeCode(eoiCode)
  if (bitCount > 0) out.push(bitBuf & 0xff)
  return new Uint8Array(out)
}

export interface GifFrameWriter {
  /** 写入一帧灰度图（0-255，w×h） */
  writeFrame(gray: Uint8Array): void
  /** 结束并返回完整 GIF 字节 */
  finish(): Uint8Array
}

/**
 * 创建流式 GIF 写入器。
 * @param width 帧宽
 * @param height 帧高
 * @param delayCs 帧间隔（百分之一秒）
 * @param loop 是否循环播放
 */
export function createGifWriter(
  width: number,
  height: number,
  delayCs: number,
  loop = true,
): GifFrameWriter {
  const chunks: Uint8Array[] = []

  // Header + LSD + 全局灰阶调色板
  const header: number[] = []
  const ascii = (s: string) => {
    for (let i = 0; i < s.length; i++) header.push(s.charCodeAt(i))
  }
  ascii('GIF89a')
  le16(header, width)
  le16(header, height)
  header.push(0xf7) // GCT 标志 + 8bit 色深 + 256 色
  header.push(0) // 背景色索引 0（白）
  header.push(0) // 像素纵横比
  for (let i = 0; i < 256; i++) header.push(i, i, i) // 灰度渐变
  if (loop) {
    // NETSCAPE2.0 循环扩展
    header.push(0x21, 0xff, 0x0b)
    ascii('NETSCAPE2.0')
    header.push(0x03, 0x01)
    le16(header, 0)
    header.push(0x00)
  }
  chunks.push(new Uint8Array(header))

  let finished = false

  const writeFrame = (gray: Uint8Array) => {
    if (finished) return
    const frame: number[] = []
    // 图形控制扩展（无透明，延迟）
    frame.push(0x21, 0xf9, 0x04, 0x00)
    le16(frame, Math.max(1, Math.round(delayCs)))
    frame.push(0x00, 0x00)
    // 图像描述符（局部色表关闭，使用全局灰阶）
    frame.push(0x2c)
    le16(frame, 0)
    le16(frame, 0)
    le16(frame, width)
    le16(frame, height)
    frame.push(0x00)
    // LZW 最小码长（GIF 规范：图像数据第一字节，必须存在）
    frame.push(8)
    // LZW 数据（子块，每块最大 255 字节）
    const compressed = lzwCompress(gray, 8)
    let pos = 0
    while (pos < compressed.length) {
      const len = Math.min(255, compressed.length - pos)
      frame.push(len)
      for (let i = 0; i < len; i++) frame.push(compressed[pos + i])
      pos += len
    }
    frame.push(0x00) // 块结束
    chunks.push(new Uint8Array(frame))
  }

  const finish = () => {
    if (!finished) {
      finished = true
      chunks.push(new Uint8Array([0x3b])) // trailer
    }
    let total = 0
    for (const c of chunks) total += c.length
    const out = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      out.set(c, off)
      off += c.length
    }
    return out
  }

  return { writeFrame, finish }
}
