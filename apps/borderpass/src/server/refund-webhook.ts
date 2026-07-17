import 'server-only';
import type Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import {
  withPrivilegedDbAccess,
  refunds,
  payments,
  paymentDisputes,
  newId,
} from '@maralito/db';
import {
  isLegalRefundTransition,
  type RefundStatus,
} from '@/domain/payments/refund-state-machine';
import { paymentRefundCascadeTarget } from '@/domain/payments/refund-rules';
import { isLegalPaymentTransition, type PaymentStatus } from '@/domain/payments/state-machine';
import { transitionRefund } from './refund-transitions';
import { transitionPayment } from './payment-transitions';
import { writeAudit } from './audit';
import { emitRefundEvent } from './refund-events';

const SYSTEM = { userId: 'system', role: 'system' } as const;

/** Map a Stripe refund status to our refund state (null = ignore). */
export function mapStripeRefundStatus(s: string | null): RefundStatus | null {
  switch (s) {
    case 'pending':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return null; // requires_action / unknown → no state change
  }
}

/**
 * Phase 8D (ADR-0015) — authoritative refund settler. Driven by `charge.refund.updated` / `refund.updated`.
 * Finds the refund by Stripe id, transitions it if legal (idempotent no-op otherwise), and on SUCCEEDED
 * cascades the payment to partially_refunded / refunded via the payment seam. Privileged (no tenant session
 * on a webhook). Never moves money — Stripe already did; this only records state.
 */
export async function handleStripeRefundUpdate(event: Stripe.Event): Promise<void> {
  const obj = event.data.object as Stripe.Refund;
  const target = mapStripeRefundStatus(obj.status ?? null);
  if (!target) return;

  const row = await withPrivilegedDbAccess('refund.webhook.find', async (db) =>
    (await db.select().from(refunds).where(eq(refunds.stripeRefundId, obj.id)).limit(1))[0] ?? null,
  );
  if (!row) return; // unmatched refund → ignore (initiation records the id before Stripe fires)

  const from = row.status as RefundStatus;
  if (isLegalRefundTransition(from, target)) {
    await transitionRefund(
      { id: row.id, orgId: row.orgId, paymentId: row.paymentId, orderId: row.orderId, status: from },
      target,
      SYSTEM,
      { providerEventId: event.id, reason: `webhook.${event.type}` },
    );
  }

  // Cascade the payment ONLY when this refund reached succeeded.
  if (target === 'succeeded') {
    await withPrivilegedDbAccess('refund.webhook.cascade', async (db) => {
      const pay = (await db.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1))[0];
      if (!pay) return;
      const succeededRows = await db
        .select({ amountMinor: refunds.amountMinor })
        .from(refunds)
        .where(and(eq(refunds.paymentId, row.paymentId), eq(refunds.status, 'succeeded')));
      const succeededMinor = succeededRows.reduce((s, r) => s + r.amountMinor, 0);
      const to = paymentRefundCascadeTarget(
        pay.status as PaymentStatus,
        succeededMinor,
        pay.amountMinor,
      );
      if (to && isLegalPaymentTransition(pay.status as PaymentStatus, to)) {
        await transitionPayment(
          { id: pay.id, orgId: pay.orgId, orderId: pay.orderId, quoteId: pay.quoteId, status: pay.status as PaymentStatus },
          to,
          SYSTEM,
          { eventType: `webhook.${event.type}`, providerEventId: event.id, payloadSummary: { refunded_minor: succeededMinor } },
        );
      }
    });
  }
}

/**
 * Phase 8D (ADR-0015) — dispute/chargeback RECORDER. Driven by `charge.dispute.*`. Upserts a
 * payment_disputes row (idempotent on stripe_dispute_id) and emits an event. RECORD-ONLY: BorderPass
 * NEVER moves money in response to a dispute — Stripe handles funds. Ops responds out-of-band.
 */
export async function handleStripeDispute(event: Stripe.Event): Promise<void> {
  const d = event.data.object as Stripe.Dispute;
  const pi = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id ?? null;
  if (!pi) return;

  await withPrivilegedDbAccess('dispute.webhook.record', async (db) => {
    const pay = (await db.select().from(payments).where(eq(payments.stripePaymentIntentId, pi)).limit(1))[0];
    if (!pay) return;
    const existing = (
      await db.select().from(paymentDisputes).where(eq(paymentDisputes.stripeDisputeId, d.id)).limit(1)
    )[0];
    if (existing) {
      await db
        .update(paymentDisputes)
        .set({ status: d.status, reason: d.reason ?? null, updatedAt: new Date() })
        .where(eq(paymentDisputes.stripeDisputeId, d.id));
    } else {
      await db
        .insert(paymentDisputes)
        .values({
          id: newId('dsp'),
          orgId: pay.orgId,
          paymentId: pay.id,
          orderId: pay.orderId,
          customerId: pay.customerId,
          stripeDisputeId: d.id,
          status: d.status,
          reason: d.reason ?? null,
          amountMinor: d.amount,
          currency: pay.currency,
        })
        .onConflictDoNothing();
    }
  });

  await writeAudit({
    action: `dispute.${event.type.split('.').pop()}`,
    entityType: 'payment_dispute',
    entityId: d.id,
    after: { status: d.status, reason: d.reason ?? null },
  });
  await emitRefundEvent('dispute.updated', { dispute_id: d.id, status: d.status });
}

export const REFUND_WEBHOOK_EVENTS = new Set<string>([
  'charge.refund.updated',
  'refund.updated',
  'refund.created',
]);
export const DISPUTE_WEBHOOK_EVENTS = new Set<string>([
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
]);
