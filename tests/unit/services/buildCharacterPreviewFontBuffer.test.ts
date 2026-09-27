/**
 * 信息面板预览：buildCharacterPreviewFontBuffer
 * 单字符 OTF 构建（复用 buildExportFontBuffer 管线），解析后包含目标字符。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parse, hasChar } from '@/fontManager'
import { buildCharacterPreviewFontBuffer } from '@/features/editor/services/ExportFontService'
import {
  createMockFile,
  createMockCharacter,
  createMockPenComponent,
} from '../../helpers/mock-helpers'

describe('buildCharacterPreviewFontBuffer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('构建单字符 OTF 并解析出目标字符', async () => {
    const char = createMockCharacter({
      character: { text: 'A', unicode: 'U+0041' },
      components: [createMockPenComponent()],
    })
    const file = createMockFile({ name: '测试工程' })
    const meta = {
      uuid: char.uuid,
      type: 'text',
      character: { text: 'A', unicode: 'U+0041' },
    }

    const buffer = await buildCharacterPreviewFontBuffer(file, meta as any, char, false)

    expect(buffer.byteLength).toBeGreaterThan(0)
    const parsed = parse(buffer)
    expect(parsed.settings?.unitsPerEm).toBe(1000)
    expect(hasChar(parsed, 'A')).toBe(true)
  })

  it('去除重叠选项同样可构建', async () => {
    const char = createMockCharacter({
      character: { text: 'B', unicode: 'U+0042' },
      components: [createMockPenComponent()],
    })
    const file = createMockFile()
    const meta = {
      uuid: char.uuid,
      type: 'text',
      character: { text: 'B', unicode: 'U+0042' },
    }

    const buffer = await buildCharacterPreviewFontBuffer(file, meta as any, char, true)

    expect(buffer.byteLength).toBeGreaterThan(0)
    expect(hasChar(parse(buffer), 'B')).toBe(true)
  })

  it('无有效编码的字符抛错', async () => {
    const char = createMockCharacter({ character: { text: '?' } })
    const file = createMockFile()
    const meta = { uuid: char.uuid, type: 'text', character: { text: '?', unicode: '' } }

    await expect(
      buildCharacterPreviewFontBuffer(file, meta as any, char, false),
    ).rejects.toThrow('Character has no valid unicode')
  })
})
