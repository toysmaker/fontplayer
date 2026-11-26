/**
 * 度量工具栏 hydrate 链路集成测试：
 * 真实字库导入数据（buildCharacterFilesFromParsedFont 产出）→ 放入 character store →
 * 调用 metrics 草稿 store 的 hydrateFromEditingCharacter → 断言度量工具栏显示字体真实值。
 * 用于回归「导入字符度量工具栏显示默认值 1000/0」问题。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createPinia, setActivePinia } from 'pinia'
import { parse } from '@/fontManager'
import {
  buildCharacterFilesFromParsedFont,
  resolveImportFontMetrics,
} from '@/features/editor/services/FontLibraryImportService'

const FONT_PATH = join(homedir(), 'Documents', '字体测试', '山海国潮 45W.ttf')

describe('import metrics resolution', () => {
  it('centers em box vertically when it exceeds 1000', () => {
    // 思源黑体：asc 1160 / desc -288，em 盒 1448 > 1000 → 垂直居中 desc' = (1160-288-1000)/2 = -64
    const sh = resolveImportFontMetrics({ unitsPerEm: 1000, ascender: 1160, descender: -288 })
    expect(sh).toEqual({ scale: 1, ascender: 1160, descender: -64 })

    // 常规字体 em 盒 ≤ 1000 保持原 descender
    const normal = resolveImportFontMetrics({ unitsPerEm: 1000, ascender: 850, descender: -150 })
    expect(normal).toEqual({ scale: 1, ascender: 850, descender: -150 })
    const appDefault = resolveImportFontMetrics({ unitsPerEm: 1000, ascender: 800, descender: -200 })
    expect(appDefault).toEqual({ scale: 1, ascender: 800, descender: -200 })

    // 2048 upm 字体整体缩放，em 盒恰好 1000 → descender 仅缩放不居中
    const skia = resolveImportFontMetrics({ unitsPerEm: 2048, ascender: 1591, descender: -457 })
    expect(skia.scale).toBeCloseTo(1000 / 2048, 10)
    expect(skia.ascender).toBe(Math.round(1591 * (1000 / 2048)))
    expect(skia.descender).toBe(Math.round(-457 * (1000 / 2048)))
  })
})

describe('metrics toolbar hydration with imported data', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it.skipIf(!existsSync(FONT_PATH))(
    'draft store shows the font real advanceWidth/lsb after hydrate',
    { timeout: 120_000 },
    async () => {
      setActivePinia(createPinia())
      const buffer = readFileSync(FONT_PATH)
      const font = parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)

      // 测试 'a'（lsb=0）与 '1'（lsb=27）：度量差异大，最能暴露问题
      const letters = ['a', '1']
        .map((t) => font.characters.find((c: any) => String.fromCodePoint(c.unicode) === t))
        .filter(Boolean)

      const { useProjectStore } = await import('@/stores/project')
      const { useCharacterStore } = await import('@/stores/character')
      const { useCharacterMetricsDraftStore } = await import('@/stores/characterMetricsDraft')
      const projectStore = useProjectStore()
      const characterStore = useCharacterStore()
      const draft = useCharacterMetricsDraftStore()

      const metrics = resolveImportFontMetrics(font.settings)
      const scale = metrics.scale
      projectStore.addFile({
        uuid: 'test-file',
        width: 1000,
        height: 1000,
        name: '山海测试',
        saved: false,
        characterList: [],
        iconsCount: 0,
        fontSettings: {
          unitsPerEm: 1000,
          ascender: metrics.ascender,
          descender: metrics.descender,
        },
      } as any)
      projectStore.selectFile('test-file')

      const files = await buildCharacterFilesFromParsedFont(
        { characters: letters, settings: font.settings },
        1000,
      )
      expect(files.length).toBe(2)

      for (const [i, ch] of letters.entries()) {
        const file = files[i]
        ;(characterStore as any).editingCharacter = file
        ;(characterStore as any).editingCharacterUUID = file.uuid
        draft.hydrateFromEditingCharacter()

        const expectedAdvance = Math.round((ch!.advanceWidth ?? 1000) * scale)
        const expectedLsb = Math.floor((ch!.leftSideBearing ?? 0) * scale)
        process.stdout.write(
          `  ${file.character?.text}: draft advance=${draft.advanceWidth} lsb=${draft.lsb} xMin=${draft.xMin} (font: ${ch!.advanceWidth}/${ch!.leftSideBearing})\n`,
        )
        expect(draft.advanceWidth, `${file.character?.text} advanceWidth in metrics toolbar`).toBe(expectedAdvance)
        expect(draft.lsb, `${file.character?.text} lsb in metrics toolbar`).toBe(expectedLsb)

        // 度量控件几何：
        // 1. lsb 条右缘贴紧字形最小坐标（控件公式 [xMin-lsb, xMin] 恒成立，此处验证
        //    hydrate 的 xMin 等于组件存储点（编辑坐标）的真实左缘，而非缓存轮廓的字体坐标）
        // 2. 红区（advance 条）左缘 = xMin - lsb，居中于 (1000-advance)/2 附近
        let ptsXMin = Infinity
        for (const comp of file.components) {
          const pts = (comp as any).value?.points as Array<{ x: number }> | undefined
          if (!pts?.length) continue
          ptsXMin = Math.min(ptsXMin, ...pts.map((p) => p.x))
        }
        // hydrate 的 bbox 来自 genPenContour 产物（字体坐标 floor 惯例），期望值同样 floor
        const expectedGlyphXMin = Math.floor(ptsXMin)
        expect(draft.xMin, `${file.character?.text} glyph xMin (lsb right edge must touch it)`).toBe(expectedGlyphXMin)
        const c = (1000 - expectedAdvance) / 2
        expect(
          draft.xMin - draft.lsb,
          `${file.character?.text} metrics widget origin (advance bar left, centered at ${c})`,
        ).toBe(expectedGlyphXMin - expectedLsb)
        expect(
          Math.abs(draft.xMin - draft.lsb - c),
          `${file.character?.text} red region centering (within font lsb/xMin tolerance)`,
        ).toBeLessThan(2)
      }
    },
  )
})
