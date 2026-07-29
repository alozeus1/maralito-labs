import { pgTable, text, uuid, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

/**
 * LEGAL REVIEW REQUIRED — consent evidence ledger.
 *
 * Append-only record of what a user agreed to, which VERSION of the document they were shown, in
 * which LANGUAGE, and WHEN. It exists so acceptance of the Terms of Service / Privacy Notice and
 * notification opt-ins are auditable after the fact.
 *
 * The shape of this table (which fields constitute sufficient proof of consent) has NOT been
 * reviewed by a qualified lawyer for Mexico's LFPDPPP or any U.S. requirement. Treat it as a
 * template. See docs/production-readiness/legal-consent.md.
 *
 * Rules baked into this design:
 *  - IMMUTABLE. Rows are evidence: never updated, never deleted by a tenant (see
 *    src/rls/consents-policies.sql — tenants get SELECT only, and UPDATE/DELETE are revoked).
 *    Withdrawing a consent means INSERTING a new row with granted = false, not mutating the old one.
 *  - NO PII. It stores the auth user id + org id + document version + decision. It MUST NOT store
 *    an email, phone, postal address, IP address, user agent, or any free text. (IP/user-agent
 *    capture as consent evidence is deliberately deferred — those are personal data and need the
 *    production KMS + a legal decision first.)
 *  - Writes go ONLY through the privileged server seam (apps/borderpass/src/server/consent.ts);
 *    the browser/tenant role has no insert path.
 */

/** What the user is consenting to. Transactional and marketing are deliberately SEPARATE. */
export const CONSENT_TYPES = [
  'terms_of_service', // acceptance of /terms at the given version — required to use the service
  'privacy_notice', // acknowledgement of /privacy at the given version — required
  'transactional_notifications', // service messages about their own orders (quote ready, delivered)
  'marketing_communications', // promotions/offers — optional, must never be pre-ticked
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Where the decision was captured. Used to reconstruct the flow the user actually saw. */
export const CONSENT_SOURCES = ['sign_up', 'profile_settings', 'reconsent_prompt'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const consentRecords = pgTable(
  'consent_records',
  {
    id: text('id').primaryKey(), // csn_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    // Keyed on the auth user (not customer_profiles) so consent can be recorded at first sign-in,
    // before/independently of any customer profile row, and survives profile edits.
    authUserId: uuid('auth_user_id').notNull(),
    consentType: text('consent_type').$type<ConsentType>().notNull(),
    // Version of the document the user was actually shown, e.g. 'terms-2026-07-28'. Sourced from
    // apps/borderpass/src/content/legal — bump the version there and users must re-consent.
    documentVersion: text('document_version').notNull(),
    // Language the document was rendered in when accepted (es is the primary market language).
    documentLocale: text('document_locale').$type<'es' | 'en'>().notNull(),
    // true = granted/accepted, false = declined or later withdrawn (a NEW row, never an update).
    granted: boolean('granted').notNull(),
    source: text('source').$type<ConsentSource>().notNull(),
    // Dedupe key for retried submissions, e.g. 'sign_up:<auth_user_id>:terms_of_service:<version>'.
    // The seam supplies a unique key when a decision must always append (preference changes).
    idempotencyKey: text('idempotency_key').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('consent_records_org_idx').on(t.orgId),
    userIdx: index('consent_records_user_idx').on(t.authUserId),
    userTypeIdx: index('consent_records_user_type_idx').on(t.authUserId, t.consentType),
    idemUq: uniqueIndex('consent_records_idem_uq').on(t.idempotencyKey),
  }),
);
