/**
 * 字形Mock数据
 */

import type { ICustomGlyph } from '@/core/types'
import { createMockGlyph } from '../../helpers/mock-helpers'

export const mockGlyph: ICustomGlyph = createMockGlyph({
  uuid: 'mock-glyph-uuid',
  name: 'mock-glyph',
})

export const mockGlyphs: ICustomGlyph[] = [
  createMockGlyph({ uuid: 'glyph-1', name: 'glyph-1' }),
  createMockGlyph({ uuid: 'glyph-2', name: 'glyph-2' }),
  createMockGlyph({ uuid: 'glyph-3', name: 'glyph-3' }),
]
