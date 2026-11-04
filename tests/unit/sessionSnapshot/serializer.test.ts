import { describe, it, expect } from 'vitest'
import { buildFileSections, stripGlyphArray, stripGlyphComponents } from '@/features/sessionSnapshot/snapshotSerializer'
import { extractFileUUIDFromSnapshotKey, buildFileSnapshotKeys } from '@/features/sessionSnapshot/keys'
import type { IFile } from '@/core/types'

describe('sessionSnapshot serializer', () => {
  it('stripGlyphArray 剥离运行时字段（_o / previewRef / contourRef / value.contour 等）', () => {
    const circular: any = { name: 'x' }
    circular._o = circular // 循环引用
    const glyphs = [
      {
        uuid: 'g1',
        _o: { instance: true },
        previewRef: 'preview_g1',
        contourRef: 'contour_g1',
        components: [
          {
            type: 'pen',
            value: {
              contour: [{ points: [] }],
              preview: [{ points: [] }],
              contour2: [{ points: [] }],
              _o: { instance: true },
            },
          },
          {
            type: 'glyph',
            value: {
              components: [{ type: 'pen', value: { contour: [{ points: [] }] } }],
            },
          },
        ],
      },
    ]
    const clean = stripGlyphArray(glyphs)
    expect(clean[0]._o).toBeUndefined()
    expect(clean[0].previewRef).toBeUndefined()
    expect(clean[0].contourRef).toBeUndefined()
    expect(clean[0].components[0].value.contour).toBeUndefined()
    expect(clean[0].components[0].value.preview).toBeUndefined()
    expect(clean[0].components[0].value.contour2).toBeUndefined()
    expect(clean[0].components[0].value._o).toBeUndefined()
    expect(clean[0].components[1].value.components[0].value.contour).toBeUndefined()
  })

  it('stripGlyphComponents 对循环引用不抛错', () => {
    const circular: any = { type: 'pen', value: {} }
    circular._o = circular
    expect(() => stripGlyphComponents([circular])).not.toThrow()
  })

  it('buildFileSections 分节序列化且预算超时返回 null', () => {
    const file = {
      uuid: 'f1',
      name: 't',
      width: 1000,
      height: 1000,
      saved: false,
      characterList: [{ uuid: 'c1', type: 'character', character: { uuid: 'ch1', text: '一', unicode: 'U+4E00' } }],
      glyphs: [{ uuid: 'g1', name: 'g' }],
      constants: [{ name: 'c', value: 1 }],
    } as unknown as IFile

    const sections = buildFileSections(file, 1000)
    expect(sections.meta).toBeTruthy()
    expect(sections.chars).toBeTruthy()
    expect(sections.glyphs).toBeTruthy()
    expect(sections.constants).toBeTruthy()

    // 预算为 0：第一节之后全部放弃（null）
    const sections2 = buildFileSections(file, 0)
    expect(sections2.meta).toBeNull()
  })

  it('键构建与 uuid 提取对称', () => {
    const keys = buildFileSnapshotKeys('uuid-123')
    for (const k of Object.values(keys)) {
      expect(extractFileUUIDFromSnapshotKey(k)).toBe('uuid-123')
    }
    expect(extractFileUUIDFromSnapshotKey('ss_meta')).toBeNull()
    expect(extractFileUUIDFromSnapshotKey('character_other_key')).toBeNull()
  })
})
