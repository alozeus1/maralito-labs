import 'server-only';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, refunds, refundStatusHistory, newId } from '@maralito/db';
import {
  assertRefundTransition,
  type RefundStatus,
} from '@/domain/payments/refund-state-machine';
import { writeAudit } from './audit';
import { emitRefundEvent } from './refund-events';

/** to-status → canonical event/audit name (ADR-0015 taxonomy). */
const NAME_FOR: Record<RefundStatus, string> = {
  requested: 'refund.requested',
  processing: 'refund.processing',
  succeeded: 'refund.succeeded',
  failed: 'refund.failed',
  canceled: 'refund.canceled',
};

/**
 * THE single refund status-mutation seam (Phase 8D, ADR-0015). Asserts legality, updates the refund
 * status, writes a refund_status_history row (from/to), audits, and emits a placeholder event.
 * Runs privileged + audited. Authorization/preconditions are checked by the CALLER (action/webhook).
 *
 * DELIBERATELY refund-only: it does NOT move money and does NOT cascade payment/order status. Money is
 * settled by Stripe (TEST mode in dev). Any payment/order consistency on a SUCCEEDED refund (e.g. marking
 * the payment refunded) is handled by the caller layer in 8D.4 — never automatically here, and never for
 * a `failed` refund (the payment stays `paid`).
 */
export async function transitionRefund(
  r: { id: string; orgId: string; paymentId: string; orderId: string; status: RefundStatus },
  to: RefundStatus,
  actor: { userId: string; role: string },
  meta?: {
    providerEventId?: string;
    reason?: string;
    payloadSummary?: Record<string, unknown>;
  },
): Promise<void> {
  assertRefundTransition(r.status, to);

  await withPrivilegedDbAccess(`refund.transition:${r.status}->${to}`, async (db) => {
    await db
      .update(refunds)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(refunds.id, r.id));
    await db.insert(refundStatusHistory).values({
      id: newId('rsh'),
      orgId: r.orgId,
      refundId: r.id,
      paymentId: r.paymentId,
      orderId: r.orderId,
      fromStatus: r.status,
      toStatus: to,
      providerEventId: meta?.providerEventId ?? null,
      reason: meta?.reason ?? null,
    });
  });

  await writeAudit({
    action: NAME_FOR[to],
    orgId: r.orgId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    entityType: 'refund',
    entityId: r.id,
    before: { status: r.status },
    after: {
      status: to,
      ...(meta?.providerEventId ? { provider_event_id: meta.providerEventId } : {}),
      ...(meta?.reason ? { reason: meta.reason } : {}),
    },
  });

  await emitRefundEvent(NAME_FOR[to], {
    refund_id: r.id,
    payment_id: r.paymentId,
    order_id: r.orderId,
  });
}
