import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Authenticated symmetric encryption for arbitrary JSON values.
 *
 * Algorithm: AES-256-GCM
 * Key:       32 raw bytes loaded from `SETTINGS_ENCRYPTION_KEY` (hex)
 * Output:    "iv.tag.ciphertext" — three hex segments joined by dots.
 *
 * Stored in plain text columns so the data round-trips cleanly through
 * Supabase / PostgREST without bytea encoding headaches, and remains
 * easy to inspect / re-encrypt if we ever rotate the key.
 *
 * IMPORTANT: rotating SETTINGS_ENCRYPTION_KEY without re-encrypting
 * the existing rows will permanently destroy access to those values.
 */

const ALGORITHM = 'aes-256-gcm' as const
const IV_BYTES  = 12  // standard GCM nonce length
const TAG_BYTES = 16  // GCM auth tag length

function getKey(): Buffer {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ' +
      'Generate one with: `openssl rand -hex 32`.'
    )
  }
  return Buffer.from(hex, 'hex')
}

/** Encrypts a JSON-serialisable value. Returns the encoded ciphertext string. */
export function encryptJSON(value: unknown): string {
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`
}

/**
 * Decrypts a value produced by `encryptJSON`. Returns null if the input
 * is null/empty (so callers can pass column values straight through).
 * Throws on tampering, key mismatch, or malformed input.
 */
export function decryptJSON<T = unknown>(encoded: string | null | undefined): T | null {
  if (!encoded) return null
  const parts = encoded.split('.')
  if (parts.length !== 3) {
    throw new Error('Encrypted value is malformed (expected "iv.tag.ciphertext").')
  }
  const [ivH, tagH, encH] = parts as [string, string, string]
  const iv  = Buffer.from(ivH,  'hex')
  const tag = Buffer.from(tagH, 'hex')
  const enc = Buffer.from(encH, 'hex')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Encrypted value has incorrect IV or tag length.')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as T
}
