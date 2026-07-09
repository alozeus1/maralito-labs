import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { customerProfiles } from './profiles';
import { orders } from './orders';

// Concierge messaging thread. One row per message between a customer and the concierge/staff team,
// optionally attached to an order. `sender_role` distinguishes customer vs staff authorship. Body is
// free-text; in a real-PII deployment message-at-rest encryption is considered alongside the KMS
// work (ADR-0012/0015) — for the synthetic/dev phase it is stored plainly.
export const MESSAGE_SENDER_ROLES = ['customer', 'staff'] as const;

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfiles.id),
    // Optional link to an order this message is about (null = general concierge thread).
    orderId: text('order_id').references(() => orders.id),
    senderRole: text('sender_role').$type<(typeof MESSAGE_SENDER_ROLES)[number]>().notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    customerIdx: index('messages_customer_idx').on(t.customerId, t.createdAt),
    orderIdx: index('messages_order_idx').on(t.orderId),
  }),
);
