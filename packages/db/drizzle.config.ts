import type { Config } from 'drizzle-kit';

// Migrations apply against Supabase Postgres (DATABASE_URL). RLS policies live in src/rls/policies.sql
// and are applied as a follow-on migration step (see docs/phase-1/rls-strategy.md).
export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
} satisfies Config;
