import { OBFUSCATION_SEED } from './constants'

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveKeyMaterial(length: number): Promise<Uint8Array> {
  const seedData = new TextEncoder().encode(OBFUSCATION_SEED)
  const hash = await crypto.subtle.digest('SHA-256', seedData)
  const hashBytes = new Uint8Array(hash)
  const result = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    result[i] = hashBytes[i % hashBytes.length]!
  }
  return result
}

export async function obfuscate(data: Uint8Array): Promise<string> {
  const keyMaterial = await deriveKeyMaterial(data.length)
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i]! ^ keyMaterial[i]!
  }
  return uint8ArrayToBase64(result)
}

export async function deobfuscate(obfuscatedBase64: string): Promise<Uint8Array> {
  const data = base64ToUint8Array(obfuscatedBase64)
  const keyMaterial = await deriveKeyMaterial(data.length)
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i]! ^ keyMaterial[i]!
  }
  return result
}
