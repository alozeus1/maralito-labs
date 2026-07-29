/**
 * @maralito/crypto — KMS provider abstraction (Phase 8B, ADR-0017). Development-only.
 *
 * A KmsProvider is the Key-Encryption-Key (KEK) custodian. It NEVER sees plaintext PII — it only wraps
 * and unwraps per-record Data-Encryption-Keys (DEKs). This is the envelope-encryption contract: the app
 * generates a random DEK, encrypts data with it (AES-256-GCM), and asks the provider to wrap the DEK.
 *
 * The local (dev) provider derives the KEK from an env secret and is REFUSED in production. Real
 * environments must supply a cloud-KMS provider (AWS KMS / GCP KMS) whose KEK never leaves the HSM.
 */
export interface KmsProvider {
  /** Stable identifier of the key this provider wraps with (goes into every ciphertext envelope). */
  readonly keyRef: string;
  /** Wrap (encrypt) a plaintext data key. Returns opaque base64 (never the KEK). */
  wrapDataKey(dek: Buffer): Promise<string>;
  /** Unwrap (decrypt) a previously wrapped data key. Throws on tamper / wrong key. */
  unwrapDataKey(wrapped: string): Promise<Buffer>;
}

export class KmsProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KmsProviderUnavailableError';
  }
}
