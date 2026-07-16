import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Resend delivery-webhook infrastructure (Phase 8D). Two internal, privileged-only tables:
 *
 *  - `resend_webhook_events`: an idempotency ledger. Each Svix message id is recorded once so a
 *    re-delivered webhook is a no-op. Stores the event TYPE + id + outcome only — never the payload,
 *    recipient, subject, or any message content.
 *  - `email_suppressions`: recipients that hard-bounced or complained. Keyed by a SHA-256 hash of the
 *    lowercased address (NOT the raw address) so we can suppress future non-essential sends without
 *    storing a recipient's email at rest (ADR-0014 PII posture).
 *
 * Neither table is granted to the `authenticated` role — they are written and read only through the
 * privileged server seam (the webhook route + the send path's suppression check).
 */
export const RESEND_EVENT_PROCESSING_STATUSES = [
  'received',
  'processed',
  'ignored',
  'failed',
] as const;
export const EMAIL_SUPPRESSION_REASONS = ['bounced', 'complained'] as const;

export const resendWebhookEvents = pgTable(
  'resend_webhook_events',
  {
    id: text('id').primaryKey(), // rwe_<id>
    // Svix message id (unique per webhook delivery) — the idempotency key.
    svixId: text('svix_id').notNull(),
    eventType: text('event_type').notNull(), // e.g. email.delivered, email.bounced
    providerMessageId: text('provider_message_id'), // Resend email_id from the event data, if present
    processingStatus: text('processing_status')
      .$type<(typeof RESEND_EVENT_PROCESSING_STATUSES)[number]>()
      .notNull()
      .default('received'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    svixUq: uniqueIndex('resend_webhook_events_svix_uq').on(t.svixId),
    typeIdx: index('resend_webhook_events_type_idx').on(t.eventType),
    providerIdx: index('resend_webhook_events_provider_idx').on(t.providerMessageId),
  }),
);

export const emailSuppressions = pgTable(
  'email_suppressions',
  {
    id: text('id').primaryKey(), // sup_<id>
    // SHA-256 hex of the lowercased, trimmed recipient address. Never the raw address.
    emailHash: text('email_hash').notNull(),
    reason: text('reason').$type<(typeof EMAIL_SUPPRESSION_REASONS)[number]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    hashUq: uniqueIndex('email_suppressions_hash_uq').on(t.emailHash),
  }),
);
