import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

/**
 * INTERNAL raw Drizzle client. Connects as the DATABASE_URL role and DOES NOT exercise RLS by
 * itself. **Domain/app code must NOT import this** — use `withTenant` / `withPrivilegedDbAccess`.
 * Allowed callers: migrations, seed, and test setup only. (Enforced by lint + CI scan.)
 */
export function createRawDbClient(connectionString: string) {
  const sql = postgres(connectionString, { prepare: false });
  return drizzle(sql, { schema });
}
export type Db = ReturnType<typeof createRawDbClient>;

let _singleton: Db | null = null;
/** Server-only singleton used internally by the tenant/privileged wrappers. */
export function getDb(): Db {
  if (!_singleton) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required for database access');
    _singleton = createRawDbClient(url);
  }
  return _singleton;
}

export * from './tenant';
