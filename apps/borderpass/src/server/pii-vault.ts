import 'server-only';
import { and, eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, encryptedPii, newId } from '@maralito/db';
import { encryptPII, decryptPII, isKmsConfigured, type EncryptedField } from '@maralito/crypto';

/**
 * Phase 8B (ADR-0017) — server-only PII vault. Wraps @maralito/crypto envelope encryption + the
 * privileged-only `encrypted_pii` table. Plaintext PII never leaves the server and is never logged.
 *
 * DEV-ONLY / SYNTHETIC: with the local KMS provider this stores synthetic data only. Storing REAL PII
 * requires a production cloud-KMS provider + validation + owner sign-off (see decision-kms.md / ADR-0017);
 * the local provider is fail-closed in production, so this cannot silently protect real prod PII.
 */
export type PiiSubjectType = 'delivery_address' | 'customer_rfc' | 'customer_kyc' | 'document';

export interface StoreEncryptedPiiInput {
  orgId: string;
  subjectType: PiiSubjectType;
  subjectRef: string; // opaque ref (delivery_address_ref, customer_id, …)
  value: unknown; // JSON-serializable PII; encrypted before it ever touches the DB
}

/** Encrypt + upsert a PII record (one per org+type+ref). Returns the row id. Throws if KMS not configured. */
export async function storeEncryptedPII(input: StoreEncryptedPiiInput): Promise<{ id: string }> {
  if (!isKmsConfigured()) throw new Error('KMS not configured; cannot store encrypted PII.');
  const field = await encryptPII(input.value); // envelope-encrypt (throws in prod with the local provider)
  const id = newId('epi');
  await withPrivilegedDbAccess('pii.store', async (db) => {
    await db
      .insert(encryptedPii)
      .values({
        id,
        orgId: input.orgId,
        subjectType: input.subjectType,
        subjectRef: input.subjectRef,
        ciphertext: field as unknown as Record<string, unknown>,
        keyRef: field.keyRef,
      })
      .onConflictDoUpdate({
        target: [encryptedPii.orgId, encryptedPii.subjectType, encryptedPii.subjectRef],
        set: { ciphertext: field as unknown as Record<string, unknown>, keyRef: field.keyRef, updatedAt: new Date() },
      });
  });
  return { id };
}

/** Read + decrypt a PII record (server-only). Returns null if absent. Throws if KMS not configured. */
export async function readDecryptedPII<T = unknown>(args: {
  orgId: string;
  subjectType: PiiSubjectType;
  subjectRef: string;
}): Promise<T | null> {
  if (!isKmsConfigured()) throw new Error('KMS not configured; cannot read encrypted PII.');
  const row = await withPrivilegedDbAccess('pii.read', async (db) =>
    (
      await db
        .select({ ciphertext: encryptedPii.ciphertext })
        .from(encryptedPii)
        .where(
          and(
            eq(encryptedPii.orgId, args.orgId),
            eq(encryptedPii.subjectType, args.subjectType),
            eq(encryptedPii.subjectRef, args.subjectRef),
          ),
        )
        .limit(1)
    )[0] ?? null,
  );
  if (!row) return null;
  return decryptPII<T>(row.ciphertext as unknown as EncryptedField);
}

/** Convenience wrappers for the first PII use-case: a real delivery address behind its opaque ref. */
export interface DeliveryAddress {
  recipient_name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  phone?: string;
}
export function storeDeliveryAddress(orgId: string, addressRef: string, address: DeliveryAddress) {
  return storeEncryptedPII({ orgId, subjectType: 'delivery_address', subjectRef: addressRef, value: address });
}
export function readDeliveryAddress(orgId: string, addressRef: string) {
  return readDecryptedPII<DeliveryAddress>({ orgId, subjectType: 'delivery_address', subjectRef: addressRef });
}
