import 'server-only';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, inspections, inspectionStatusHistory, orders, newId } from '@maralito/db';
import { assertInspectionTransition, inspectionResultFor, type InspectionStatus } from '@/domain/inspections/state-machine';
import { inspectionOrderJoinTarget, shouldNotifyInspection } from '@/domain/inspections/rules';
import type { OrderStatus } from '@/domain/orders/state-machine';
import { writeAudit } from './audit';
import { transitionOrderPrivileged } from './order-transitions';
import { emitInspectionEvent } from './inspection-events';
import { queueInspectionUpdateNotification } from './notifications';

/** (from,to) → canonical audit action. No staff_notes / PII in audit — status only. */
function auditAction(from: InspectionStatus, to: InspectionStatus): string {
  if (to === 'in_progress') return from === 'on_hold' ? 'inspection.resumed' : 'inspection.started';
  if (to === 'on_hold') return 'inspection.held';
  if (to === 'passed') return 'inspection.passed';
  if (to === 'failed') return 'inspection.failed';
  return 'inspection.status_changed';
}

/**
 * THE single inspection status-mutation seam (Phase 6, ADR-0012). Asserts legality, updates the
 * inspection (+ result/completed_at on terminal), writes inspection_status_history, audits. Runs
 * privileged + audited. Authorization is checked by the CALLER (staff action).
 *
 * Order join (existing edges only): on a TERMINAL inspection result, and ONLY when the order is at
 * `inspection_pending`, it drives the order `inspection_pending → inspection_passed | inspection_failed`
 * via transitionOrderPrivileged (idempotent / only-if-in-expected-state). It NEVER updates the orders
 * table directly and NEVER forces an illegal order transition.
 */
export async function transitionInspection(
  i: { id: string; orgId: string; orderId: string; status: InspectionStatus },
  to: InspectionStatus,
  actor: { userId: string; role: string },
  meta?: { reason?: string; customerSummary?: string },
): Promise<void> {
  assertInspectionTransition(i.status, to);
  const result = inspectionResultFor(to);

  await withPrivilegedDbAccess(`inspection.transition:${i.status}->${to}`, async (db) => {
    const patch: Record<string, unknown> = { status: to, updatedAt: new Date() };
    if (result) { patch.result = result; patch.completedAt = new Date(); }
    if (meta?.customerSummary !== undefined) patch.customerSummary = meta.customerSummary;
    await db.update(inspections).set(patch).where(eq(inspections.id, i.id));
    await db.insert(inspectionStatusHistory).values({
      id: newId('ish'), orgId: i.orgId, inspectionId: i.id, orderId: i.orderId,
      fromStatus: i.status, toStatus: to, actorUserId: actor.userId, actorRole: actor.role, reason: meta?.reason ?? null,
    });
  });

  await writeAudit({
    action: auditAction(i.status, to), orgId: i.orgId, actorUserId: actor.userId, actorRole: actor.role,
    entityType: 'inspection', entityId: i.id, before: { status: i.status }, after: { status: to },
  });
  // Event placeholder (refs + status only; no staff_notes/PII). Emitted only after success.
  await emitInspectionEvent(auditAction(i.status, to), { inspection_id: i.id, order_id: i.orderId, status: to });

  // Order join — existing legal edges only, only-if-expected.
  if (result) {
    const order = await withPrivilegedDbAccess('inspection.join.read_order', async (db) => {
      const rows = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, i.orderId)).limit(1);
      return rows[0] ?? null;
    });
    const target = order ? inspectionOrderJoinTarget(to, order.status as OrderStatus) : null;
    if (target) {
      await transitionOrderPrivileged({ id: i.orderId, orgId: i.orgId, status: 'inspection_pending' }, target, actor);
    }
  }

  // Scoped milestone notification placeholder (idempotent; no provider/send/body/PII).
  if (shouldNotifyInspection(to)) {
    await queueInspectionUpdateNotification({ inspectionId: i.id, status: to });
  }
}
