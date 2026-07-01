import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';
import { orders } from './orders';

/**
 * Phase 6 — Delivery-preparation domain (ADR-0012). Development-only.
 *
 * A delivery-prep record is a DOMAIN sub-status machine attached to a paid/inspected order. It does NOT
 * add order states — the order delivery edges are driven only via transitionOrder (Increment 6.4).
 *
 * ADDRESS POLICY (strict): store ONLY an opaque `delivery_address_ref` (an id pointing at a future
 * KMS-gated address record) and NON-PII scheduling windows. It MUST NOT store street, recipient name,
 * phone, postal code, address body, RFC/KYC/document content, or sensitive logistics details. Real
 * address/PII storage is deferred until KMS/secret-management is confirmed.
 */
export const DELIVERY_PREP_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'scheduled',
  'handed_off',
] as const;

export const deliveryPreparations = pgTable(
  'delivery_preparations',
  {
    id: text('id').primaryKey(), // dlp_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    status: text('status')
      .$type<(typeof DELIVERY_PREP_STATUSES)[number]>()
      .notNull()
      .default('pending'),
    deliveryAddressRef: text('delivery_address_ref'), // OPAQUE reference only — no address content/PII
    scheduledWindowStart: timestamp('scheduled_window_start', { withTimezone: true }), // non-PII slot
    scheduledWindowEnd: timestamp('scheduled_window_end', { withTimezone: true }), // non-PII slot
    staffNotes: text('staff_notes'), // STAFF-ONLY — never projected to customers; no PII/document content
    customerSummary: text('customer_summary'), // neutral, customer-safe copy
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('delivery_preparations_org_idx').on(t.orgId),
    customerIdx: index('delivery_preparations_customer_idx').on(t.customerId),
    orderIdx: index('delivery_preparations_order_idx').on(t.orderId),
    queueIdx: index('delivery_preparations_queue_idx').on(t.orgId, t.status, t.createdAt),
  }),
);

/** Delivery-prep status history (staff-only read). Mirrors inspection_status_history. */
export const deliveryPrepStatusHistory = pgTable(
  'delivery_prep_status_history',
  {
    id: text('id').primaryKey(), // dph_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    deliveryPrepId: text('delivery_prep_id')
      .notNull()
      .references(() => deliveryPreparations.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    fromStatus: text('from_status').$type<(typeof DELIVERY_PREP_STATUSES)[number]>(),
    toStatus: text('to_status').$type<(typeof DELIVERY_PREP_STATUSES)[number]>().notNull(),
    actorUserId: text('actor_user_id'),
    actorRole: text('actor_role'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ prepIdx: index('delivery_prep_status_history_prep_idx').on(t.deliveryPrepId) }),
);
