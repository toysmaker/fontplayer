import { describe, it, expect } from 'vitest'

/**
 * 确保每个 .vue 单文件组件可被 Vite/Vitest 解析（Phase C 基线烟测）。
 * 深度交互与 100% 行覆盖在后续用例中按模块补充。
 */
const vueModules = import.meta.glob<{ default: unknown }>('../../../src/**/*.vue', {
  import: 'default',
  eager: false,
})

describe('Vue SFC import smoke (all src/**/*.vue)', () => {
  const paths = Object.keys(vueModules).sort()

  it('discovers at least one SFC', () => {
    expect(paths.length).toBeGreaterThan(0)
  })

  for (const p of paths) {
    it(`imports ${p}`, async () => {
      const mod = await vueModules[p]()
      expect(mod).toBeDefined()
    })
  }
})
