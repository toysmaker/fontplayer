// 临时诊断：玫瑰花图标组件的颜色字段（跑完即删）
import { readFileSync } from 'node:fs'
import { parseFpBufferSafe } from '@/features/editor/services/projectArchive/fpProjectFormat'
import { decompressCharacterAt } from '@/features/editor/services/compressedTemplate/fpzFormat'

const realFetch = globalThis.fetch.bind(globalThis)
;(globalThis as { fetch: typeof fetch }).fetch = (async (input: unknown, init?: unknown) => {
  if (String(input) === '/.keydata') {
    return new Response(readFileSync('src-tauri/resources/.keydata', 'utf-8'))
  }
  return realFetch(input as RequestInfo, init as RequestInit)
}) as typeof fetch

async function main() {
  const path = process.argv[2]
  const buffer = readFileSync(path)
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const decoded = await parseFpBufferSafe(ab as ArrayBuffer)
  for (let i = 0; i < decoded.toc.length; i++) {
    const char = (await decompressCharacterAt(decoded, i)) as Record<string, unknown>
    const meta = char.character as Record<string, unknown>
    if (meta.text !== '玫瑰花') continue
    const comps = (char.components as Array<Record<string, unknown>>) ?? []
    console.log(`icon: ${meta.text} | components: ${comps.length}`)
    for (const c of comps) {
      const v = c.value as Record<string, unknown> | undefined
      console.log(
        `  ${c.name ?? c.type} [${c.type}] | comp.fillColor=${JSON.stringify(c.fillColor)} | value.fillColor=${JSON.stringify(v?.fillColor)} | opacity=${JSON.stringify(c.opacity)}`
      )
    }
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
