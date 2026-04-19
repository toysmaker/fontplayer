import { describe, it, expect } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import {
  characterPayloadEnd,
  encodeFpFile,
  buildFpTocEntries,
  encodeFpHeaderTocPrefix,
  gzipCompressBytes,
  parseFpBuffer,
  isFpProjectFile,
  FP_MAGIC,
} from '@/features/editor/services/projectArchive/fpProjectFormat'
import { buildFpzHeaderProject, stripCharacterForTemplate } from '@/features/editor/services/compressedTemplate/stripTemplateProject'

describe('fpProjectFormat', () => {
  it('roundtrips a tiny .fp project with glyph bundle', async () => {
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
        tag: 'test',
        width: 1000,
        height: 1000,
        characterList: [char],
        fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200 },
      },
      constants: [],
      glyphs: [{ uuid: 'g1', name: 'a' }],
      stroke_glyphs: [{ uuid: 'sg1', name: '横' }],
      radical_glyphs: [],
      comp_glyphs: [],
    }

    const headerProject = buildFpzHeaderProject(project as Record<string, unknown>)
    const stripped = stripCharacterForTemplate(char as Record<string, unknown>)
    const gz = await gzipCompressBytes(new TextEncoder().encode(JSON.stringify(stripped)))
    const headerWrap = {
      fpVersion: 1,
      characterCount: 1,
      flags: 1,
      project: headerProject,
    }
    const glyphBundleJson = JSON.stringify({
      glyphs: project.glyphs,
      stroke_glyphs: project.stroke_glyphs,
      radical_glyphs: project.radical_glyphs,
      comp_glyphs: project.comp_glyphs,
    })
    const buf = await encodeFpFile({
      headerWrap,
      characterChunks: [gz],
      tocMeta: [{ uuid: String(stripped.uuid), unicode: 0x6d4b }],
      glyphBundleJson,
    })

    expect(isFpProjectFile(buf)).toBe(true)
    expect(new Uint8Array(buf, 0, 4)).toEqual(FP_MAGIC)

    const decoded = parseFpBuffer(buf)
    expect(decoded.characterCount).toBe(1)
    const e = decoded.toc[0]!
    const start = decoded.payloadByteOffset + e.payloadOffset
    const slice = new Uint8Array(decoded.buffer, start, e.compressedLength)
    const roundChar = JSON.parse(gunzipSync(Buffer.from(slice)).toString('utf-8')) as Record<string, unknown>
    expect(String(roundChar.uuid)).toBe('char-1')
    expect(String(roundChar.script || '')).not.toContain('Todo')

    const end = characterPayloadEnd(decoded)
    const tail = new Uint8Array(decoded.buffer, end)
    const bundle = JSON.parse(gunzipSync(Buffer.from(tail)).toString('utf-8')) as { glyphs: { uuid: string }[] }
    expect(bundle.glyphs[0]!.uuid).toBe('g1')
  })

  it('buildFpTocEntries + encodeFpHeaderTocPrefix + payload + glyph matches encodeFpFile bytes', async () => {
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
        tag: 'test',
        width: 1000,
        height: 1000,
        characterList: [char],
        fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200 },
      },
      constants: [],
      glyphs: [{ uuid: 'g1', name: 'a' }],
      stroke_glyphs: [{ uuid: 'sg1', name: '横' }],
      radical_glyphs: [],
      comp_glyphs: [],
    }

    const headerProject = buildFpzHeaderProject(project as Record<string, unknown>)
    const stripped = stripCharacterForTemplate(char as Record<string, unknown>)
    const gz = await gzipCompressBytes(new TextEncoder().encode(JSON.stringify(stripped)))
    const headerWrap = {
      fpVersion: 1,
      characterCount: 1,
      flags: 1,
      project: headerProject,
    }
    const tocMeta = [{ uuid: String(stripped.uuid), unicode: 0x6d4b }]
    const glyphBundleJson = JSON.stringify({
      glyphs: project.glyphs,
      stroke_glyphs: project.stroke_glyphs,
      radical_glyphs: project.radical_glyphs,
      comp_glyphs: project.comp_glyphs,
    })

    const bufFull = await encodeFpFile({
      headerWrap,
      characterChunks: [gz],
      tocMeta,
      glyphBundleJson,
    })

    const toc = buildFpTocEntries(tocMeta, [gz.length])
    const prefix = encodeFpHeaderTocPrefix(headerWrap, toc)
    const glyphGzip = await gzipCompressBytes(new TextEncoder().encode(glyphBundleJson))
    const assembled = new Uint8Array(prefix.length + gz.length + glyphGzip.length)
    assembled.set(prefix, 0)
    assembled.set(gz, prefix.length)
    assembled.set(glyphGzip, prefix.length + gz.length)

    expect(new Uint8Array(bufFull)).toEqual(assembled)
  })
})
