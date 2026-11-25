/**
 * skeletonDragger store 自由编辑状态: 多钢笔 uuid 列表
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  skeletonFreeEdit,
  skeletonFreeEditPenUUIDs,
  skeletonFreeEditGlyphUUID,
  enterSkeletonFreeEdit,
  exitSkeletonFreeEdit,
} from '@/stores/skeletonDragger'

describe('skeleton free edit store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    exitSkeletonFreeEdit()
  })

  it('enter 记录多钢笔 uuid 列表', () => {
    enterSkeletonFreeEdit(['pen-1', 'pen-2'], 'glyph-1')
    expect(skeletonFreeEdit.value).toBe(true)
    expect(skeletonFreeEditPenUUIDs.value).toEqual(['pen-1', 'pen-2'])
    expect(skeletonFreeEditGlyphUUID.value).toBe('glyph-1')
  })

  it('exit 清空全部状态', () => {
    enterSkeletonFreeEdit(['pen-1'], 'glyph-1')
    exitSkeletonFreeEdit()
    expect(skeletonFreeEdit.value).toBe(false)
    expect(skeletonFreeEditPenUUIDs.value).toEqual([])
    expect(skeletonFreeEditGlyphUUID.value).toBe('')
  })
})
