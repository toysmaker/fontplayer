export interface EncryptedFileHeader {
  version: number
  encType: number
  encryptedAesKey: Uint8Array
  iv: Uint8Array
  /** Offset where ciphertext begins */
  ciphertextOffset: number
}
