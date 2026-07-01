import { pgTable, text, uuid, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

export const customerProfiles = pgTable(
  'customer_profiles',
  {
    id: text('id').primaryKey(),
    authUserId: uuid('auth_user_id').notNull().unique(),
    orgId: text('org_id').notNull().references(() => organizations.id),
    displayName: text('display_name').notNull(),
    language: text('language').$type<'en' | 'es'>().notNull().default('es'),
    notificationPrefs: jsonb('notification_prefs').$type<{
      channels?: string[];
      quietHours?: { start: string; end: string; tz: string };
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index('customer_profiles_org_idx').on(t.orgId) }),
);

export const staffProfiles = pgTable(
  'staff_profiles',
  {
    id: text('id').primaryKey(),
    authUserId: uuid('auth_user_id').notNull().unique(),
    orgId: text('org_id').notNull().references(() => organizations.id),
    displayName: text('display_name').notNull(),
    roleKeys: jsonb('role_keys').$type<string[]>().notNull().default([]),
    status: text('status').$type<'active' | 'inactive' | 'on_leave'>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('staff_profiles_org_idx').on(t.orgId),
    statusIdx: index('staff_profiles_status_idx').on(t.orgId, t.status),
  }),
);
