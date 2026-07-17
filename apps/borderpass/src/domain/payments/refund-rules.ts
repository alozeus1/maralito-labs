import type { PaymentStatus } from './state-machine';

/**
 * Phase 8D (ADR-0015) — pure refund rules. No I/O. Money is integer minor units. TEST-mode only in dev.
 */

export type RefundGuard =
  | { ok: true; kind: 'full' | 'partial' }
  | { ok: false; code: 'payment_not_refundable' | 'invalid_amount' | 'exceeds_remaining' };

/**
 * Can a refund of `requestedMinor` be initiated? Only on a `succeeded` (or already `partially_refunded`)
 * payment, positive integer amount, not exceeding the remaining refundable balance.
 * `alreadyRefundedMinor` = sum of refunds that are NOT failed/canceled (requested + processing + succeeded).
 */
export function canInitiateRefund(input: {
  paymentStatus: PaymentStatus;
  paymentAmountMinor: number;
  alreadyRefundedMinor: number;
  requestedMinor: number;
}): RefundGuard {
  if (input.paymentStatus !== 'succeeded' && input.paymentStatus !== 'partially_refunded')
    return { ok: false, code: 'payment_not_refundable' };
  if (!Number.isInteger(input.requestedMinor) || input.requestedMinor <= 0)
    return { ok: false, code: 'invalid_amount' };
  const remaining = input.paymentAmountMinor - input.alreadyRefundedMinor;
  if (input.requestedMinor > remaining) return { ok: false, code: 'exceeds_remaining' };
  const kind = input.alreadyRefundedMinor + input.requestedMinor === input.paymentAmountMinor ? 'full' : 'partial';
  return { ok: true, kind };
}

/**
 * After a refund SUCCEEDS, what should the payment status become? The ONLY path that marks a payment
 * refunded. `succeededRefundedMinor` = sum of SUCCEEDED refunds after this one. Never called for a
 * failed/canceled refund. Returns null when nothing should change.
 */
export function paymentRefundCascadeTarget(
  paymentStatus: PaymentStatus,
  succeededRefundedMinor: number,
  paymentAmountMinor: number,
): PaymentStatus | null {
  if (paymentStatus !== 'succeeded' && paymentStatus !== 'partially_refunded') return null;
  if (succeededRefundedMinor <= 0) return null;
  return succeededRefundedMinor >= paymentAmountMinor ? 'refunded' : 'partially_refunded';
}
