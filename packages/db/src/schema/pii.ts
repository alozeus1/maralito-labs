import { pgTable, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

/**
 * Phase 8B (ADR-0017) — encrypted PII storage. Rows hold ONLY an envelope-encrypted blob (`ciphertext` =
 * `EncryptedField` from @maralito/crypto); plaintext PII never touches this table. Access is PRIVILEGED-ONLY
 * (RLS enabled with NO tenant policy) — customers/staff never read ciphertext; decryption happens in a
 * server-only seam. `subject_ref` links to the opaque domain reference (e.g. `delivery_address_ref`).
 *
 * NO real PII is stored until a production cloud-KMS provider is configured + validated + owner-signed
 * (see `decision-kms.md`). In dev this holds synthetic data only.
 */
export const ENCRYPTED_PII_TYPES = [
  'delivery_address',
  'customer_rfc',
  'customer_kyc',
  'document',
] as const;

export const encryptedPii = pgTable(
  'encrypted_pii',
  {
    id: text('id').primaryKey(), // epi_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    subjectType: text('subject_type').$type<(typeof ENCRYPTED_PII_TYPES)[number]>().notNull(),
    subjectRef: text('subject_ref').notNull(), // opaque ref (delivery_address_ref, customer_id, …)
    ciphertext: jsonb('ciphertext').$type<Record<string, unknown>>().notNull(), // EncryptedField envelope
    keyRef: text('key_ref').notNull(), // which KEK wrapped the DEK (rotation/provider selection)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('encrypted_pii_org_idx').on(t.orgId),
    subjectUq: uniqueIndex('encrypted_pii_subject_uq').on(t.orgId, t.subjectType, t.subjectRef),
  }),
);
