import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';
import { orders } from './orders';
import { payments } from './payments';
import { inspections } from './inspections';
import { deliveryPreparations } from './delivery-preparations';

/**
 * Notification outbox PLACEHOLDER (ADR-0011 + ADR-0012). Development-only.
 *
 * A queue ledger for receipts/lifecycle notifications. Phase 5 enqueues a placeholder on payment
 * succeeded; Phase 6 also enqueues placeholders on inspection/delivery milestones — there is NO
 * provider, NO send, and NO rendered message. It stores ONLY safe references + queue metadata. It MUST
 * NOT contain a message body, email, phone, postal address, address content, card data, RFC/KYC/PII,
 * staff notes, or any raw provider payload. Real provider adapters + rendering are a later phase.
 */
export const NOTIFICATION_CHANNELS = ['receipt_placeholder', 'lifecycle_placeholder'] as const;
export const NOTIFICATION_TEMPLATE_KEYS = [
  'payment_receipt',
  'inspection_update',
  'delivery_update',
] as const;
export const NOTIFICATION_STATUSES = ['queued'] as const; // 'sent'/'failed' arrive with a real provider

export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: text('id').primaryKey(), // nob_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    // Exactly one of payment/inspection/delivery-prep is set, depending on template_key (all nullable).
    paymentId: text('payment_id').references(() => payments.id),
    inspectionId: text('inspection_id').references(() => inspections.id),
    deliveryPrepId: text('delivery_prep_id').references(() => deliveryPreparations.id),
    channel: text('channel').$type<(typeof NOTIFICATION_CHANNELS)[number]>().notNull(),
    templateKey: text('template_key')
      .$type<(typeof NOTIFICATION_TEMPLATE_KEYS)[number]>()
      .notNull(),
    status: text('status')
      .$type<(typeof NOTIFICATION_STATUSES)[number]>()
      .notNull()
      .default('queued'),
    idempotencyKey: text('idempotency_key').notNull(), // e.g. receipt:<payment_id>, inspection_update:<id>:<status>
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('notification_outbox_org_idx').on(t.orgId),
    customerIdx: index('notification_outbox_customer_idx').on(t.customerId),
    orderIdx: index('notification_outbox_order_idx').on(t.orderId),
    paymentIdx: index('notification_outbox_payment_idx').on(t.paymentId),
    idemUq: uniqueIndex('notification_outbox_idem_uq').on(t.idempotencyKey), // dedupe duplicate enqueues
  }),
);
