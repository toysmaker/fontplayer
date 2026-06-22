import { RSA_ALGORITHM } from './constants'
import { deobfuscate } from './obfuscator'
import { isTauri } from '@/utils/env'
import { PUBLIC_KEY_PEM } from './publicKey'

let cachedPublicKey: CryptoKey | null = null
let cachedPrivateKey: CryptoKey | null = null

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function getPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey

  const der = pemToDer(PUBLIC_KEY_PEM)
  cachedPublicKey = await crypto.subtle.importKey('spki', der, RSA_ALGORITHM, true, ['encrypt'])
  return cachedPublicKey
}

async function loadObfuscatedPrivateKeyData(): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string>('read_keydata')
  }
  const response = await fetch('/.keydata')
  if (!response.ok) {
    throw new Error(`Failed to load private key data: ${response.status}`)
  }
  return response.text()
}

export async function getPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey

  const obfuscatedData = await loadObfuscatedPrivateKeyData()
  const derBytes = await deobfuscate(obfuscatedData.trim())

  cachedPrivateKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes,
    RSA_ALGORITHM,
    false,
    ['decrypt'],
  )
  return cachedPrivateKey
}
