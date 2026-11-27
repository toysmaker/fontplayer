/**
 * 临时诊断：解密 测试111.fp，导出 fontSettings 与 tables 用于和 ttx 对照。
 * 一次性脚本，用完即删。
 */
import { it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { deobfuscate } from '@/core/encryption/obfuscator'
import { decryptFile } from '@/core/encryption'
import { parseFpBuffer } from '@/features/editor/services/projectArchive/fpProjectFormat'
import { RSA_ALGORITHM } from '@/core/encryption/constants'

const FP_PATH = `${process.env.HOME}/Documents/字体测试/测试111.fp`
const KEYDATA_PATH = `${process.env.PWD}/public/.keydata`

describe('check fp settings', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => vi.restoreAllMocks())

  it('dump settings', async () => {
    const fp = readFileSync(FP_PATH)
    const keydata = readFileSync(KEYDATA_PATH, 'utf-8')
    const der = await deobfuscate(keydata.trim())
    const privateKey = await crypto.subtle.importKey('pkcs8', der, RSA_ALGORITHM, false, ['decrypt'])
    const plaintext = await decryptFile(
      fp.buffer.slice(fp.byteOffset, fp.byteOffset + fp.byteLength) as ArrayBuffer,
      privateKey,
    )
    const decoded = parseFpBuffer(plaintext)
    const project = decoded.headerProject as any
    process.stdout.write('=== project keys ===\n' + JSON.stringify(Object.keys(project)) + '\n')
    const file = project.file ?? project
    process.stdout.write('=== file keys ===\n' + JSON.stringify(Object.keys(file)) + '\n')
    process.stdout.write('=== name ===\n' + JSON.stringify(file.name) + '\n')
    process.stdout.write(
      '=== fontSettings ===\n' +
        JSON.stringify(file.fontSettings, null, 2) +
        '\n',
    )
    expect(true).toBe(true)
  })
})
