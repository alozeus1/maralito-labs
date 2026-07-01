import { pgTable, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';

/** Money is stored as { amount_minor:int, currency } JSON — never floats. */
type Money = { amount_minor: number; currency: 'USD' | 'MXN' };

export const ORDER_SERVICE_TYPES = [
  'buy_for_me',
  'package_reception',
  'local_pickup',
  'business_delivery',
] as const;
export const ORDER_PURPOSES = ['personal', 'gift', 'business', 'resale'] as const;
export const RISK_BANDS = ['LOW', 'MEDIUM', 'HIGH', 'BLOCK'] as const;

/** Order aggregate root (contracts/01 B4). Phase 2 subset — NO rfc/PII column yet (KMS gated). */
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(), // ord_<id>
    orderRef: text('order_ref').notNull(), // BP-####
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    serviceType: text('service_type').$type<(typeof ORDER_SERVICE_TYPES)[number]>().notNull(),
    status: text('status').notNull().default('draft'), // OrderStatus (25 states; see order-state-machine)
    purpose: text('purpose').$type<(typeof ORDER_PURPOSES)[number]>(),
    declaredValue: jsonb('declared_value').$type<Money>(),
    riskBand: text('risk_band').$type<(typeof RISK_BANDS)[number]>(),
    currentQuoteId: text('current_quote_id'),
    deliveryAddressId: text('delivery_address_id'),
    hubAddressId: text('hub_address_id'),
    correlationId: text('correlation_id').notNull(), // = id
    workflowRunId: text('workflow_run_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    cancelledReason: text('cancelled_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    refUq: uniqueIndex('orders_ref_uq').on(t.orderRef),
    customerIdx: index('orders_customer_idx').on(t.customerId),
    queueIdx: index('orders_queue_idx').on(t.orgId, t.status, t.createdAt),
    corrIdx: index('orders_correlation_idx').on(t.correlationId),
    riskIdx: index('orders_risk_idx').on(t.orgId, t.riskBand),
  }),
);

/** Order line item (contracts/01 B5). */
export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(), // itm_<id>
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    description: text('description').notNull(),
    productUrl: text('product_url'),
    quantity: integer('quantity').notNull().default(1),
    variant: text('variant'),
    unitValue: jsonb('unit_value').$type<Money>().notNull(),
    category: text('category'),
    restrictionFlags: jsonb('restriction_flags').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orderIdx: index('order_items_order_idx').on(t.orderId) }),
);
