/**
 * .fp user project container: FP01 + v1 header JSON + TOC + gzip per-character JSON + optional trailing gzip glyph bundle.
 * Encode uses CompressionStream('gzip'); decode uses DecompressionStream (same as .fpz).
 */

import { gzipDecompressToString, type FpzTocEntry } from '@/features/editor/services/compressedTemplate/fpzFormat'
import { FP_ENCRYPTED_MAGIC, isEncryptedFile, getPrivateKey, decryptFile } from '@/core/encryption'

export const FP_MAGIC = new Uint8Array([0x46, 0x50, 0x30, 0x31]) // "FP01"

export function isFpProjectFile(buffer: ArrayBuffer): boolean {
  const u8 = new Uint8Array(buffer)
  if (u8.length < 4) return false
  let match = true
  for (let i = 0; i < 4; i++) {
    if (u8[i] !== FP_MAGIC[i]) { match = false; break }
  }
  if (match) return true
  for (let i = 0; i < 4; i++) {
    if (u8[i] !== FP_ENCRYPTED_MAGIC[i]) return false
  }
  return true
}
export const FP_FORMAT_VERSION = 1
/** Semantic stripping applied before gzip (matches export pipeline) */
export const FP_FLAG_SEMANTIC_STRIP = 1

export interface FpHeaderWrap {
  fpVersion: number
  characterCount: number
  flags: number
  project: Record<string, unknown>
}

export interface DecodedFpFile {
  version: number
  flags: number
  headerProject: Record<string, unknown>
  characterCount: number
  toc: FpzTocEntry[]
  buffer: ArrayBuffer
  payloadByteOffset: number
  /** Byte offset where trailing glyph gzip starts, or buffer.byteLength if none */
  glyphBundleByteOffset: number
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

export async function gzipCompressBytes(input: Uint8Array): Promise<Uint8Array> {
  const Ctor = (globalThis as unknown as { CompressionStream?: new (f: string) => object }).CompressionStream
  // lib.dom 的 BlobPart 将 Uint8Array 收窄为 ArrayBuffer backing；运行时 Blob 接受任意 TypedArray
  const blob =
    typeof Blob !== 'undefined' ? new Blob([input as unknown as BlobPart]) : null
  if (Ctor && blob && typeof blob.stream === 'function') {
    const cs = new Ctor('gzip') as TransformStream<Uint8Array, Uint8Array>
    const stream = blob.stream().pipeThrough(cs)
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  // Vitest/jsdom: no Blob.stream — use Node zlib (dead code in Vite browser bundle).
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { gzipSync } = await import(/* @vite-ignore */ 'node:zlib')
    const { Buffer } = await import(/* @vite-ignore */ 'node:buffer')
    return new Uint8Array(gzipSync(Buffer.from(input.buffer, input.byteOffset, input.byteLength), { level: 9 }))
  }
  throw new Error('FP: gzip encode not available')
}

/** End of character payload section (exclusive); bytes [end, buffer.length) may be glyph gzip */
export function characterPayloadEnd(decoded: Pick<DecodedFpFile, 'toc' | 'payloadByteOffset'>): number {
  let max = decoded.payloadByteOffset
  for (const e of decoded.toc) {
    const end = decoded.payloadByteOffset + e.payloadOffset + e.compressedLength
    if (end > max) max = end
  }
  return max
}

export function parseFpBuffer(buffer: ArrayBuffer): DecodedFpFile {
  const u8 = new Uint8Array(buffer)
  if (u8.length < 16) throw new Error('FP: file too small')
  for (let i = 0; i < 4; i++) {
    if (u8[i] !== FP_MAGIC[i]) throw new Error('FP: bad magic')
  }
  const dv = new DataView(buffer)
  const ver = readU32(dv, 4)
  if (ver !== FP_FORMAT_VERSION) throw new Error(`FP: unsupported format version ${ver}`)
  const flags = readU32(dv, 8)
  const headerLen = readU32(dv, 12)
  let o = 16
  if (u8.length < o + headerLen) throw new Error('FP: truncated header')
  const headerJson = new TextDecoder('utf-8').decode(u8.subarray(o, o + headerLen))
  o += headerLen
  const headerWrap = JSON.parse(headerJson) as FpHeaderWrap
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
  const glyphBundleByteOffset = characterPayloadEnd({ toc, payloadByteOffset })
  if (glyphBundleByteOffset > u8.length) throw new Error('FP: truncated payload')
  return {
    version: ver,
    flags,
    headerProject: headerWrap.project,
    characterCount: headerWrap.characterCount,
    toc,
    buffer,
    payloadByteOffset,
    glyphBundleByteOffset,
  }
}

/**
 * Parse an FP buffer that may be encrypted (FPE1) or unencrypted (FP01).
 * Automatically decrypts if needed.
 */
export async function parseFpBufferSafe(buffer: ArrayBuffer): Promise<DecodedFpFile> {
  if (isEncryptedFile(buffer)) {
    const privateKey = await getPrivateKey()
    const plaintext = await decryptFile(buffer, privateKey)
    return parseFpBuffer(plaintext)
  }
  return parseFpBuffer(buffer)
}

export { gzipDecompressToString }

export interface GlyphBundle {
  glyphs: unknown[]
  stroke_glyphs: unknown[]
  radical_glyphs: unknown[]
  comp_glyphs: unknown[]
}

export async function decompressGlyphBundleIfPresent(decoded: DecodedFpFile): Promise<GlyphBundle | null> {
  const start = decoded.glyphBundleByteOffset
  const u8full = new Uint8Array(decoded.buffer)
  if (start >= u8full.length) return null
  const tail = u8full.subarray(start)
  const json = await gzipDecompressToString(tail)
  return JSON.parse(json) as GlyphBundle
}

export interface EncodeFpTocMeta {
  uuid: string
  /** From stripped character object */
  unicode: number
}

export interface EncodeFpProjectParams {
  headerWrap: FpHeaderWrap
  characterChunks: Uint8Array[]
  /** Parallel to characterChunks — uuid + unicode for TOC */
  tocMeta: EncodeFpTocMeta[]
  glyphBundleJson: string
}

/**
 * Build per-character TOC entries from gzip sizes (same layout as encodeFpFile).
 */
export function buildFpTocEntries(
  tocMeta: EncodeFpTocMeta[],
  compressedLengths: number[],
): FpzTocEntry[] {
  if (tocMeta.length !== compressedLengths.length) {
    throw new Error('FP encode: tocMeta and compressedLengths length mismatch')
  }
  const toc: FpzTocEntry[] = []
  let payloadOffset = 0
  for (let i = 0; i < compressedLengths.length; i++) {
    const len = compressedLengths[i]!
    const m = tocMeta[i]!
    toc.push({
      uuid: m.uuid,
      unicode: m.unicode >>> 0,
      payloadOffset,
      compressedLength: len >>> 0,
    })
    payloadOffset += len
  }
  return toc
}

/**
 * FP01 … end of TOC (exclusive of character gzip payload). Used by streaming Tauri save.
 */
export function encodeFpHeaderTocPrefix(headerWrap: FpHeaderWrap, toc: FpzTocEntry[]): Uint8Array {
  const headerJson = JSON.stringify(headerWrap)
  const headerBuf = new TextEncoder().encode(headerJson)

  const tocCount = toc.length
  let tocSize = 4
  for (const e of toc) {
    tocSize += 2 + new TextEncoder().encode(e.uuid).length + 4 + 8 + 4
  }

  const headerSection = 16 + headerBuf.length
  const payloadStart = headerSection + tocSize

  const out = new Uint8Array(payloadStart)
  const dv = new DataView(out.buffer)
  let w = 0
  for (let i = 0; i < 4; i++) out[w++] = FP_MAGIC[i]!
  dv.setUint32(w, FP_FORMAT_VERSION, true)
  w += 4
  dv.setUint32(w, headerWrap.flags, true)
  w += 4
  dv.setUint32(w, headerBuf.length, true)
  w += 4
  out.set(headerBuf, w)
  w += headerBuf.length
  dv.setUint32(w, tocCount, true)
  w += 4
  for (const e of toc) {
    const ub = new TextEncoder().encode(e.uuid)
    dv.setUint16(w, ub.length, true)
    w += 2
    out.set(ub, w)
    w += ub.length
    dv.setUint32(w, e.unicode >>> 0, true)
    w += 4
    const off = BigInt(e.payloadOffset)
    dv.setUint32(w, Number(off & 0xffffffffn), true)
    w += 4
    dv.setUint32(w, Number((off >> 32n) & 0xffffffffn), true)
    w += 4
    dv.setUint32(w, e.compressedLength >>> 0, true)
    w += 4
  }
  if (w !== payloadStart) throw new Error(`FP: toc size mismatch ${w} vs ${payloadStart}`)
  return out
}

/**
 * Assemble binary .fp file. Does not hold duplicate character JSON strings — only gzip chunks.
 */
export async function encodeFpFile(params: EncodeFpProjectParams): Promise<ArrayBuffer> {
  const { headerWrap, characterChunks, tocMeta, glyphBundleJson } = params
  if (characterChunks.length !== tocMeta.length) {
    throw new Error('FP encode: characterChunks and tocMeta length mismatch')
  }
  const compressedLengths = characterChunks.map((c) => c.length)
  const toc = buildFpTocEntries(tocMeta, compressedLengths)

  const glyphGzip = await gzipCompressBytes(new TextEncoder().encode(glyphBundleJson))

  let payloadByteLen = 0
  for (const c of characterChunks) payloadByteLen += c.length

  const prefix = encodeFpHeaderTocPrefix(headerWrap, toc)
  const totalLen = prefix.length + payloadByteLen + glyphGzip.length
  const out = new Uint8Array(totalLen)
  out.set(prefix, 0)
  let w = prefix.length
  for (let i = 0; i < characterChunks.length; i++) {
    const chunk = characterChunks[i]!
    out.set(chunk, w)
    w += chunk.length
  }
  out.set(glyphGzip, w)
  return out.buffer
}
