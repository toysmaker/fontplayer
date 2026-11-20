import { describe, expect, it } from 'vitest'
import { computeLogoLayout, buildLogoGlyphRenderable, type LogoGlyphRenderable } from '@/features/applications/canvas/renderLogo'
import type { ILogoAppData } from '@/features/applications/types'
import type { ICharacterFileLite, IFile } from '@/core/types'
import { createMockPenComponent } from '../../helpers/mock-helpers'

const fs = { unitsPerEm: 1000, ascender: 800, descender: -200 }

const textRenderable: LogoGlyphRenderable = {
  contours: [],
  fillColors: null,
  fillUnits: null,
  advanceWidth: 1000,
}

const data: ILogoAppData = {
  iconSource: { kind: 'external', dataUrl: 'data:image/png;base64,xx', isSvg: false },
  text: '字玩',
  iconFontSize: 72,
  textFontSize: 72,
  mode: 'mono',
  layout: 'leftRight',
  canvas: { width: 0, height: 0 },
  layoutBlocks: null,
}

describe('computeLogoLayout（外部图标）', () => {
  it('iconSizeOverride 存在时也要生成图标块（左右版式）', () => {
    const layout = computeLogoLayout({
      iconRenderable: null,
      iconSizeOverride: { width: 60, height: 80 },
      textRenderables: [textRenderable, textRenderable],
      data,
      fs,
    })
    expect(layout.iconBlock).not.toBeNull()
    expect(layout.iconBlock).toMatchObject({ width: 60, height: 80 })
  })

  it('上下版式：图标在上，文本在图标下方', () => {
    const layout = computeLogoLayout({
      iconRenderable: null,
      iconSizeOverride: { width: 60, height: 80 },
      textRenderables: [textRenderable],
      data: { ...data, layout: 'topBottom' },
      fs,
    })
    expect(layout.iconBlock).not.toBeNull()
    expect(layout.textBlocks[0].y).toBeGreaterThan(layout.iconBlock!.y)
  })
})

describe('buildLogoGlyphRenderable（填充单元 → nonzero 镂空）', () => {
  function makeChar(components: unknown[]): ICharacterFileLite {
    return {
      uuid: 'char-logo-test',
      type: 'character',
      character: { uuid: 'char-logo-test-meta', text: '测', unicode: 'U+6D4B' },
      components: components as never,
      groups: [],
      orderedList: [],
      view: { zoom: 100, translateX: 0, translateY: 0 },
      selectedComponentsUUIDs: [],
    }
  }

  function makeFile(): IFile {
    return {
      uuid: 'file-logo-test',
      name: 'logo测试',
      width: 1000,
      height: 1000,
      saved: false,
      iconsCount: 0,
      fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200 },
      characterList: [],
    }
  }

  it('彩色模式：轮廓携带 fillUnits，同图层轮廓共享单元（合并填充出镂空）', async () => {
    const pen = createMockPenComponent() as { uuid: string; value: Record<string, unknown> }
    pen.value.fillColor = '#ff0000'
    const renderable = await buildLogoGlyphRenderable(
      makeChar([pen]),
      makeFile(),
      fs as never,
      true,
    )
    expect(renderable).not.toBeNull()
    expect(renderable!.fillColors).toEqual(['#ff0000'])
    expect(renderable!.fillUnits).toEqual([`comp-${pen.uuid}`])
  })

  it('黑白模式：fillColors/fillUnits 为 null（画布按单一颜色合并填充）', async () => {
    const renderable = await buildLogoGlyphRenderable(
      makeChar([createMockPenComponent()]),
      makeFile(),
      fs as never,
      false,
    )
    expect(renderable).not.toBeNull()
    expect(renderable!.fillColors).toBeNull()
    expect(renderable!.fillUnits).toBeNull()
  })
})
