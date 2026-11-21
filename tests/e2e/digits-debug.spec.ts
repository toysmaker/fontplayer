/**
 * digits 模板新鲜度探针（调试用，非回归测试）
 * 从浏览器视角验证 dev server 实际提供的内容：
 *  A. src/templates/digits.ts 模块（参数默认值）
 *  B. public/templates/digits/3.js 脚本（fetch 原文）
 *  C. src/core/script/FPUtils.ts（heitiPressure 是否存在于 getCurveContours2 闭包中）
 */
import { test } from '@playwright/test'

test('digits template freshness probe', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  const probe = await page.evaluate(async () => {
    const result: any = {}

    // A: 页面视角的 digits.ts
    try {
      const mod: any = await import('/src/templates/digits.ts')
      const d3 = mod.digits.find((d: any) => d.name === '3')
      const d8 = mod.digits.find((d: any) => d.name === '8')
      const d1 = mod.digits.find((d: any) => d.name === '1')
      result.digits3 = {
        h2: d3.params.find((p: any) => p.name === 'h2')?.value,
        globalParams: d3.globalParams.map((p: any) => `${p.name}=${p.value}`).join(','),
      }
      result.digits8 = {
        globalParams: d8.globalParams.map((p: any) => `${p.name}=${p.value}`).join(','),
      }
      result.digits1 = {
        h2: d1.params.find((p: any) => p.name === 'h2')?.value,
        w1: d1.params.find((p: any) => p.name === 'w1')?.value,
      }
    } catch (e: any) {
      result.digitsErr = String(e)
    }

    // B: 页面视角 fetch 到的 3.js
    try {
      const res = await fetch('/templates/digits/3.js')
      const text = await res.text()
      result.script3 = {
        len: text.length,
        hasHeitiPressure: text.includes('heitiPressure'),
        hasBendToCubic: text.includes('bendToCubic'),
        s11Line: (text.split('\n').find((l: string) => l.includes('skeleton_10.y -')) || '').trim(),
        curvatureLine: (text.split('\n').find((l: string) => l.includes("getParam('弯曲度')")) || '').trim(),
      }
    } catch (e: any) {
      result.script3Err = String(e)
    }

    // C: 页面视角的 FPUtils —— 直接拉取服务端转换后的模块源码文本
    try {
      const res = await fetch('/src/core/script/FPUtils.ts')
      const src = await res.text()
      result.fp = {
        hasHeitiPressureFn: src.includes('heitiPressureFn'),
        hasHeitiPressureInMap: src.includes("'heitiPressure'"),
        len: src.length,
      }
    } catch (e: any) {
      result.fpErr = String(e)
    }

    return result
  })

  console.log('PROBE-RESULT ' + JSON.stringify(probe, null, 2))
})
