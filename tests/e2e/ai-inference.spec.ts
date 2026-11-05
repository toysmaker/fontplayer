/**
 * 临时验证: AI ONNX 模型在真实浏览器 (chromium) 中加载并推理
 * 验证路径与产品一致: /models/ai/ 下的 onnx + /models/ai/ort/ 下的 wasm, 非 COI 单线程
 */
import { test, expect } from '@playwright/test'

test('AI models load and run inference in browser', async ({ page }) => {
  // 模型文件在 public/models/ai (gitignored, 由导出脚本生成); 缺失时跳过
  const hasModel = await fetch('http://localhost:5173/models/ai/stroke_generator_fp16.onnx')
    .then((r) => r.ok)
    .catch(() => false)
  test.skip(!hasModel, 'AI 模型文件不存在 (public/models/ai 未生成), 跳过')

  await page.goto('/')
  const result = await page.evaluate(async () => {
    const ort = await import('/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs')
    ort.env.wasm.numThreads = 1
    const report: Record<string, unknown> = {}

    // 静态资源可达性
    for (const f of ['stroke_style_pools.json', 'char_style_pools.json', 'stroke_skeletons/横.png']) {
      const res = await fetch(`/models/ai/${f}`)
      report[`fetch:${f}`] = res.status
    }

    for (const [kind, file, size] of [
      ['stroke', 'stroke_generator_fp16.onnx', 256],
      ['char', 'char_generator_fp16.onnx', 128],
    ] as const) {
      const session = await ort.InferenceSession.create(`/models/ai/${file}`, {
        executionProviders: ['wasm'],
      })
      const b = 1
      const skel = new Float32Array(b * size * size)
      const q = Math.floor(size / 4)
      for (let y = q; y < 3 * q; y++) for (let x = q; x < 3 * q; x++) skel[y * size + x] = 1
      const z = new Float32Array(64).fill(0.1)
      const feeds: Record<string, ort.Tensor> = {
        skeleton: new ort.Tensor('float32', skel, [b, 1, size, size]),
        style_vec: new ort.Tensor('float32', z, [b, 64]),
      }
      const t0 = performance.now()
      const out = await session.run(feeds)
      const ms = performance.now() - t0
      const data = out[kind === 'stroke' ? 'stroke' : 'glyph'].data as Float32Array
      let finite = true
      let mn = Infinity
      let mx = -Infinity
      for (let i = 0; i < data.length; i++) {
        if (!Number.isFinite(data[i])) {
          finite = false
          break
        }
        if (data[i] < mn) mn = data[i]
        if (data[i] > mx) mx = data[i]
      }
      report[kind] = { len: data.length, finite, min: mn, max: mx, timeMs: Math.round(ms) }
    }
    return report
  })
  console.log('AI inference:', JSON.stringify(result, null, 2))
  const stroke = result['stroke'] as any
  const char = result['char'] as any
  expect(stroke.finite).toBe(true)
  expect(char.finite).toBe(true)
  expect(stroke.min).toBeGreaterThanOrEqual(0)
  expect(stroke.max).toBeLessThanOrEqual(1)
  expect(char.min).toBeGreaterThanOrEqual(0)
  expect(char.max).toBeLessThanOrEqual(1)
  expect(result['fetch:stroke_style_pools.json']).toBe(200)
  expect(result['fetch:char_style_pools.json']).toBe(200)
  expect(result['fetch:stroke_skeletons/横.png']).toBe(200)
})
