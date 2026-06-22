/** Magic bytes for encrypted FP file: "FPE1" */
export const FP_ENCRYPTED_MAGIC = new Uint8Array([0x46, 0x50, 0x45, 0x31])

export const FP_ENCRYPTED_VERSION = 1

/** Encryption type: RSA-OAEP wrapped AES-256-GCM */
export const ENCRYPTION_TYPE_RSA_AES_GCM = 1

export const RSA_ALGORITHM: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
}

export const AES_ALGORITHM: AesKeyGenParams = {
  name: 'AES-GCM',
  length: 256,
}

export const OBFUSCATION_SEED = 'com.fontplayer.app.encryption.v1'
