import 'server-only';
import { eq } from 'drizzle-orm';
import { orders } from '@maralito/db';
import { assertTransition, type OrderStatus } from '@/domain/orders/state-machine';
import { writeAudit } from './audit';
import { emitOrderEvent } from './order-events';
import { withPrivilegedDbAccess } from '@maralito/db';

import type { Db } from '@maralito/db';
// Accepts either a withTenant transaction or a privileged Db — both expose .update().
type OrderWriter = Pick<Db, 'update'>;

/**
 * THE single controlled status-mutation seam. Validates the transition, updates status, audits +
 * emits an event placeholder. A durable Inngest workflow will wrap this in a later phase; until
 * then this is the only sanctioned way order.status changes (no ad-hoc status writes).
 */
export async function transitionOrder(
  tx: OrderWriter,
  order: { id: string; orgId: string; status: OrderStatus },
  to: OrderStatus,
  actor: { userId: string; role: string },
  meta?: { reason?: string },
): Promise<void> {
  assertTransition(order.status, to);
  const patch: Record<string, unknown> = { status: to, updatedAt: new Date() };
  if (to === 'submitted') patch.submittedAt = new Date();
  if (to === 'cancelled' && meta?.reason) patch.cancelledReason = meta.reason;
  await tx.update(orders).set(patch).where(eq(orders.id, order.id));
  await writeAudit({
    action: 'order.status_changed', orgId: order.orgId, actorUserId: actor.userId, actorRole: actor.role,
    entityType: 'order', entityId: order.id, before: { status: order.status }, after: { status: to, ...(meta ?? {}) },
  });
  await emitOrderEvent(`borderpass.order.${to}`, { order_id: order.id, correlation_id: order.id });
}

/** Privileged self-managing order transition (system cascade from quote actions). Audited. */
export async function transitionOrderPrivileged(
  order: { id: string; orgId: string; status: OrderStatus },
  to: OrderStatus,
  actor: { userId: string; role: string },
  meta?: { reason?: string },
): Promise<void> {
  await withPrivilegedDbAccess(`order.cascade:${order.status}->${to}`, (db) => transitionOrder(db, order, to, actor, meta));
}
