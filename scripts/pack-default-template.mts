/**
 * Pack data_processing_scripts/data/字玩内置模板.json → src-tauri/resources/default-template.fpz
 *
 * 不在 Tauri/npm build 中自动执行；更新模板后请在 fontplayer_refactor 根目录手动运行: npm run pack:template
 *
 * FONTPLAYER_TEMPLATE_SOURCE — override input path
 * FONTPLAYER_FPZ_OUTPUT — override output path
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { Buffer } from 'node:buffer'

import {
  buildFpzHeaderProject,
  stripCharacterForTemplate,
  unicodeToCodePoint,
} from '../src/features/editor/services/compressedTemplate/stripTemplateProject.ts'
import { FPZ_MAGIC, FPZ_VERSION, type FpzTocEntry } from '../src/features/editor/services/compressedTemplate/fpzFormat.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const defaultInput = join(repoRoot, '..', 'data_processing_scripts', 'data', '字玩内置模板.json')
const defaultOutput = join(repoRoot, 'src-tauri', 'resources', 'default-template.fpz')

const inputPath = process.env.FONTPLAYER_TEMPLATE_SOURCE || defaultInput
const outputPath = process.env.FONTPLAYER_FPZ_OUTPUT || defaultOutput

function gzipChunk(buf: Buffer): Buffer {
  return gzipSync(buf, { level: 9 })
}

function buildFpz(project: Record<string, unknown>): Buffer {
  const list = ((project.file as Record<string, unknown>)?.characterList as unknown[]) || []
  const headerProject = buildFpzHeaderProject(project)
  const headerWrap = {
    fpzVersion: FPZ_VERSION,
    characterCount: list.length,
    project: headerProject,
  }
  const headerJson = JSON.stringify(headerWrap)
  const headerBuf = Buffer.from(headerJson, 'utf-8')

  const chunks: Buffer[] = []
  const toc: FpzTocEntry[] = []
  let payloadOffset = 0
  for (const raw of list) {
    const stripped = stripCharacterForTemplate(raw as Record<string, unknown>)
    const json = JSON.stringify(stripped)
    const compressed = gzipChunk(Buffer.from(json, 'utf-8'))
    toc.push({
      uuid: String(stripped.uuid ?? ''),
      unicode: unicodeToCodePoint(stripped),
      payloadOffset,
      compressedLength: compressed.length,
    })
    chunks.push(compressed)
    payloadOffset += compressed.length
  }

  const tocCount = toc.length
  let tocSize = 4
  for (const e of toc) {
    tocSize += 2 + Buffer.from(e.uuid, 'utf-8').length + 4 + 8 + 4
  }

  const headerSection = 12 + headerBuf.length
  const payloadStart = headerSection + tocSize
  const totalLen = payloadStart + payloadOffset
  const out = Buffer.alloc(totalLen)
  let w = 0
  for (let i = 0; i < 4; i++) out[w++] = FPZ_MAGIC[i]!
  out.writeUInt32LE(FPZ_VERSION, w)
  w += 4
  out.writeUInt32LE(headerBuf.length, w)
  w += 4
  headerBuf.copy(out, w)
  w += headerBuf.length
  out.writeUInt32LE(tocCount, w)
  w += 4
  for (const e of toc) {
    const ub = Buffer.from(e.uuid, 'utf-8')
    out.writeUInt16LE(ub.length, w)
    w += 2
    ub.copy(out, w)
    w += ub.length
    out.writeUInt32LE(e.unicode >>> 0, w)
    w += 4
    const off = BigInt(e.payloadOffset)
    out.writeUInt32LE(Number(off & 0xffffffffn), w)
    w += 4
    out.writeUInt32LE(Number((off >> 32n) & 0xffffffffn), w)
    w += 4
    out.writeUInt32LE(e.compressedLength >>> 0, w)
    w += 4
  }
  if (w !== payloadStart) throw new Error(`FPZ: toc size mismatch ${w} vs ${payloadStart}`)
  for (const chunk of chunks) {
    chunk.copy(out, w)
    w += chunk.length
  }
  return out
}

console.log('[pack-default-template] input:', inputPath)
console.log('[pack-default-template] output:', outputPath)

const raw = readFileSync(inputPath, 'utf-8')
const project = JSON.parse(raw) as Record<string, unknown>
mkdirSync(dirname(outputPath), { recursive: true })
const fpz = buildFpz(project)
writeFileSync(outputPath, fpz)
console.log('[pack-default-template] wrote', fpz.length, 'bytes')
