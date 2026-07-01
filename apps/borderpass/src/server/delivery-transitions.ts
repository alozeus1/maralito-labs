import 'server-only';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, deliveryPreparations, deliveryPrepStatusHistory, orders, newId } from '@maralito/db';
import { assertDeliveryPrepTransition, type DeliveryPrepStatus } from '@/domain/delivery/state-machine';
import { deliveryOrderJoinTarget, shouldNotifyDelivery } from '@/domain/delivery/rules';
import type { OrderStatus } from '@/domain/orders/state-machine';
import { writeAudit } from './audit';
import { transitionOrderPrivileged } from './order-transitions';
import { emitDeliveryEvent } from './delivery-events';
import { queueDeliveryUpdateNotification } from './notifications';

/** to → canonical audit action (status only; no address PII / staff_notes). */
const AUDIT_ACTION: Record<DeliveryPrepStatus, string> = {
  pending: 'delivery.prep_pending',
  preparing: 'delivery.preparing',
  ready: 'delivery.ready',
  scheduled: 'delivery.scheduled',
  handed_off: 'delivery.handed_off',
};

/**
 * THE single delivery-prep status-mutation seam (Phase 6, ADR-0012). Asserts legality, updates the
 * record (+ safe fields), writes delivery_prep_status_history, audits. Privileged + audited; the CALLER
 * (staff action) checks authorization. NEVER stores real address PII (only an opaque address ref).
 *
 * Order join (existing edges only): on `handed_off`, and ONLY when the order is at `arrived_juarez`,
 * drives `arrived_juarez → out_for_delivery` via transitionOrderPrivileged (idempotent / only-if-expected).
 * NEVER updates the orders table directly; NEVER forces an illegal order transition.
 */
export async function transitionDeliveryPrep(
  d: { id: string; orgId: string; orderId: string; status: DeliveryPrepStatus },
  to: DeliveryPrepStatus,
  actor: { userId: string; role: string },
  meta?: {
    reason?: string;
    customerSummary?: string;
    scheduledWindowStart?: Date;
    scheduledWindowEnd?: Date;
    deliveryAddressRef?: string; // OPAQUE reference only — never address content/PII
  },
): Promise<void> {
  assertDeliveryPrepTransition(d.status, to);

  await withPrivilegedDbAccess(`delivery_prep.transition:${d.status}->${to}`, async (db) => {
    const patch: Record<string, unknown> = { status: to, updatedAt: new Date() };
    if (meta?.customerSummary !== undefined) patch.customerSummary = meta.customerSummary;
    if (meta?.scheduledWindowStart !== undefined) patch.scheduledWindowStart = meta.scheduledWindowStart;
    if (meta?.scheduledWindowEnd !== undefined) patch.scheduledWindowEnd = meta.scheduledWindowEnd;
    if (meta?.deliveryAddressRef !== undefined) patch.deliveryAddressRef = meta.deliveryAddressRef;
    await db.update(deliveryPreparations).set(patch).where(eq(deliveryPreparations.id, d.id));
    await db.insert(deliveryPrepStatusHistory).values({
      id: newId('dph'), orgId: d.orgId, deliveryPrepId: d.id, orderId: d.orderId,
      fromStatus: d.status, toStatus: to, actorUserId: actor.userId, actorRole: actor.role, reason: meta?.reason ?? null,
    });
  });

  await writeAudit({
    action: AUDIT_ACTION[to], orgId: d.orgId, actorUserId: actor.userId, actorRole: actor.role,
    entityType: 'delivery_preparation', entityId: d.id, before: { status: d.status }, after: { status: to },
  });
  // Event placeholder (refs + status only; no staff_notes/address/PII). Emitted only after success.
  await emitDeliveryEvent(AUDIT_ACTION[to], { delivery_prep_id: d.id, order_id: d.orderId, status: to });

  // Order join — existing legal edge only, only-if-expected.
  const order = await withPrivilegedDbAccess('delivery_prep.join.read_order', async (db) => {
    const rows = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, d.orderId)).limit(1);
    return rows[0] ?? null;
  });
  const target = order ? deliveryOrderJoinTarget(to, order.status as OrderStatus) : null;
  if (target) {
    await transitionOrderPrivileged({ id: d.orderId, orgId: d.orgId, status: 'arrived_juarez' }, target, actor);
  }

  // Scoped milestone notification placeholder (idempotent; no provider/send/body/PII/address).
  if (shouldNotifyDelivery(to)) {
    await queueDeliveryUpdateNotification({ deliveryPrepId: d.id, status: to });
  }
}
