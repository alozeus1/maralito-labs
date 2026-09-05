/**
 * @maralito/crypto — shared AES-256-GCM parameters and decode guards (Phase 8B, ADR-0017).
 *
 * Node's GCM implementation accepts *truncated* authentication tags (4, 8, 12, 13, 14, 15 or 16
 * bytes) unless `authTagLength` is pinned on the decipher. A caller who can influence the stored
 * tag — for us, anyone who can write the `encrypted_pii.ciphertext` jsonb or a wrapped-DEK blob —
 * could therefore downgrade verification to a 32-bit tag, which is roughly 2^96 times cheaper to
 * forge than the full 128-bit tag. Every createCipheriv/createDecipheriv call in this package must
 * pin `AUTH_TAG_LENGTH` and validate the decoded tag length before `setAuthTag`.
 *
 * Base64 decoding is a second, easily missed hole: Node's decoder is lenient and silently yields a
 * short (or empty) buffer for malformed input rather than throwing, so length is checked explicitly
 * after decoding rather than inferred from the encoded string.
 */

/** Full 128-bit GCM authentication tag. Pinned on both cipher and decipher; never negotiated. */
export const AUTH_TAG_LENGTH = 16;
/** 96-bit IV — the GCM-native size, required for the standard counter construction. */
export const IV_LENGTH = 12;
/** AES-256 data/key-encryption key. */
export const KEY_LENGTH = 32;

export class InvalidCiphertextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCiphertextError';
  }
}

/**
 * Decode a base64 field and assert its exact byte length.
 *
 * Rejects short, malformed and truncated input BEFORE it reaches the crypto primitives, so a
 * tampered tag can never reach `setAuthTag` and a tampered IV can never reach `createDecipheriv`.
 * The error message names only the field and the expected/actual lengths — never any key,
 * plaintext or ciphertext material.
 */
export function decodeExact(value: unknown, bytes: number, field: string): Buffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidCiphertextError(`Encrypted field "${field}" is missing or not a string.`);
  }
  const buf = Buffer.from(value, 'base64');
  if (buf.length !== bytes) {
    throw new InvalidCiphertextError(
      `Encrypted field "${field}" must decode to exactly ${bytes} bytes (got ${buf.length}).`,
    );
  }
  return buf;
}

/** Assert a decoded buffer is exactly `bytes` long. Used for slices of a packed binary blob. */
export function assertExactLength(buf: Buffer, bytes: number, field: string): Buffer {
  if (buf.length !== bytes) {
    throw new InvalidCiphertextError(
      `Encrypted field "${field}" must be exactly ${bytes} bytes (got ${buf.length}).`,
    );
  }
  return buf;
}
