import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';
import { orders } from './orders';

export const QUOTE_STATUSES = [
  'draft',
  'pending_finance_approval',
  'approved',
  'sent_to_customer',
  'accepted',
  'declined',
  'expired',
  'cancelled',
  'superseded',
] as const;
export const QUOTE_LINE_KINDS = [
  'product_cost',
  'service_fee',
  'delivery_fee',
  'estimated_import_tax',
  'inspection_fee',
  'discount',
  'adjustment',
  'other',
] as const;
export const APPROVAL_DECISIONS = ['approve', 'reject', 'request_changes'] as const;

/** Quote for an order. All money is integer minor units (never floats). contracts/01 B7. */
export const quotes = pgTable(
  'quotes',
  {
    id: text('id').primaryKey(), // qte_<id>
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    status: text('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    currency: text('currency').$type<'USD' | 'MXN'>().notNull().default('USD'),
    subtotalMinor: integer('subtotal_minor').notNull().default(0),
    serviceFeeMinor: integer('service_fee_minor').notNull().default(0),
    deliveryFeeMinor: integer('delivery_fee_minor').notNull().default(0),
    estimatedTaxMinor: integer('estimated_tax_minor').notNull().default(0),
    inspectionFeeMinor: integer('inspection_fee_minor').notNull().default(0),
    discountMinor: integer('discount_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull().default(0),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    declineReason: text('decline_reason'),
    internalNotes: text('internal_notes'), // staff-only (never projected to customer)
    customerMessage: text('customer_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdx: index('quotes_order_idx').on(t.orderId),
    queueIdx: index('quotes_queue_idx').on(t.orgId, t.status, t.createdAt),
    customerIdx: index('quotes_customer_idx').on(t.customerId),
    expiresIdx: index('quotes_expires_idx').on(t.expiresAt),
    orderVersionUq: uniqueIndex('quotes_order_version_uq').on(t.orderId, t.version),
  }),
);

export const quoteLineItems = pgTable(
  'quote_line_items',
  {
    id: text('id').primaryKey(), // qli_<id>
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    kind: text('kind').$type<(typeof QUOTE_LINE_KINDS)[number]>().notNull(),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitAmountMinor: integer('unit_amount_minor').notNull(),
    totalAmountMinor: integer('total_amount_minor').notNull(),
    currency: text('currency').$type<'USD' | 'MXN'>().notNull(),
    taxable: boolean('taxable').notNull().default(false),
    customerVisible: boolean('customer_visible').notNull().default(true),
    internalOnly: boolean('internal_only').notNull().default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ quoteIdx: index('quote_line_items_quote_idx').on(t.quoteId) }),
);

export const quoteStatusHistory = pgTable(
  'quote_status_history',
  {
    id: text('id').primaryKey(), // qsh_<id>
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorRole: text('actor_role'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ quoteIdx: index('quote_status_history_quote_idx').on(t.quoteId) }),
);

export const quoteApprovals = pgTable(
  'quote_approvals',
  {
    id: text('id').primaryKey(), // qap_<id>
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    approverId: uuid('approver_id').notNull(),
    decision: text('decision').$type<(typeof APPROVAL_DECISIONS)[number]>().notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ quoteIdx: index('quote_approvals_quote_idx').on(t.quoteId) }),
);
