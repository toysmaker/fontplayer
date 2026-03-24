import { describe, it, expect, afterEach, vi } from 'vitest'
import { InstanceManager, type IInstance } from '@/core/instance/InstanceManager'

describe('InstanceManager', () => {
  let mgr: InstanceManager

  afterEach(() => {
    mgr.clear()
  })

  it('creates fresh manager per suite block', () => {
    mgr = new InstanceManager()
    expect(mgr.getInstanceCount()).toBe(0)
  })

  it('acquireTemporaryInstance creates and returns same instance', () => {
    mgr = new InstanceManager()
    const factory = vi.fn(() => ({ uuid: '', type: 'glyph' as const, lastUsed: 0 }))
    const a = mgr.acquireTemporaryInstance('u1', factory, 'glyph')
    const b = mgr.acquireTemporaryInstance('u1', factory, 'glyph')
    expect(factory).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(mgr.isTemporary('u1')).toBe(true)
    expect(mgr.hasInstance('u1')).toBe(true)
  })

  it('releaseTemporaryInstance removes when not editing', () => {
    mgr = new InstanceManager()
    const cleanup = vi.fn()
    mgr.acquireTemporaryInstance(
      'u2',
      () => ({ uuid: '', type: 'glyph', lastUsed: 0, cleanup }),
      'glyph',
    )
    mgr.releaseTemporaryInstance('u2')
    expect(mgr.hasInstance('u2')).toBe(false)
    expect(cleanup).toHaveBeenCalled()
  })

  it('markEditing prevents LRU eviction', () => {
    mgr = new InstanceManager()
    mgr.setMaxPoolSize(2)
    mgr.markEditing('keep')
    for (let i = 0; i < 5; i++) {
      mgr.acquireTemporaryInstance(
        `t${i}`,
        () => ({ uuid: '', type: 'glyph', lastUsed: 0 }),
        'glyph',
      )
      mgr.releaseTemporaryInstance(`t${i}`)
    }
    mgr.acquireTemporaryInstance(
      'keep',
      () => ({ uuid: '', type: 'glyph', lastUsed: 0 }),
      'glyph',
    )
    expect(mgr.isEditing('keep')).toBe(true)
    expect(mgr.hasInstance('keep')).toBe(true)
  })

  it('getInstance returns null when not editing and not temporary', () => {
    mgr = new InstanceManager()
    const r = mgr.getInstance(
      'x',
      () => ({ uuid: '', type: 'glyph', lastUsed: 0 }),
      'glyph',
    )
    expect(r).toBeNull()
  })

  it('getInstance returns instance when editing', () => {
    mgr = new InstanceManager()
    mgr.markEditing('e1')
    const inst = mgr.getInstance(
      'e1',
      () => ({ uuid: '', type: 'character', lastUsed: 0 }),
      'character',
    )
    expect(inst).not.toBeNull()
    expect(inst!.uuid).toBe('e1')
  })

  it('getOrCreateGlyphInstance uses pool or acquires temporary', () => {
    mgr = new InstanceManager()
    const g = { uuid: 'g1' } as any
    const factory = vi.fn(
      () =>
        ({
          uuid: '',
          type: 'glyph',
          lastUsed: 0,
        }) as IInstance,
    )
    const first = mgr.getOrCreateGlyphInstance(g, factory)
    const second = mgr.getOrCreateGlyphInstance(g, factory)
    expect(second).toBe(first)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('findLRU and clear', () => {
    mgr = new InstanceManager()
    mgr.markEditing('ed')
    mgr.acquireTemporaryInstance(
      'a',
      () => ({ uuid: '', type: 'glyph', lastUsed: 0 }),
      'glyph',
    )
    expect(mgr.findLRU()).toBeTruthy()
    mgr.clear()
    expect(mgr.getInstanceCount()).toBe(0)
  })
})
