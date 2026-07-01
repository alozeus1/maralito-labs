import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';
import { orders } from './orders';

/**
 * Phase 6 — Inspection domain (ADR-0012). Development-only.
 *
 * An inspection record is a DOMAIN sub-status machine attached to a PAID order. It does NOT add order
 * states — the order machine is driven only at its existing join points via transitionOrder. This table
 * stores references + status + a staff-only note + a neutral customer summary. It MUST NOT store address
 * PII, RFC/KYC, document content, photos, or sensitive logistics details (KMS not confirmed).
 */
export const INSPECTION_STATUSES = ['scheduled', 'in_progress', 'on_hold', 'passed', 'failed'] as const;
export const INSPECTION_RESULTS = ['passed', 'failed'] as const;

export const inspections = pgTable(
  'inspections',
  {
    id: text('id').primaryKey(), // insp_<id>
    orgId: text('org_id').notNull().references(() => organizations.id),
    customerId: text('customer_id').notNull().references(() => customerProfiles.id),
    orderId: text('order_id').notNull().references(() => orders.id),
    status: text('status').$type<(typeof INSPECTION_STATUSES)[number]>().notNull().default('scheduled'),
    result: text('result').$type<(typeof INSPECTION_RESULTS)[number]>(), // set on passed/failed
    staffNotes: text('staff_notes'), // STAFF-ONLY — never projected to customers; no PII/document content
    customerSummary: text('customer_summary'), // neutral, customer-safe copy
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }), // non-PII scheduling timestamp
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('inspections_org_idx').on(t.orgId),
    customerIdx: index('inspections_customer_idx').on(t.customerId),
    orderIdx: index('inspections_order_idx').on(t.orderId),
    queueIdx: index('inspections_queue_idx').on(t.orgId, t.status, t.createdAt),
  }),
);

/** Inspection status history (staff-only read). Mirrors quote_status_history. */
export const inspectionStatusHistory = pgTable(
  'inspection_status_history',
  {
    id: text('id').primaryKey(), // ish_<id>
    orgId: text('org_id').notNull().references(() => organizations.id),
    inspectionId: text('inspection_id').notNull().references(() => inspections.id),
    orderId: text('order_id').notNull().references(() => orders.id),
    fromStatus: text('from_status').$type<(typeof INSPECTION_STATUSES)[number]>(),
    toStatus: text('to_status').$type<(typeof INSPECTION_STATUSES)[number]>().notNull(),
    actorUserId: text('actor_user_id'),
    actorRole: text('actor_role'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ inspectionIdx: index('inspection_status_history_inspection_idx').on(t.inspectionId) }),
);
