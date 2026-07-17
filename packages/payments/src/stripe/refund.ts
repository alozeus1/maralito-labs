import { getStripeClient } from './client';

/**
 * Phase 8D — Stripe refund helpers (ADR-0015). Development-only, TEST mode. Returns normalized,
 * non-sensitive fields only (id, status, amount). NEVER returns/logs card data or the secret key.
 * Money never moves for real here in dev — the key is a `sk_test_` key (enforced by loadStripeConfig
 * consumers + stripe:smoke), and no live-mode assumption is made.
 */
export interface CreateRefundInput {
  paymentIntentId: string; // pi_... to refund
  amountMinor: number; // integer minor units; partial <= remaining, full = payment amount
  idempotencyKey: string; // stable per refund attempt (re_<payment_id>_<n>) — Stripe dedupes repeats
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata: Record<string, string>; // org_id, customer_id, order_id, quote_id, payment_id, refund_id
}
export interface RefundResult {
  id: string; // re_...
  status: string; // Stripe refund status (pending|succeeded|failed|canceled|requires_action)
  amountMinor: number;
}

/** Create a refund idempotently (Stripe returns the same refund for the same idempotency key). */
export async function createRefund(input: CreateRefundInput): Promise<RefundResult> {
  const stripe = getStripeClient();
  const refund = await stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      amount: input.amountMinor,
      ...(input.reason ? { reason: input.reason } : {}),
      metadata: input.metadata,
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return { id: refund.id, status: refund.status ?? 'pending', amountMinor: refund.amount };
}
