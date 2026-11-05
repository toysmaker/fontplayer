/**
 * AI 模型懒加载 — onnxruntime-web InferenceSession
 *
 * 模型文件位于 public/models/ai/ (vite dev 与 build 均按静态资源提供)。
 * wasm 运行时 (ort-wasm-simd-threaded.wasm) 放同目录 ort/ 下,
 * 页面未启用 crossOriginIsolated, 因此 numThreads=1 单线程运行。
 */
import * as ort from 'onnxruntime-web/wasm'
// 胶水 (.mjs) 与 wasm 二进制由 ORT 运行时按 import.meta.url 解析:
//  dev  → node_modules/onnxruntime-web/dist/ 下 (vite 直接提供)
//  prod → dist/assets/ 下 (copyPlugin 从 node_modules 拷贝, 见 vite.config.ts)

export type AiModelKind = 'stroke' | 'char'

const AI_BASE = `${import.meta.env.BASE_URL || '/'}models/ai/`

let _sessions: Partial<Record<AiModelKind, ort.InferenceSession>> = {}
let _sessionPromises: Partial<Record<AiModelKind, Promise<ort.InferenceSession>>> = {}

function aiUrl(path: string): string {
  const base = AI_BASE.endsWith('/') ? AI_BASE : `${AI_BASE}/`
  return `${base}${path}`
}

function setupOrtEnv(): void {
  // 单线程 SIMD (页面未启用 crossOriginIsolated)
  ort.env.wasm.numThreads = 1
}

export async function getAiSession(kind: AiModelKind): Promise<ort.InferenceSession> {
  if (_sessions[kind]) return _sessions[kind]!
  if (_sessionPromises[kind]) return _sessionPromises[kind]!
  const promise = (async () => {
    setupOrtEnv()
    const file = kind === 'stroke' ? 'stroke_generator_fp16.onnx' : 'char_generator_fp16.onnx'
    const session = await ort.InferenceSession.create(aiUrl(file), {
      executionProviders: ['wasm'],
    })
    _sessions[kind] = session
    if (import.meta.env.DEV) {
      console.log(`[aiGeneration] 模型已加载: ${file}`)
    }
    return session
  })()
  _sessionPromises[kind] = promise
  return promise
}
