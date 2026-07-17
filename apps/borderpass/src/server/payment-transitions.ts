import 'server-only';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, payments, paymentEvents, orders, newId } from '@maralito/db';
import {
  assertPaymentTransition,
  paymentSucceeds,
  type PaymentStatus,
} from '@/domain/payments/state-machine';
import { orderPaidCascadeTarget } from '@/domain/payments/rules';
import type { OrderStatus } from '@/domain/orders/state-machine';
import { writeAudit } from './audit';
import { emitPaymentEvent } from './payment-events';
import { transitionOrderPrivileged } from './order-transitions';
import { queuePaymentReceipt } from './notifications';

/** to-status → canonical event/audit name (ADR-0010 taxonomy). */
const NAME_FOR: Record<PaymentStatus, string> = {
  requires_payment: 'payment.requires_payment',
  processing: 'payment.processing',
  requires_action: 'payment.requires_action',
  succeeded: 'payment.succeeded',
  failed: 'payment.failed',
  canceled: 'payment.canceled',
  refunded_placeholder: 'payment.refunded_placeholder',
  partially_refunded: 'payment.partially_refunded',
  refunded: 'payment.refunded',
};

/**
 * THE single payment status-mutation seam. Asserts legality, updates payment status, writes a
 * payment_events row (which doubles as status history), audits, and emits a placeholder event.
 * Runs privileged + audited. Authorization/preconditions are checked by the CALLER (action/webhook).
 *
 * On `succeeded` ONLY, it cascades the related order awaiting_payment → paid via the audited order
 * seam — and ONLY when the order is actually awaiting_payment (idempotent; a re-delivered success is
 * a no-op). failed / canceled / requires_action NEVER touch order status.
 */
export async function transitionPayment(
  p: { id: string; orgId: string; orderId: string; quoteId: string; status: PaymentStatus },
  to: PaymentStatus,
  actor: { userId: string; role: string },
  meta?: {
    eventType?: string;
    providerEventId?: string;
    payloadSummary?: Record<string, unknown>;
    reason?: string;
  },
): Promise<void> {
  assertPaymentTransition(p.status, to);

  await withPrivilegedDbAccess(`payment.transition:${p.status}->${to}`, async (db) => {
    await db
      .update(payments)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(payments.id, p.id));
    await db.insert(paymentEvents).values({
      id: newId('pme'),
      orgId: p.orgId,
      paymentId: p.id,
      orderId: p.orderId,
      quoteId: p.quoteId,
      eventType: meta?.eventType ?? NAME_FOR[to],
      fromStatus: p.status,
      toStatus: to,
      provider: 'stripe',
      providerEventId: meta?.providerEventId ?? null,
      payloadSummary: meta?.payloadSummary ?? null,
    });
  });

  await writeAudit({
    action: NAME_FOR[to],
    orgId: p.orgId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    entityType: 'payment',
    entityId: p.id,
    before: { status: p.status },
    after: {
      status: to,
      ...(meta?.providerEventId ? { provider_event_id: meta.providerEventId } : {}),
    },
  });

  await emitPaymentEvent(NAME_FOR[to], {
    payment_id: p.id,
    order_id: p.orderId,
    quote_id: p.quoteId,
  });

  // Success cascade — the ONLY path that can mark an order paid, and only if it is awaiting_payment.
  if (paymentSucceeds(to)) {
    const order = await withPrivilegedDbAccess('payment.succeeded.read_order', async (db) => {
      const rows = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, p.orderId))
        .limit(1);
      return rows[0] ?? null;
    });
    if (order && orderPaidCascadeTarget(to, order.status as OrderStatus) === 'paid') {
      await transitionOrderPrivileged(
        { id: p.orderId, orgId: p.orgId, status: 'awaiting_payment' },
        'paid',
        actor,
      );
    }
    // Receipt foundation (Phase 5): enqueue exactly one placeholder receipt for the succeeded payment.
    // Idempotent + server-only; no provider, no send, no PII. failed/canceled/requires_action never reach here.
    await queuePaymentReceipt({ paymentId: p.id });
  }
}
