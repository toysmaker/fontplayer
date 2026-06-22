import {
  FP_ENCRYPTED_MAGIC,
  FP_ENCRYPTED_VERSION,
  ENCRYPTION_TYPE_RSA_AES_GCM,
  RSA_ALGORITHM,
  AES_ALGORITHM,
} from './constants'
import type { EncryptedFileHeader } from './types'

export function isEncryptedFile(buffer: ArrayBuffer): boolean {
  const u8 = new Uint8Array(buffer)
  if (u8.length < 4) return false
  for (let i = 0; i < 4; i++) {
    if (u8[i] !== FP_ENCRYPTED_MAGIC[i]) return false
  }
  return true
}

function parseEncryptedHeader(buffer: ArrayBuffer): EncryptedFileHeader {
  const u8 = new Uint8Array(buffer)
  const dv = new DataView(buffer)

  if (u8.length < 4 + 4 + 1 + 2) {
    throw new Error('Encrypted FP: file too small for header')
  }

  let o = 4 // skip magic

  const version = dv.getUint32(o, true)
  o += 4
  if (version !== FP_ENCRYPTED_VERSION) {
    throw new Error(`Encrypted FP: unsupported version ${version}`)
  }

  const encType = u8[o]!
  o += 1
  if (encType !== ENCRYPTION_TYPE_RSA_AES_GCM) {
    throw new Error(`Encrypted FP: unknown encryption type ${encType}`)
  }

  const encKeyLen = dv.getUint16(o, true)
  o += 2

  if (u8.length < o + encKeyLen + 12) {
    throw new Error('Encrypted FP: truncated header')
  }

  const encryptedAesKey = u8.subarray(o, o + encKeyLen)
  o += encKeyLen

  const iv = u8.subarray(o, o + 12)
  o += 12

  return { version, encType, encryptedAesKey, iv, ciphertextOffset: o }
}

/**
 * Encrypt a plaintext FP buffer using hybrid RSA+AES-GCM.
 * Returns the complete encrypted file as an ArrayBuffer.
 */
export async function encryptFile(
  plaintext: ArrayBuffer,
  publicKey: CryptoKey,
): Promise<ArrayBuffer> {
  const aesKey = await crypto.subtle.generateKey(AES_ALGORITHM, true, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext,
  )

  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const encryptedAesKey = await crypto.subtle.encrypt(RSA_ALGORITHM, publicKey, rawAesKey)

  const encKeyBytes = new Uint8Array(encryptedAesKey)
  const ciphertextBytes = new Uint8Array(ciphertext)

  const headerSize = 4 + 4 + 1 + 2 + encKeyBytes.length + 12
  const out = new Uint8Array(headerSize + ciphertextBytes.length)
  const dv = new DataView(out.buffer)

  let w = 0
  for (let i = 0; i < 4; i++) out[w++] = FP_ENCRYPTED_MAGIC[i]!
  dv.setUint32(w, FP_ENCRYPTED_VERSION, true)
  w += 4
  out[w++] = ENCRYPTION_TYPE_RSA_AES_GCM
  dv.setUint16(w, encKeyBytes.length, true)
  w += 2
  out.set(encKeyBytes, w)
  w += encKeyBytes.length
  out.set(iv, w)
  w += 12
  out.set(ciphertextBytes, w)

  return out.buffer
}

/**
 * Decrypt an encrypted FP buffer using the private key.
 * Returns the plaintext FP binary (which can then be parsed by parseFpBuffer).
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  privateKey: CryptoKey,
): Promise<ArrayBuffer> {
  const header = parseEncryptedHeader(encryptedData)
  const u8 = new Uint8Array(encryptedData)
  const ciphertext = u8.subarray(header.ciphertextOffset)

  const rawAesKey = await crypto.subtle.decrypt(
    RSA_ALGORITHM,
    privateKey,
    header.encryptedAesKey,
  )

  const aesKey = await crypto.subtle.importKey('raw', rawAesKey, AES_ALGORITHM, false, ['decrypt'])

  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: header.iv }, aesKey, ciphertext)
}
