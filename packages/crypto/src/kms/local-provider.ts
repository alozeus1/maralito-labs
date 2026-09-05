import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { type KmsProvider, KmsProviderUnavailableError } from './provider';

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
    this.#kek = scryptSync(opts.keyMaterial, `maralito:kek:${this.keyRef}`, 32);
  }

  async wrapDataKey(dek: Buffer): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#kek, iv);
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    // wrapped = iv | tag | ct  (base64)
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  async unwrapDataKey(wrapped: string): Promise<Buffer> {
    const buf = Buffer.from(wrapped, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.#kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]); // throws on tamper/wrong key
  }
}
