'use server';
import { desc, eq, sql } from 'drizzle-orm';
import {
  withTenant,
  withPrivilegedDbAccess,
  notificationOutbox,
  orders,
  emailSuppressions,
} from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';

type Result<T = void> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s);
  } catch {
    return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

export interface EmailOverview {
  /** Count of outbox rows per delivery status (missing statuses = 0). */
  counts: Record<string, number>;
  /** Most recent notifications with their delivery status. */
  recent: {
    id: string;
    templateKey: string;
    status: string;
    orderRef: string;
    lastEventAt: Date | null;
    createdAt: Date;
  }[];
  /** Suppression list (bounced/complained). Addresses are stored as hashes — never shown. */
  suppressions: { count: number; recent: { reason: string; createdAt: Date }[] };
}

/**
 * Deliverability overview for the staff console. Outbox reads are staff-scoped (org RLS via
 * withTenant); the suppression list is privileged-only (no tenant grant) and carries no address —
 * only reason + timestamp are surfaced.
 */
export async function adminEmailOverview(): Promise<Result<EmailOverview>> {
  const { s, err } = await staffGuard();
  if (err || !s) return { ok: false, error: err ?? { code: 'unknown', message: 'Unavailable.' } };

  try {
    const ctx = { authUserId: s.sub, orgId: s.orgId };

    const countRows = await withTenant(ctx, (tx) =>
      tx
        .select({ status: notificationOutbox.status, n: sql<number>`count(*)::int` })
        .from(notificationOutbox)
        .groupBy(notificationOutbox.status),
    );
    const counts: Record<string, number> = {};
    for (const r of countRows) counts[r.status] = r.n;

    const recent = await withTenant(ctx, (tx) =>
      tx
        .select({
          id: notificationOutbox.id,
          templateKey: notificationOutbox.templateKey,
          status: notificationOutbox.status,
          orderRef: orders.orderRef,
          lastEventAt: notificationOutbox.lastEventAt,
          createdAt: notificationOutbox.createdAt,
        })
        .from(notificationOutbox)
        .innerJoin(orders, eq(notificationOutbox.orderId, orders.id))
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(25),
    );

    const [suppCount, suppRecent] = await withPrivilegedDbAccess(
      'admin.email.suppressions',
      async (db) => {
        const c = await db.select({ n: sql<number>`count(*)::int` }).from(emailSuppressions);
        const r = await db
          .select({ reason: emailSuppressions.reason, createdAt: emailSuppressions.createdAt })
          .from(emailSuppressions)
          .orderBy(desc(emailSuppressions.createdAt))
          .limit(10);
        return [c[0]?.n ?? 0, r] as const;
      },
    );

    return {
      ok: true,
      data: { counts, recent, suppressions: { count: suppCount, recent: suppRecent } },
    };
  } catch {
    return { ok: false, error: { code: 'query_failed', message: 'Could not load email status.' } };
  }
}
