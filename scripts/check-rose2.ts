import { readFileSync } from 'node:fs'
import { parseFpBufferSafe } from '@/features/editor/services/projectArchive/fpProjectFormat'
import { decompressCharacterAt } from '@/features/editor/services/compressedTemplate/fpzFormat'
const realFetch = globalThis.fetch.bind(globalThis)
;(globalThis as { fetch: typeof fetch }).fetch = (async (input: unknown, init?: unknown) => {
  if (String(input) === '/.keydata') return new Response(readFileSync('src-tauri/resources/.keydata', 'utf-8'))
  return realFetch(input as RequestInfo, init as RequestInit)
}) as typeof fetch
async function main() {
  const buffer = readFileSync(process.argv[2])
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const decoded = await parseFpBufferSafe(ab as ArrayBuffer)
  for (let i = 0; i < decoded.toc.length; i++) {
    const char = (await decompressCharacterAt(decoded, i)) as Record<string, unknown>
    if ((char.character as { text?: string }).text !== '玫瑰花') continue
    for (const c of (char.components as Array<Record<string, unknown>>) ?? []) {
      const v = c.value as Record<string, unknown> | undefined
      const subs = (v?.components as Array<Record<string, unknown>>) ?? []
      const subInfo = subs.slice(0, 4).map((s) => {
        const sv = s.value as Record<string, unknown> | undefined
        return `${s.name ?? s.type}[${s.type}]:fill=${JSON.stringify(s.fillColor ?? sv?.fillColor)}`
      })
      console.log(`${c.name} [${c.type}] | value.components=${subs.length} | script=${!!v?.script} ref=${!!v?.script_reference}`)
      for (const s of subInfo) console.log('   ', s)
    }
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
