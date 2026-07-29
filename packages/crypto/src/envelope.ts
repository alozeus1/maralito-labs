import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { KmsProvider } from './kms/provider';

/**
 * Envelope encryption (Phase 8B, ADR-0017). Per-record random Data-Encryption-Key (DEK), AES-256-GCM for
 * the payload, DEK wrapped by the KMS provider (KEK). The KEK never touches the data; the DEK never lives
 * unencrypted at rest. Integrity is the GCM auth tag — any tamper of ciphertext/iv/tag/wrappedDek fails
 * decryption. The field is a self-describing, versioned JSON blob safe to store in a jsonb column.
 */
export interface EncryptedField {
  v: 1;
  alg: 'AES-256-GCM';
  keyRef: string; // which KEK wrapped the DEK (for rotation / provider selection)
  iv: string; // base64 (12 bytes) — payload IV
  ct: string; // base64 — ciphertext
  tag: string; // base64 (16 bytes) — payload GCM auth tag
  dek: string; // base64 — the WRAPPED data key (opaque; provider-specific)
}

/** Encrypt a UTF-8 plaintext into an EncryptedField using a fresh DEK wrapped by the provider. */
export async function encryptField(plaintext: string, provider: KmsProvider): Promise<EncryptedField> {
  const dek = randomBytes(32); // 256-bit data key, unique per call
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrappedDek = await provider.wrapDataKey(dek);
  return {
    v: 1,
    alg: 'AES-256-GCM',
    keyRef: provider.keyRef,
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: tag.toString('base64'),
    dek: wrappedDek,
  };
}

/** Decrypt an EncryptedField back to UTF-8 plaintext. Throws on tamper / wrong key / bad shape. */
export async function decryptField(field: EncryptedField, provider: KmsProvider): Promise<string> {
  if (field.v !== 1 || field.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported encrypted field version/alg.');
  }
  const dek = await provider.unwrapDataKey(field.dek); // throws if wrappedDek tampered / wrong KEK
  const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(field.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(field.tag, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(field.ct, 'base64')),
    decipher.final(), // throws on payload tamper
  ]);
  return pt.toString('utf8');
}
