/**
 * 字符Mock数据
 */

import type { ICharacterFileLite } from '@/core/types'
import { createMockCharacter } from '../../helpers/mock-helpers'

export const mockCharacter: ICharacterFileLite = createMockCharacter({
  uuid: 'mock-character-uuid',
  character: {
    text: '测试',
  },
})

export const mockCharacters: ICharacterFileLite[] = [
  createMockCharacter({ uuid: 'char-1', character: { text: '一' } }),
  createMockCharacter({ uuid: 'char-2', character: { text: '二' } }),
  createMockCharacter({ uuid: 'char-3', character: { text: '三' } }),
]
