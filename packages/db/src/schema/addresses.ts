import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';

// Customer delivery/hub addresses. PII fields are stored as SEALED envelope tokens (KMS, ADR-0012/
// 0015) — never plaintext. Only non-PII metadata (label, country, kind) is stored in the clear.
// Staff never read the PII body; fulfillment references the opaque address id (ADR-0012 strict
// address policy). Decryption happens only server-side for the owning customer.
export const ADDRESS_KINDS = ['delivery', 'hub'] as const;

export const addresses = pgTable(
  'addresses',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    kind: text('kind').$type<(typeof ADDRESS_KINDS)[number]>().notNull().default('delivery'),
    // Non-PII metadata (clear).
    label: text('label'),
    country: text('country').$type<'MX' | 'US'>(),
    // Sealed PII (envelope tokens). *_enc columns hold ciphertext, never plaintext.
    recipientEnc: text('recipient_enc').notNull(),
    line1Enc: text('line1_enc').notNull(),
    line2Enc: text('line2_enc'),
    cityEnc: text('city_enc').notNull(),
    stateEnc: text('state_enc').notNull(),
    postalEnc: text('postal_enc').notNull(),
    phoneEnc: text('phone_enc'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ customerIdx: index('addresses_customer_idx').on(t.customerId) }),
);
