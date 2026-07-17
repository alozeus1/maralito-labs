'use server';
import { and, eq, inArray } from 'drizzle-orm';
import {
  withTenant,
  withPrivilegedDbAccess,
  payments,
  refunds,
  newId,
} from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { isStripeConfigured, createRefund } from '@maralito/payments';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { canInitiateRefund } from '@/domain/payments/refund-rules';
import { transitionRefund } from '@/server/refund-transitions';
import type { PaymentStatus } from '@/domain/payments/state-machine';

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: string; message: string } };

/** Refund statuses that count toward the "already refunded" balance (everything except failed/canceled). */
const ACTIVE_REFUND_STATUSES = ['requested', 'processing', 'succeeded'] as const;

async function financeGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s); // admin/ops/finance staff; refunds are a privileged financial action
  } catch {
    await writeAudit({ action: 'refund.unauthorized_attempt', actorUserId: s?.sub });
    return { s: null, err: { code: 'not_found', message: 'Not found.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

export interface InitiateRefundInput {
  paymentId: string;
  amountMinor: number; // integer minor units; partial <= remaining
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

/**
 * Phase 8D (ADR-0015) — initiate a Stripe **TEST-mode** refund on a succeeded payment. Admin/finance only.
 * Idempotent (idempotency key re_<payment_id>_<n>), guarded against over-refund and non-succeeded payments.
 * Creates the refund row (privileged — refunds have no tenant write policy), calls Stripe (TEST), records
 * the Stripe refund id, and advances the refund via the transitionRefund seam. The webhook (8D.4) is the
 * authoritative driver of the final succeeded/failed status and the payment refunded cascade.
 * NEVER moves live money: the Stripe client is a `sk_test_` key in dev (refused otherwise by config/smoke).
 */
export async function initiateRefund(input: InitiateRefundInput): Promise<Result<{ refundId: string }>> {
  const { s, err } = await financeGuard();
  if (!s) return { ok: false, error: err! };
  if (!isStripeConfigured())
    return { ok: false, error: { code: 'dependency_unavailable', message: 'Payments not configured.' } };

  // 1) Load the payment (org-scoped by staff RLS) + compute the already-refunded balance.
  const loaded = await withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const pay = (
      await tx.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1)
    )[0];
    if (!pay) return null;
    const existing = await tx
      .select({ id: refunds.id, amountMinor: refunds.amountMinor, status: refunds.status })
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, input.paymentId),
          inArray(refunds.status, [...ACTIVE_REFUND_STATUSES]),
        ),
      );
    const alreadyRefundedMinor = existing.reduce((sum, r) => sum + r.amountMinor, 0);
    return { pay, alreadyRefundedMinor, existingCount: existing.length };
  });
  if (!loaded) return { ok: false, error: { code: 'not_found', message: 'Payment not found.' } };

  // 2) Pure guard: succeeded/partially_refunded, positive integer, not exceeding the remaining balance.
  const guard = canInitiateRefund({
    paymentStatus: loaded.pay.status as PaymentStatus,
    paymentAmountMinor: loaded.pay.amountMinor,
    alreadyRefundedMinor: loaded.alreadyRefundedMinor,
    requestedMinor: input.amountMinor,
  });
  if (!guard.ok) return { ok: false, error: { code: guard.code, message: `Refund not allowed (${guard.code}).` } };
  if (!loaded.pay.stripePaymentIntentId)
    return { ok: false, error: { code: 'no_payment_intent', message: 'Payment has no PaymentIntent.' } };

  // 3) Create the refund row (privileged; refunds have no tenant write policy). Idempotency key is stable.
  const refundId = newId('ref');
  const idempotencyKey = `re_${loaded.pay.id}_${loaded.existingCount + 1}`;
  await withPrivilegedDbAccess('refund.create', async (db) => {
    await db
      .insert(refunds)
      .values({
        id: refundId,
        orgId: loaded.pay.orgId,
        paymentId: loaded.pay.id,
        orderId: loaded.pay.orderId,
        quoteId: loaded.pay.quoteId,
        customerId: loaded.pay.customerId,
        provider: 'stripe',
        status: 'requested',
        amountMinor: input.amountMinor,
        currency: loaded.pay.currency,
        ...(input.reason ? { reason: input.reason } : {}),
        idempotencyKey,
      })
      .onConflictDoNothing();
  });

  // 4) Call Stripe (TEST mode) idempotently, record the refund id, advance the refund.
  const meta: Record<string, string> = {
    org_id: loaded.pay.orgId,
    customer_id: loaded.pay.customerId,
    order_id: loaded.pay.orderId,
    quote_id: loaded.pay.quoteId,
    payment_id: loaded.pay.id,
    refund_id: refundId,
  };
  let providerStatus = 'pending';
  try {
    const res = await createRefund({
      paymentIntentId: loaded.pay.stripePaymentIntentId,
      amountMinor: input.amountMinor,
      idempotencyKey,
      ...(input.reason ? { reason: input.reason } : {}),
      metadata: meta,
    });
    providerStatus = res.status;
    await withPrivilegedDbAccess('refund.record_stripe_id', async (db) => {
      await db.update(refunds).set({ stripeRefundId: res.id, updatedAt: new Date() }).where(eq(refunds.id, refundId));
    });
  } catch {
    // Stripe call failed — mark the refund failed (advisory) and report. Payment stays paid.
    await transitionRefund(
      { id: refundId, orgId: loaded.pay.orgId, paymentId: loaded.pay.id, orderId: loaded.pay.orderId, status: 'requested' },
      'failed',
      { userId: s.sub, role: 'finance' },
      { reason: 'stripe_error' },
    );
    return { ok: false, error: { code: 'provider_error', message: 'Refund could not be created.' } };
  }

  // Advance requested → processing (webhook drives the terminal state + payment cascade). If Stripe already
  // reports succeeded/failed in TEST, still go via processing so the webhook remains the single settler.
  await transitionRefund(
    { id: refundId, orgId: loaded.pay.orgId, paymentId: loaded.pay.id, orderId: loaded.pay.orderId, status: 'requested' },
    'processing',
    { userId: s.sub, role: 'finance' },
    { reason: providerStatus },
  );

  await writeAudit({
    action: 'refund.initiated',
    orgId: loaded.pay.orgId,
    actorUserId: s.sub,
    actorRole: 'finance',
    entityType: 'refund',
    entityId: refundId,
    after: { payment_id: loaded.pay.id, amount_minor: input.amountMinor, kind: guard.kind },
  });

  return { ok: true, data: { refundId } };
}
