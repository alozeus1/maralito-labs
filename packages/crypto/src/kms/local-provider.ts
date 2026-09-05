import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { type KmsProvider, KmsProviderUnavailableError } from './provider';
import {
  AUTH_TAG_LENGTH,
  IV_LENGTH,
  KEY_LENGTH,
  InvalidCiphertextError,
  assertExactLength,
} from '../gcm';

/**
 * LOCAL (DEV-ONLY) KMS provider (Phase 8B, ADR-0017). Derives a 256-bit KEK from an env secret via scrypt
 * and wraps DEKs with AES-256-GCM. This is a stand-in so the envelope-encryption seam can be built + tested
 * without a live cloud KMS. It is **REFUSED in production** — the KEK material is an app secret, not an HSM,
 * so it must never protect real production PII. Real deployments supply an AWS/GCP KMS provider instead.
 *
 * The env secret (BORDERPASS_KMS_KEY) is never logged. Salt is fixed per keyRef so unwrap is deterministic;
 * confidentiality comes from the secret + AES-GCM, integrity from the GCM auth tag.
 */
export class LocalDevKmsProvider implements KmsProvider {
  readonly keyRef: string;
  readonly #kek: Buffer;

  constructor(opts: { keyMaterial: string; keyRef?: string; isProduction: boolean }) {
    if (opts.isProduction) {
      throw new KmsProviderUnavailableError(
        'LocalDevKmsProvider is dev-only and must not run in production. Configure a cloud KMS provider.',
      );
    }
    if (!opts.keyMaterial || opts.keyMaterial.length < 16) {
      throw new KmsProviderUnavailableError(
        'BORDERPASS_KMS_KEY missing or too short (>=16 chars).',
      );
    }
    this.keyRef = opts.keyRef ?? 'local-dev';
    // Derive a stable 32-byte KEK. Salt bound to keyRef so different keyRefs → different KEKs.
    this.#kek = scryptSync(opts.keyMaterial, `maralito:kek:${this.keyRef}`, KEY_LENGTH);
  }

  async wrapDataKey(dek: Buffer): Promise<string> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.#kek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    // wrapped = iv | tag | ct  (base64)
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  async unwrapDataKey(wrapped: string): Promise<Buffer> {
    if (typeof wrapped !== 'string' || wrapped.length === 0) {
      throw new InvalidCiphertextError('Wrapped data key is missing or not a string.');
    }
    const buf = Buffer.from(wrapped, 'base64');
    // `subarray` clamps silently, so a truncated blob would otherwise yield a SHORT tag that Node
    // happily accepts (GCM permits 4-16 byte tags unless `authTagLength` is pinned) and an empty
    // ciphertext. Reject anything that is not iv | tag | at-least-one-block-of-ct up front.
    const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
    if (buf.length < minLength) {
      throw new InvalidCiphertextError(
        `Wrapped data key must be at least ${minLength} bytes (got ${buf.length}).`,
      );
    }
    const iv = assertExactLength(buf.subarray(0, IV_LENGTH), IV_LENGTH, 'iv');
    const tag = assertExactLength(
      buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH),
      AUTH_TAG_LENGTH,
      'tag',
    );
    const ct = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.#kek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]); // throws on tamper/wrong key
  }
}
