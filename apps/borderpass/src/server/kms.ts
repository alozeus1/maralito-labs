import 'server-only';
import { seal, open, parseKek } from '@/domain/crypto/envelope';
import { getServerEnv } from './env';

// Server-side KMS facade. Loads the KEK from BORDERPASS_KMS_KEY once and seals/opens PII via the
// envelope module. Fails closed when the key is absent so PII is never written or read in the clear.
//
// ⚠️ PHASE 9 / DEFECT D3 — THIS PATH IS DEVELOPMENT-ONLY AND REFUSES TO RUN IN PRODUCTION.
// The KEK here comes straight from an environment variable. That is NOT key management: the key sits
// in the platform env, is readable by anything that can read env, has no rotation, no access audit,
// no separation of duties, and no break-glass. ADR-0017 / `decision-kms.md` (owner-signed row 16)
// require CLOUD KMS ENVELOPE ENCRYPTION before ANY real PII/RFC/KYC/address is stored.
//
// Before this fix, `createMyAddress` (a 'use server' action callable by any authenticated customer)
// stored real recipient/street/city/postal/phone through this module, and the module only failed
// closed when the env var was ABSENT. Setting BORDERPASS_KMS_KEY in a production environment would
// therefore have silently enabled real-PII storage under a dev-grade key — bypassing the fail-closed
// `LocalDevKmsProvider` in @maralito/crypto entirely. That was FAIL-OPEN. It is now fail-closed.
//
// UNBLOCK PATH (do NOT add an env override — that would re-create the hole): migrate these callers
// to the KMS-backed vault (`src/server/pii-vault.ts` → @maralito/crypto with a real AWS/GCP KMS
// provider), then delete this module. See docs/production-readiness/kms-production-plan.md.
let kek: Buffer | null = null;
/** The raw env value `kek` was derived from, so a changed/removed key is never silently reused. */
let kekSource: string | null = null;

/** True when this process is running as production (either signal counts — fail closed on both). */
function isProductionRuntime(): boolean {
  // Read process.env directly (not the parsed schema) so this check can never be bypassed by a
  // partially-parsed env, and so it still applies if BORDERPASS_ENV is unset but NODE_ENV is set.
  return (
    process.env.BORDERPASS_ENV === 'production' ||
    process.env.MARALITO_PLATFORM_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

/** Thrown when the dev-grade env-var KEK is used in production. Never carries key material. */
export class DevKmsInProductionError extends Error {
  constructor() {
    super(
      'Refusing to encrypt/decrypt PII: the environment-variable KEK is development-only and is ' +
        'disabled in production. Real PII requires cloud KMS envelope encryption (ADR-0017). ' +
        'See docs/production-readiness/kms-production-plan.md.',
    );
    this.name = 'DevKmsInProductionError';
  }
}

/** Fail closed in production BEFORE any key material is touched. */
function assertDevKmsAllowed(): void {
  if (isProductionRuntime()) throw new DevKmsInProductionError();
}

function getKek(): Buffer {
  assertDevKmsAllowed(); // must precede the cache read — production must never reuse a warm KEK
  // Re-check configuration on EVERY call, before consulting the cache. Caching the derived key is
  // fine (it avoids re-parsing), but caching the *decision* is not: if the key is removed or
  // rotated, a cached KEK would keep working against a config that no longer authorises it.
  const raw = getServerEnv().BORDERPASS_KMS_KEY;
  if (!raw) throw new Error('KMS not configured (BORDERPASS_KMS_KEY absent)');
  if (!kek || kekSource !== raw) {
    kek = parseKek(raw);
    kekSource = raw;
  }
  return kek;
}

/**
 * Whether PII encryption is available in this environment.
 * Returns FALSE in production even when BORDERPASS_KMS_KEY is set, so callers that branch on this
 * (rather than catching) also degrade closed instead of writing PII under a dev-grade key.
 */
export function isKmsConfigured(): boolean {
  if (isProductionRuntime()) return false;
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
