import { getKmsProvider, readKmsEnv, type KmsEnv } from './kms/config';
import { encryptField, decryptField, type EncryptedField } from './envelope';

/**
 * High-level PII encryption helpers (Phase 8B, ADR-0017). Encrypt/decrypt JSON-serializable PII objects
 * (address, RFC, KYC, document metadata) via envelope encryption + the configured KMS provider.
 *
 * The provider factory is fail-closed: the local (dev) provider throws in production, so this cannot
 * silently protect real production PII with a dev key. Callers are server-only; plaintext PII is never
 * logged and never leaves the server. Store the returned EncryptedField in a jsonb column.
 */
export async function encryptPII(
  value: unknown,
  env: KmsEnv = readKmsEnv(),
): Promise<EncryptedField> {
  const provider = getKmsProvider(env); // throws in prod with the local provider
  return encryptField(JSON.stringify(value), provider);
}

export async function decryptPII<T = unknown>(
  field: EncryptedField,
  env: KmsEnv = readKmsEnv(),
): Promise<T> {
  const provider = getKmsProvider(env);
  return JSON.parse(await decryptField(field, provider)) as T;
}
