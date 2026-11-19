/**
 * FPUtils 循环依赖回归测试
 *
 * FPUtils ↔ PenComponent、FPUtils → Character → CustomGlyph → … → FPUtils
 * 存在循环依赖。当模块图从 stores/character（Character 侧）先加载时，
 * FP 对象字面量若直接引用 Character 等导入绑定，会在模块求值期触发
 * TDZ 错误（Cannot access 'Character' before initialization）。
 * FP 对象中的循环条目已改为 getter 延迟取值，此测试强制以
 * 「先加载 stores/character，再加载 FPUtils」的顺序求值模块图。
 */

import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('FPUtils circular dependency (TDZ)', () => {
  it('should load FPUtils after the Character side of the cycle without TDZ error', async () => {
    setActivePinia(createPinia())

    // 1. 先动态加载 stores/character：触发 Character → CustomGlyph → … → FPUtils 链，
    //    与「Cannot access 'Character' before initialization」崩溃时的入口顺序一致
    const charStore = await import('@/stores/character')
    expect(charStore).toBeDefined()

    // 2. 再加载 FPUtils：此时 FP 对象已求值完成，getter 条目应正常返回绑定
    const FPUtils = await import('@/core/script/FPUtils')
    const FP = FPUtils.FP

    expect(FP).toBeDefined()
    expect(FP.Character).toBeDefined()
    expect(typeof FP.Character).toBe('function')
    expect(FP.PenComponent).toBeDefined()
    expect(FP.interpolateFromKeyframes).toBeDefined()
  })
})
