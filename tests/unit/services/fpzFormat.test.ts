import { describe, it, expect } from 'vitest'
import { Buffer } from 'node:buffer'
import { gzipSync, gunzipSync } from 'node:zlib'
import { FPZ_MAGIC, FPZ_VERSION, parseFpzBuffer } from '@/features/editor/services/compressedTemplate/fpzFormat'
import { buildFpzHeaderProject, stripCharacterForTemplate } from '@/features/editor/services/compressedTemplate/stripTemplateProject'

describe('fpzFormat', () => {
  it('roundtrips a tiny project', () => {
    const char = {
      uuid: 'char-1',
      type: 'text',
      character: { uuid: 'x', text: '测', unicode: '6d4b' },
      components: [],
      groups: [],
      orderedList: [],
      selectedComponentsUUIDs: [],
      script: 'function script() {\n\t//Todo something\n}',
      view: { zoom: 100, translateX: 0, translateY: 0 },
      info: {},
    }
    const project = {
      version: '2.0',
      file: {
        uuid: 'file-1',
        name: 'Test',
        tag: '字玩默认模板工程',
        width: 1000,
        height: 1000,
        characterList: [char],
        fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200 },
      },
      constants: [],
      stroke_glyphs: [{ uuid: 'sg1', name: '横' }],
    }

    const headerProject = buildFpzHeaderProject(project as Record<string, unknown>)
    const headerWrap = {
      fpzVersion: FPZ_VERSION,
      characterCount: 1,
      project: headerProject,
    }
    const headerBuf = Buffer.from(JSON.stringify(headerWrap), 'utf-8')
    const stripped = stripCharacterForTemplate(char as Record<string, unknown>)
    const chunk = gzipSync(Buffer.from(JSON.stringify(stripped), 'utf-8'), { level: 9 })
    const uuid = String(stripped.uuid)
    const unicode = 0x6d4b
    let tocW = 0
    const tocBuf = Buffer.alloc(512)
    tocBuf.writeUInt32LE(1, tocW)
    tocW += 4
    const ub = Buffer.from(uuid, 'utf-8')
    tocBuf.writeUInt16LE(ub.length, tocW)
    tocW += 2
    ub.copy(tocBuf, tocW)
    tocW += ub.length
    tocBuf.writeUInt32LE(unicode >>> 0, tocW)
    tocW += 4
    tocBuf.writeUInt32LE(0, tocW)
    tocW += 4
    tocBuf.writeUInt32LE(0, tocW)
    tocW += 4
    tocBuf.writeUInt32LE(chunk.length >>> 0, tocW)
    tocW += 4
    const tocSlice = tocBuf.subarray(0, tocW)

    const total = 12 + headerBuf.length + tocSlice.length + chunk.length
    const out = Buffer.alloc(total)
    let w = 0
    for (let i = 0; i < 4; i++) out[w++] = FPZ_MAGIC[i]!
    out.writeUInt32LE(FPZ_VERSION, w)
    w += 4
    out.writeUInt32LE(headerBuf.length, w)
    w += 4
    headerBuf.copy(out, w)
    w += headerBuf.length
    tocSlice.copy(out, w)
    w += tocSlice.length
    chunk.copy(out, w)

    const decoded = parseFpzBuffer(out.buffer.slice(out.byteOffset, out.byteOffset + out.length))
    expect(decoded.characterCount).toBe(1)
    const e = decoded.toc[0]!
    const start = decoded.payloadByteOffset + e.payloadOffset
    const slice = new Uint8Array(decoded.buffer, start, e.compressedLength)
    const round = JSON.parse(gunzipSync(Buffer.from(slice)).toString('utf-8')) as Record<string, unknown>
    expect(round.uuid).toBe('char-1')
    expect(String(round.script || '')).not.toContain('Todo')
  })
})
