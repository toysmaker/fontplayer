/**
 * 封装期进度观察者：fontManager 内部 loaded/total 计数对外桥接
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loaded, total, loadingMsg } from '@/fontManager/utils/loading'
import {
  setProgressObserver,
  incrementProgress,
  reserveProgressBudget,
  setProgressMessage,
} from '@/fontManager/utils/progress'

describe('progress observer', () => {
  beforeEach(() => {
    loaded.value = 0
    total.value = 100
    loadingMsg.value = ''
    setProgressObserver(null)
  })

  it('incrementProgress 触发观察者并带正确参数', () => {
    const cb = vi.fn()
    setProgressObserver(cb)
    incrementProgress(undefined, 1)
    expect(cb).toHaveBeenCalledWith(1, 100)
    incrementProgress(undefined, 4)
    expect(cb).toHaveBeenLastCalledWith(5, 100)
  })

  it('reserveProgressBudget 触发观察者并扩大预算', () => {
    const cb = vi.fn()
    setProgressObserver(cb)
    // total=100 已剩 100，再补 200 预算 → total=200
    reserveProgressBudget(200)
    expect(total.value).toBe(200)
    expect(cb).toHaveBeenCalledWith(0, 200)
  })

  it('setProgressMessage 不触发观察者（仅改文案）', () => {
    const cb = vi.fn()
    setProgressObserver(cb)
    setProgressMessage('生成 CFF CharStrings…')
    expect(loadingMsg.value).toBe('生成 CFF CharStrings…')
    expect(cb).not.toHaveBeenCalled()
  })

  it('setProgressObserver(null) 后不再触发', () => {
    const cb = vi.fn()
    setProgressObserver(cb)
    incrementProgress(undefined, 1)
    setProgressObserver(null)
    incrementProgress(undefined, 1)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
