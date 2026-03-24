import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loading, loaded, total, loadingMsg } from '@/fontManager/utils/loading'
import {
  reserveProgressBudget,
  incrementProgress,
  setProgressMessage,
  yieldToEventLoop,
  sleep,
} from '@/fontManager/utils/progress'

describe('fontManager progress + loading', () => {
  beforeEach(() => {
    loading.value = false
    loaded.value = 0
    total.value = 100
    loadingMsg.value = ''
  })

  it('reserveProgressBudget expands total when needed', () => {
    loaded.value = 95
    total.value = 100
    reserveProgressBudget(20)
    expect(loading.value).toBe(true)
    expect(total.value).toBeGreaterThanOrEqual(115)
  })

  it('reserveProgressBudget ignores invalid estimate', () => {
    const t = total.value
    reserveProgressBudget(0)
    reserveProgressBudget(NaN)
    expect(total.value).toBe(t)
  })

  it('incrementProgress updates message and loaded', () => {
    incrementProgress('step', 5)
    expect(loaded.value).toBe(5)
    expect(loadingMsg.value).toBe('step')
    incrementProgress(undefined, 200)
    expect(total.value).toBeGreaterThanOrEqual(loaded.value)
  })

  it('incrementProgress ignores invalid step', () => {
    loaded.value = 10
    incrementProgress('x', 0)
    incrementProgress('x', -1)
    expect(loaded.value).toBe(10)
  })

  it('setProgressMessage', () => {
    setProgressMessage('hello')
    expect(loadingMsg.value).toBe('hello')
    expect(loading.value).toBe(true)
  })

  it('sleep resolves', async () => {
    vi.useFakeTimers()
    const p = sleep(10)
    vi.advanceTimersByTime(10)
    await p
    vi.useRealTimers()
  })

  it('yieldToEventLoop no-op for bad args', async () => {
    await yieldToEventLoop(0, 10)
    await yieldToEventLoop(10, 0)
  })

  it('yieldToEventLoop yields on chunk boundary', async () => {
    vi.useFakeTimers()
    const p = yieldToEventLoop(120, 120, 0)
    vi.advanceTimersByTime(1)
    await p
    vi.useRealTimers()
  })
})
