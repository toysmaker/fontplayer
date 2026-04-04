import { describe, it, expect } from 'vitest'
import { ParameterType, type IComponent, type ICustomGlyph } from '@/core/types'
import { hydrateGlyphComponentEnumOptionsFromLibrary } from '@/features/editor/services/glyphParameterHydration'
import { stripCharacterForTemplate } from '@/features/editor/services/compressedTemplate/stripTemplateProject'

describe('glyphParameterHydration', () => {
  it('copies enum options from library glyph by uuid', () => {
    const library: ICustomGlyph[] = [
      {
        uuid: 'stroke-a',
        name: '横',
        parameters: [
          {
            uuid: 'p1',
            name: '转角样式',
            type: ParameterType.Enum,
            value: 0,
            options: [
              { value: 0, label: '方' },
              { value: 1, label: '圆' },
            ],
          },
        ],
      } as ICustomGlyph,
    ]
    const components: IComponent[] = [
      {
        type: 'glyph',
        uuid: 'comp-1',
        value: {
          uuid: 'stroke-a',
          name: '横',
          parameters: [{ uuid: 'p1', name: '转角样式', type: ParameterType.Enum, value: 0 }],
        } as ICustomGlyph,
      } as IComponent,
    ]
    hydrateGlyphComponentEnumOptionsFromLibrary(components, library)
    const opts = (components[0]!.value as ICustomGlyph).parameters![0] as { options?: unknown[] }
    expect(opts.options?.length).toBe(2)
  })
})

describe('stripCharacterForTemplate enum options', () => {
  it('strips enum options by default (template pack)', () => {
    const char = {
      uuid: 'c1',
      components: [
        {
          type: 'glyph',
          value: {
            uuid: 'g1',
            parameters: [{ type: ParameterType.Enum, name: 'x', value: 0, options: [{ value: 0, label: 'A' }] }],
          },
        },
      ],
    }
    const out = stripCharacterForTemplate(char as Record<string, unknown>)
    const p = (out as { components: { value: { parameters: { options?: unknown }[] } }[] }).components[0].value
      .parameters[0]
    expect(p.options).toBeUndefined()
  })

  it('keeps enum options when stripGlyphParameterEnumOptions is false', () => {
    const char = {
      uuid: 'c1',
      components: [
        {
          type: 'glyph',
          value: {
            uuid: 'g1',
            parameters: [{ type: ParameterType.Enum, name: 'x', value: 0, options: [{ value: 0, label: 'A' }] }],
          },
        },
      ],
    }
    const out = stripCharacterForTemplate(char as Record<string, unknown>, {
      stripGlyphParameterEnumOptions: false,
    })
    const p = (out as { components: { value: { parameters: { options?: unknown[] }[] } }[] }).components[0].value
      .parameters[0]
    expect(p.options?.length).toBe(1)
  })
})
