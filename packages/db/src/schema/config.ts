import { pgTable, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';

/** Placeholder for platform/app config (versioned rules engine lands later). */
export const platformConfig = pgTable('platform_config', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Placeholder feature flags (decouple deploy from release). */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
