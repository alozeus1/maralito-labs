import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';

// Envelope encryption for PII at rest (KMS pattern, ADR-0012/0015). Each value gets a fresh 256-bit
// data-encryption key (DEK); the plaintext is sealed with AES-256-GCM under the DEK, and the DEK is
// itself wrapped with AES-256-GCM under the key-encryption key (KEK). Only wrapped material is
// stored. GCM auth tags make tampering detectable (decrypt throws). Pure — the KEK is passed in.
//
// Wire format (single text column), base64url segments:
//   v1.<dataIv>.<dataTag>.<ciphertext>.<kekIv>.<kekTag>.<wrappedDek>

const VERSION = 'v1';
const IV_BYTES = 12; // GCM standard nonce
const DEK_BYTES = 32; // AES-256
const KEK_BYTES = 32;

const b64 = (b: Buffer) => b.toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url');

function assertKek(kek: Buffer): void {
  if (!Buffer.isBuffer(kek) || kek.length !== KEK_BYTES) {
    throw new Error(`KEK must be ${KEK_BYTES} bytes`);
  }
}

/** Seal a UTF-8 plaintext into an envelope string. Returns a compact, storable token. */
export function seal(plaintext: string, kek: Buffer): string {
  assertKek(kek);
  const dek = randomBytes(DEK_BYTES);
  const dataIv = randomBytes(IV_BYTES);
  const dataCipher = createCipheriv('aes-256-gcm', dek, dataIv) as CipherGCM;
  const ciphertext = Buffer.concat([dataCipher.update(plaintext, 'utf8'), dataCipher.final()]);
  const dataTag = dataCipher.getAuthTag();

  const kekIv = randomBytes(IV_BYTES);
  const kekCipher = createCipheriv('aes-256-gcm', kek, kekIv) as CipherGCM;
  const wrappedDek = Buffer.concat([kekCipher.update(dek), kekCipher.final()]);
  const kekTag = kekCipher.getAuthTag();

  return [VERSION, dataIv, dataTag, ciphertext, kekIv, kekTag, wrappedDek]
    .map((p) => (typeof p === 'string' ? p : b64(p)))
    .join('.');
}

/** Open an envelope string back to plaintext. Throws on wrong KEK, tampering, or malformed input. */
export function open(token: string, kek: Buffer): string {
  assertKek(kek);
  const parts = token.split('.');
  if (parts.length !== 7 || parts[0] !== VERSION) throw new Error('Malformed envelope');
  const [, dataIvS, dataTagS, ctS, kekIvS, kekTagS, wrappedS] = parts;
  const wrappedDek = unb64(wrappedS!);
  const kekDecipher = createDecipheriv('aes-256-gcm', kek, unb64(kekIvS!)) as DecipherGCM;
  kekDecipher.setAuthTag(unb64(kekTagS!));
  const dek = Buffer.concat([kekDecipher.update(wrappedDek), kekDecipher.final()]);

  const dataDecipher = createDecipheriv('aes-256-gcm', dek, unb64(dataIvS!)) as DecipherGCM;
  dataDecipher.setAuthTag(unb64(dataTagS!));
  const plaintext = Buffer.concat([dataDecipher.update(unb64(ctS!)), dataDecipher.final()]);
  return plaintext.toString('utf8');
}

/** True if a value looks like a v1 envelope token (does not verify decryptability). */
export function isEnvelope(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 7 && parts[0] === VERSION;
}

/** Parse a base64/hex KEK into a 32-byte Buffer, or throw if it isn't 32 bytes. */
export function parseKek(raw: string): Buffer {
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== KEK_BYTES) throw new Error(`KEK must decode to ${KEK_BYTES} bytes`);
  return buf;
}

/** Constant-time equality for tests / token comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
