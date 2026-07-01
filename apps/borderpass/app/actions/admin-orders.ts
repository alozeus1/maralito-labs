'use server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, orders } from '@maralito/db';
import { requireAdminAccess, requireRole } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { transitionOrder } from '@/server/order-transitions';
import { ORDER_STATUSES, type OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s);
  } catch {
    return { s: null, err: { code: 'not_found', message: 'Not found.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/** List org orders (RLS staff_select scopes to org). Read-only triage. */
export async function adminListOrders(): Promise<
  Result<{ id: string; order_ref: string; status: string; service_type: string }[]>
> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
    return {
      ok: true,
      data: rows.map((o) => ({
        id: o.id,
        order_ref: o.orderRef,
        status: o.status,
        service_type: o.serviceType,
      })),
    };
  });
}

export async function adminGetOrder(orderId: string): Promise<Result<unknown>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    return o
      ? { ok: true, data: o }
      : { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
  });
}

/** Advance an order to a new status (ops_manager/super_admin only) via the transition seam. */
export async function advanceOrder(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  const parsed = z
    .object({ order_id: z.string().regex(/^ord_/), to_status: z.enum(ORDER_STATUSES) })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };
  try {
    requireRole(s, 'operations_manager');
  } catch {
    return { ok: false, error: { code: 'forbidden', message: 'Requires operations_manager.' } };
  }
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(orders.id, parsed.data.order_id) });
    if (!o) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    try {
      await transitionOrder(
        tx,
        { id: o.id, orgId: o.orgId, status: o.status as OrderStatus },
        parsed.data.to_status,
        { userId: s.sub, role: 'operations_manager' },
      );
    } catch (e) {
      return { ok: false, error: { code: 'conflict_state', message: (e as Error).message } };
    }
    return { ok: true };
  });
}

/** Place an order on hold (audit-only placeholder; a hold flag/status arrives in a later phase). */
export async function holdOrder(orderId: string, reason: string): Promise<Result> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  try {
    requireRole(s, 'operations_manager');
  } catch {
    return { ok: false, error: { code: 'forbidden', message: 'Requires operations_manager.' } };
  }
  await writeAudit({
    action: 'order.hold',
    orgId: s.orgId,
    actorUserId: s.sub,
    actorRole: 'operations_manager',
    entityType: 'order',
    entityId: orderId,
    metadata: { reason },
  });
  return { ok: true };
}
