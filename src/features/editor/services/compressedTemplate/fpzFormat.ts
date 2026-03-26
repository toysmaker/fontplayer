/**
 * .fpz container: FPZ1 + v1 header JSON + TOC + gzip-compressed per-character JSON payload.
 * Pack uses Node gzipSync; runtime uses native DecompressionStream('gzip') (no extra deps).
 */

export const FPZ_MAGIC = new Uint8Array([0x46, 0x50, 0x5a, 0x31])
export const FPZ_VERSION = 1

export interface FpzTocEntry {
  uuid: string
  unicode: number
  /** Byte offset from start of payload section */
  payloadOffset: number
  compressedLength: number
}

export interface DecodedFpz {
  headerProject: Record<string, unknown>
  characterCount: number
  toc: FpzTocEntry[]
  /** Entire file buffer; payload slice views reference this */
  buffer: ArrayBuffer
  payloadByteOffset: number
}

function readU32(dv: DataView, o: number): number {
  return dv.getUint32(o, true)
}

function readU16(dv: DataView, o: number): number {
  return dv.getUint16(o, true)
}

function readU64(dv: DataView, o: number): bigint {
  const lo = dv.getUint32(o, true)
  const hi = dv.getUint32(o + 4, true)
  return BigInt(lo) + (BigInt(hi) << 32n)
}

/** Decompress one gzip chunk (Web DecompressionStream) */
export async function gzipDecompressToString(compressed: Uint8Array): Promise<string> {
  const Ctor = (globalThis as unknown as { DecompressionStream?: new (f: string) => TransformStream }).DecompressionStream
  if (!Ctor) {
    throw new Error('FPZ: DecompressionStream (gzip) is not available')
  }
  const ds = new Ctor('gzip')
  const stream = new Blob([compressed]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new TextDecoder('utf-8').decode(buf)
}

export function parseFpzBuffer(buffer: ArrayBuffer): DecodedFpz {
  const u8 = new Uint8Array(buffer)
  if (u8.length < 12) throw new Error('FPZ: file too small')
  for (let i = 0; i < 4; i++) {
    if (u8[i] !== FPZ_MAGIC[i]) throw new Error('FPZ: bad magic')
  }
  const dv = new DataView(buffer)
  const ver = readU32(dv, 4)
  if (ver !== FPZ_VERSION) throw new Error(`FPZ: unsupported version ${ver}`)
  const headerLen = readU32(dv, 8)
  let o = 12
  if (u8.length < o + headerLen) throw new Error('FPZ: truncated header')
  const headerJson = new TextDecoder('utf-8').decode(u8.subarray(o, o + headerLen))
  o += headerLen
  const headerWrap = JSON.parse(headerJson) as {
    fpzVersion: number
    characterCount: number
    project: Record<string, unknown>
  }
  const tocCount = readU32(dv, o)
  o += 4
  const toc: FpzTocEntry[] = []
  for (let i = 0; i < tocCount; i++) {
    const uuidLen = readU16(dv, o)
    o += 2
    const uuid = new TextDecoder('utf-8').decode(u8.subarray(o, o + uuidLen))
    o += uuidLen
    const unicode = readU32(dv, o)
    o += 4
    const payloadOffset = Number(readU64(dv, o))
    o += 8
    const compressedLength = readU32(dv, o)
    o += 4
    toc.push({ uuid, unicode, payloadOffset, compressedLength })
  }
  const payloadByteOffset = o
  return {
    headerProject: headerWrap.project,
    characterCount: headerWrap.characterCount,
    toc,
    buffer,
    payloadByteOffset,
  }
}

export async function decompressCharacterAt(
  decoded: DecodedFpz,
  index: number,
): Promise<Record<string, unknown>> {
  const e = decoded.toc[index]
  if (!e) throw new Error(`FPZ: bad toc index ${index}`)
  const start = decoded.payloadByteOffset + e.payloadOffset
  const u8 = new Uint8Array(decoded.buffer, start, e.compressedLength)
  const json = await gzipDecompressToString(u8)
  return JSON.parse(json) as Record<string, unknown>
}
