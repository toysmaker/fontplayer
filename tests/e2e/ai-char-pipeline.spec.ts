/**
 * 字符生成管线诊断 (浏览器): 真实 basechars PNG → 骨架 → 推理 → 轮廓。
 * 关键回归: 两个不同字符的骨架应产生不同的输出 (防止"每个字符都一样")。
 */
import { test, expect } from '@playwright/test'

test('字符生成管线: 骨架→推理→轮廓, 不同字符输出不同', async ({ page }) => {
  test.setTimeout(240000)
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  const result = await page.evaluate(async () => {
    const report: Record<string, unknown> = {}
    const tuMod = await import('/src/features/aiGeneration/tensorUtils.ts')
    const spMod = await import('/src/features/aiGeneration/stylePool.ts')
    const mlMod = await import('/src/features/aiGeneration/modelLoader.ts')
    const picMod = await import('/src/features/editor/services/PictureImportPipelineService.ts')
    const ort = await import('/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs')
    ort.env.wasm.numThreads = 1

    // 1. 骨架 PNG 加载 (生产同款逻辑)
    const masks: Record<string, Float32Array> = {}
    for (const ch of ['永', '一']) {
      const res = await fetch(`/models/ai/basechars/${encodeURIComponent(ch)}.png`)
      if (!res.ok) return { error: `basechars 缺 ${ch} (${res.status})` }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = url
      })
      masks[ch] = tuMod.imageToAlphaMask(img, 128)
      report[`maskSum:${ch}`] = masks[ch].reduce((a, b) => a + b, 0)
    }
    if (report['maskSum:永'] < 100 || report['maskSum:一'] < 100) {
      return { ...report, error: '骨架掩码过小' }
    }
    // 两字符骨架本身应不同
    let maskDiff = 0
    for (let i = 0; i < 128 * 128; i++) if (masks['永'][i] !== masks['一'][i]) maskDiff++
    report.maskDiffPixels = maskDiff
    if (maskDiff < 100) return { ...report, error: '两字符骨架相同?!' }

    // 2. 真实随机风格向量 (生产同款算法)
    const z = await spMod.sampleRandomChar()
    let zNorm = 0
    for (const v of z) zNorm += v * v
    report.zNorm = Math.sqrt(zNorm)

    // 3. 批量推理 (同一 z, 两个不同骨架)
    const session = await mlMod.getAiSession('char')
    const { data, dims } = tuMod.stackMasks([masks['永'], masks['一']], 128)
    const out = await session.run({
      skeleton: new ort.Tensor('float32', data, dims),
      style_vec: new ort.Tensor('float32', tuMod.broadcastStyleVec(z, 2), [2, 64]),
    })
    const odata = out['glyph'].data

    // 4. 输出二值化 + 差异对比
    const bins: Uint8Array[] = []
    for (let b = 0; b < 2; b++) {
      const bin = new Uint8Array(128 * 128)
      let ink = 0
      for (let i = 0; i < 128 * 128; i++) {
        const v = odata[b * 128 * 128 + i] > 0.5 ? 1 : 0
        bin[i] = v
        ink += v
      }
      bins.push(bin)
      report[`outInk:${b}`] = ink
    }
    let outDiff = 0
    for (let i = 0; i < 128 * 128; i++) if (bins[0][i] !== bins[1][i]) outDiff++
    report.outDiffPixels = outDiff
    if (report['outInk:0'] < 50 || report['outInk:1'] < 50) {
      return { ...report, error: '输出墨迹过少' }
    }
    if (outDiff < 200) return { ...report, error: '两字符输出几乎相同!' }

    // 5. 轮廓识别
    for (let b = 0; b < 2; b++) {
      const canvas = tuMod.outputTensorToCanvas(
        odata.subarray(b * 128 * 128, (b + 1) * 128 * 128),
        128, 1000, 0.5,
      )
      const img = await tuMod.canvasToImage(canvas)
      const components = picMod.PictureImportPipelineService.traceHandDrawnImageToPenComponents(img, {
        importEmWidth: 1000,
        importEmHeight: 1000,
        thumbnailMax: 1000,
      })
      report[`components:${b}`] = components.length
    }
    return report
  })

  console.log('char pipeline:', JSON.stringify(result, null, 2))
  expect((result as any).error).toBeUndefined()
  expect((result as any)['components:0']).toBeGreaterThan(0)
  expect((result as any)['components:1']).toBeGreaterThan(0)
})
