import 'server-only';
import { seal, open, parseKek } from '@/domain/crypto/envelope';
import { getServerEnv } from './env';

// Server-side KMS facade. Loads the KEK from BORDERPASS_KMS_KEY once and seals/opens PII via the
// envelope module. Fails closed when the key is absent so PII is never written or read in the clear.
let kek: Buffer | null = null;

function getKek(): Buffer {
  if (kek) return kek;
  const raw = getServerEnv().BORDERPASS_KMS_KEY;
  if (!raw) throw new Error('KMS not configured (BORDERPASS_KMS_KEY absent)');
  kek = parseKek(raw);
  return kek;
}

/** Whether PII encryption is available in this environment. */
export function isKmsConfigured(): boolean {
  return !!getServerEnv().BORDERPASS_KMS_KEY;
}

/** Seal a PII string for storage. Throws if KMS is not configured. */
export function sealPii(plaintext: string): string {
  return seal(plaintext, getKek());
}

/** Open a sealed PII token. Throws if KMS is not configured or the token is invalid/tampered. */
export function openPii(token: string): string {
  return open(token, getKek());
}

/** Seal an optional value (undefined/empty → null, so nullable columns stay null). */
export function sealOptional(value: string | undefined | null): string | null {
  const v = (value ?? '').trim();
  return v ? sealPii(v) : null;
}

/** Open an optional sealed value (null → null). */
export function openOptional(token: string | null): string | null {
  return token ? openPii(token) : null;
}
