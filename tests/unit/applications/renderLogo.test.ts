import { describe, expect, it } from 'vitest'
import { computeLogoLayout, type LogoGlyphRenderable } from '@/features/applications/canvas/renderLogo'
import type { ILogoAppData } from '@/features/applications/types'

const fs = { unitsPerEm: 1000, ascender: 800, descender: -200 }

const textRenderable: LogoGlyphRenderable = {
  contours: [],
  fillColors: null,
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
