import { pgTable, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
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
  'requires_payment', 'processing', 'requires_action',
  'succeeded', 'failed', 'canceled', 'refunded_placeholder',
] as const;
export const WEBHOOK_PROCESSING_STATUSES = ['received', 'completed', 'ignored', 'failed'] as const;
export const REFUND_STATUSES = ['placeholder'] as const;

/** Internal payment record linked to an accepted quote + its order. One order may have several attempts. */
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(), // pay_<id>
    orgId: text('org_id').notNull().references(() => organizations.id),
    customerId: text('customer_id').notNull().references(() => customerProfiles.id),
    orderId: text('order_id').notNull().references(() => orders.id),
    quoteId: text('quote_id').notNull().references(() => quotes.id),
    provider: text('provider').$type<(typeof PAYMENT_PROVIDERS)[number]>().notNull().default('stripe'),
    status: text('status').$type<(typeof PAYMENT_STATUSES)[number]>().notNull().default('requires_payment'),
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
    intentUq: uniqueIndex('payments_intent_uq').on(t.stripePaymentIntentId).where(sql`${t.stripePaymentIntentId} is not null`),
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
    orgId: text('org_id').notNull().references(() => organizations.id),
    paymentId: text('payment_id').notNull().references(() => payments.id),
    orderId: text('order_id').notNull().references(() => orders.id),
    quoteId: text('quote_id').notNull().references(() => quotes.id),
    eventType: text('event_type').notNull(), // e.g. payment.status_changed, payment.webhook_received
    fromStatus: text('from_status').$type<(typeof PAYMENT_STATUSES)[number]>(),
    toStatus: text('to_status').$type<(typeof PAYMENT_STATUSES)[number]>(),
    provider: text('provider').$type<(typeof PAYMENT_PROVIDERS)[number]>().notNull().default('stripe'),
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
    processingStatus: text('processing_status').$type<(typeof WEBHOOK_PROCESSING_STATUSES)[number]>().notNull().default('received'),
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
 * Refund PLACEHOLDER (schema only — no refund logic in Phase 4). Present so future phases extend
 * cleanly. Money in integer minor units; Stripe refund reference only.
 */
export const refunds = pgTable(
  'refunds',
  {
    id: text('id').primaryKey(), // ref_<id>
    orgId: text('org_id').notNull().references(() => organizations.id),
    paymentId: text('payment_id').notNull().references(() => payments.id),
    stripeRefundId: text('stripe_refund_id'),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').$type<'USD' | 'MXN'>().notNull().default('USD'),
    status: text('status').$type<(typeof REFUND_STATUSES)[number]>().notNull().default('placeholder'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ paymentIdx: index('refunds_payment_idx').on(t.paymentId) }),
);
