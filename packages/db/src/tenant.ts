import { sql } from 'drizzle-orm';
import { getDb, type Db } from './client';

/** Identity context applied to a request-scoped transaction so Supabase RLS is exercised. */
export interface TenantContext {
  authUserId: string;
  orgId?: string;
  role?: string;
}
export type EnforcementMode = 'strict' | 'claims_only';
type TxRunner<T> = (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>;

/**
 * Run protected reads/writes with request identity so RLS applies. The wrapper owns the DB client
 * (domain code never holds a raw client). One transaction: set request.jwt.claims (+sub +org), then
 * assume the RLS-enforcing role. strict (default) = FAIL CLOSED if the role can't be assumed.
 * Fallback strategies (direct conn / claims-only / Supabase-client executor) swap HERE — see
 * docs/phase-1.6/live-supabase-rls-gate.md — without changing domain code.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: TxRunner<T>,
  mode: EnforcementMode = 'strict',
): Promise<T> {
  const db = getDb();
  const role = ctx.role ?? 'authenticated';
  const claims = JSON.stringify({ sub: ctx.authUserId, role, org_id: ctx.orgId ?? null });
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${ctx.authUserId}, true)`);
    if (ctx.orgId)
      await tx.execute(sql`select set_config('app.current_org_id', ${ctx.orgId}, true)`);
    if (mode === 'strict') await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/** Probe (real DB / CI gate): can this connection assume `authenticated` in a tx? Never throws. */
export async function canAssumeAuthenticatedRole(): Promise<boolean> {
  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`reset role`);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Privileged DB execution path. **NOTE:** this means "run as the privileged base DATABASE_URL
 * connection role (RLS bypassed)", NOT the Supabase `service_role` API key. Allowed ONLY for:
 * seed/bootstrap, audit writes, role/admin maintenance, new-user provisioning, system ops that
 * can't run as the tenant. Requires a `reason`; callers SHOULD emit an audit record. Server-only.
 */
export async function withPrivilegedDbAccess<T>(
  reason: string,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!reason || reason.trim().length < 3) {
    throw new Error('withPrivilegedDbAccess requires a justification reason');
  }
  return fn(getDb());
}

/** @deprecated Renamed for accuracy — use `withPrivilegedDbAccess`. Kept as a thin alias. */
export const withServiceRole = <T>(reason: string, fn: (db: Db) => Promise<T>): Promise<T> =>
  withPrivilegedDbAccess(reason, fn);
