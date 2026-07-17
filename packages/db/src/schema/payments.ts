import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './identity';
import { customerProfiles } from './profiles';
import { orders } from './orders';
import { quotes } from './quotes';

/**
 * Phase 4 — Payments foundation (ADR-0010). Development-only, pre-production.
 * Stripe REFERENCES ONLY — never card numbers, CVCs, raw payment-method data, or secrets.
 * All money is integer minor units (never floats). The accepted quote total is the source of truth.
 */
export const PAYMENT_PROVIDERS = ['stripe'] as const;
export const PAYMENT_STATUSES = [
  'requires_payment',
  'processing',
  'requires_action',
  'succeeded',
  'failed',
  'canceled',
  'refunded_placeholder', // legacy (Phase 4)
  'partially_refunded', // Phase 8D (ADR-0015)
  'refunded', // Phase 8D (ADR-0015)
] as const;
export const WEBHOOK_PROCESSING_STATUSES = ['received', 'completed', 'ignored', 'failed'] as const;
/**
 * Phase 8D (ADR-0015) — refund lifecycle. TEST-mode only in dev; no live money movement.
 * `requested` → `processing` → `succeeded` | `failed` | `canceled`. Mirrors the payment machine shape.
 */
export const REFUND_STATUSES = [
  'requested',
  'processing',
  'succeeded',
  'failed',
  'canceled',
] as const;

/** Internal payment record linked to an accepted quote + its order. One order may have several attempts. */
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(), // pay_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    provider: text('provider')
      .$type<(typeof PAYMENT_PROVIDERS)[number]>()
      .notNull()
      .default('stripe'),
    status: text('status')
      .$type<(typeof PAYMENT_STATUSES)[number]>()
      .notNull()
      .default('requires_payment'),
    amountMinor: integer('amount_minor').notNull(), // = accepted quote total_minor
    currency: text('currency').$type<'USD' | 'MXN'>().notNull().default('USD'),
    // Stripe references only — no sensitive payment-method data.
    stripeCustomerId: text('stripe_customer_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'), // unused in Phase 4 (PaymentIntent), kept for forward-compat
    idempotencyKey: text('idempotency_key').notNull(), // stable per quote_id (see ADR-0010)
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('payments_org_idx').on(t.orgId),
    customerIdx: index('payments_customer_idx').on(t.customerId),
    orderIdx: index('payments_order_idx').on(t.orderId),
    quoteIdx: index('payments_quote_idx').on(t.quoteId),
    // Idempotent creation: one logical payment per provider idempotency key.
    providerKeyUq: uniqueIndex('payments_provider_key_uq').on(t.provider, t.idempotencyKey),
    // One payment row per Stripe PaymentIntent (partial — only when set).
    intentUq: uniqueIndex('payments_intent_uq')
      .on(t.stripePaymentIntentId)
      .where(sql`${t.stripePaymentIntentId} is not null`),
  }),
);

/**
 * Normalized payment event log. Doubles as payment STATUS HISTORY (from/to) and the provider-event
 * ledger. `payload_summary` is a minimal, non-sensitive summary only — never the raw Stripe payload.
 */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: text('id').primaryKey(), // pme_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    eventType: text('event_type').notNull(), // e.g. payment.status_changed, payment.webhook_received
    fromStatus: text('from_status').$type<(typeof PAYMENT_STATUSES)[number]>(),
    toStatus: text('to_status').$type<(typeof PAYMENT_STATUSES)[number]>(),
    provider: text('provider')
      .$type<(typeof PAYMENT_PROVIDERS)[number]>()
      .notNull()
      .default('stripe'),
    providerEventId: text('provider_event_id'), // Stripe event id (evt_...) when applicable
    payloadSummary: jsonb('payload_summary').$type<Record<string, unknown>>(), // minimal, non-sensitive
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paymentIdx: index('payment_events_payment_idx').on(t.paymentId),
    orderIdx: index('payment_events_order_idx').on(t.orderId),
  }),
);

/**
 * Stripe webhook idempotency ledger. `stripe_event_id` is unique so a re-delivered event is a no-op.
 * Stores minimal metadata only — never the raw payload, secrets, or card data.
 */
export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    id: text('id').primaryKey(), // swe_<id>
    stripeEventId: text('stripe_event_id').notNull(), // evt_... (unique below)
    eventType: text('event_type').notNull(),
    apiVersion: text('api_version'),
    livemode: boolean('livemode').notNull().default(false),
    processingStatus: text('processing_status')
      .$type<(typeof WEBHOOK_PROCESSING_STATUSES)[number]>()
      .notNull()
      .default('received'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    eventUq: uniqueIndex('stripe_webhook_events_event_uq').on(t.stripeEventId),
    typeIdx: index('stripe_webhook_events_type_idx').on(t.eventType),
  }),
);

/**
 * Phase 8D (ADR-0015) — Refund record. TEST-mode only in dev; Stripe refund REFERENCES ONLY, no card data,
 * no live money movement. Money in integer minor units. A payment may have several refunds (partial), but
 * the sum of succeeded refunds may never exceed the payment amount (enforced in the refund server seam).
 * All writes run via the privileged `transitionRefund` seam (RLS grants tenant SELECT only — no write policy).
 */
export const refunds = pgTable(
  'refunds',
  {
    id: text('id').primaryKey(), // ref_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    provider: text('provider')
      .$type<(typeof PAYMENT_PROVIDERS)[number]>()
      .notNull()
      .default('stripe'),
    status: text('status')
      .$type<(typeof REFUND_STATUSES)[number]>()
      .notNull()
      .default('requested'),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').$type<'USD' | 'MXN'>().notNull().default('USD'),
    stripeRefundId: text('stripe_refund_id'), // re_... (unique when set)
    reason: text('reason'), // internal or Stripe reason (duplicate|fraudulent|requested_by_customer)
    idempotencyKey: text('idempotency_key').notNull(), // stable per refund attempt (re_<payment_id>_<n>)
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('refunds_org_idx').on(t.orgId),
    paymentIdx: index('refunds_payment_idx').on(t.paymentId),
    orderIdx: index('refunds_order_idx').on(t.orderId),
    customerIdx: index('refunds_customer_idx').on(t.customerId),
    // Idempotent creation: one logical refund per provider idempotency key.
    providerKeyUq: uniqueIndex('refunds_provider_key_uq').on(t.provider, t.idempotencyKey),
    // One refund row per Stripe refund id (partial — only when set).
    refundIdUq: uniqueIndex('refunds_stripe_refund_uq')
      .on(t.stripeRefundId)
      .where(sql`${t.stripeRefundId} is not null`),
  }),
);

/**
 * Phase 8D (ADR-0015) — Stripe dispute/chargeback record. RECORD-ONLY: BorderPass never moves money in
 * response to a dispute (Stripe handles funds). Stores references + status for visibility + ops response.
 * Stripe dispute statuses are stored as text (warning_needs_response|needs_response|under_review|won|lost|…).
 */
export const DISPUTE_STATUSES = [
  'warning_needs_response',
  'warning_under_review',
  'warning_closed',
  'needs_response',
  'under_review',
  'won',
  'lost',
] as const;
export const paymentDisputes = pgTable(
  'payment_disputes',
  {
    id: text('id').primaryKey(), // dsp_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    stripeDisputeId: text('stripe_dispute_id').notNull(), // dp_... (unique below)
    status: text('status').notNull(),
    reason: text('reason'),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').$type<'USD' | 'MXN'>().notNull().default('USD'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('payment_disputes_org_idx').on(t.orgId),
    paymentIdx: index('payment_disputes_payment_idx').on(t.paymentId),
    disputeUq: uniqueIndex('payment_disputes_stripe_uq').on(t.stripeDisputeId),
  }),
);

/**
 * Phase 8D (ADR-0015) — Refund STATUS HISTORY (from/to), written by the `transitionRefund` seam.
 * STAFF-only read (mirrors payment_events / quote_status_history); customers use the projected refund record.
 * Minimal, non-sensitive summary only — never the raw Stripe payload.
 */
export const refundStatusHistory = pgTable(
  'refund_status_history',
  {
    id: text('id').primaryKey(), // rsh_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    refundId: text('refund_id')
      .notNull()
      .references(() => refunds.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    fromStatus: text('from_status').$type<(typeof REFUND_STATUSES)[number]>(),
    toStatus: text('to_status').$type<(typeof REFUND_STATUSES)[number]>().notNull(),
    providerEventId: text('provider_event_id'), // Stripe event id (evt_...) when webhook-driven
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    refundIdx: index('refund_status_history_refund_idx').on(t.refundId),
    paymentIdx: index('refund_status_history_payment_idx').on(t.paymentId),
  }),
);
