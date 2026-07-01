import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'customer_tenant' | 'internal'>().notNull().default('customer_tenant'),
  status: text('status').$type<'active' | 'suspended'>().notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userIdentities = pgTable(
  'user_identities',
  {
    id: text('id').primaryKey(),
    authUserId: uuid('auth_user_id').notNull().unique(),
    orgId: text('org_id').notNull().references(() => organizations.id),
    status: text('status').$type<'active' | 'suspended' | 'deleted'>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index('user_identities_org_idx').on(t.orgId) }),
);
