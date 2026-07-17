/**
 * Refund state machine (Phase 8D, ADR-0015). Pure, status-only (provider/system-driven, like payments —
 * NOT role-gated). The single mutation seam transitionRefund() calls assertRefundTransition().
 *
 * TEST-mode only in dev. No live money movement anywhere in this machine. Money is handled by Stripe;
 * this machine only tracks the refund's lifecycle. A failed refund does NOT change the payment/order
 * (payment stays `paid`); payment/order consistency on a SUCCEEDED refund is handled in the seam's
 * caller layer (8D.4), never auto-moving funds.
 */
export const REFUND_STATUSES = [
  'requested',
  'processing',
  'succeeded',
  'failed',
  'canceled',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Legal transitions. Stripe refunds may report `pending`(→processing) then `succeeded`/`failed`, or go
 * straight to `succeeded`/`failed`; a refund can be `canceled` before it settles. Terminal states have
 * no outgoing edges — a new refund attempt is a NEW refund row (new idempotency key), not a transition.
 */
export const LEGAL_REFUND_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  requested: ['processing', 'succeeded', 'failed', 'canceled'],
  processing: ['succeeded', 'failed', 'canceled'],
  succeeded: [],
  failed: [],
  canceled: [],
};

const TERMINAL: readonly RefundStatus[] = ['succeeded', 'failed', 'canceled'];

export function isLegalRefundTransition(from: RefundStatus, to: RefundStatus): boolean {
  return LEGAL_REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}
export function getNextAllowedRefundStatuses(from: RefundStatus): RefundStatus[] {
  return [...(LEGAL_REFUND_TRANSITIONS[from] ?? [])];
}
export function isTerminalRefundStatus(status: RefundStatus): boolean {
  return TERMINAL.includes(status);
}
/** True only for the one transition that settles a refund (funds returned by Stripe, in TEST mode). */
export function refundSucceeds(to: RefundStatus): boolean {
  return to === 'succeeded';
}
export class IllegalRefundTransitionError extends Error {
  constructor(
    readonly from: RefundStatus,
    readonly to: RefundStatus,
  ) {
    super(`illegal refund transition: ${from} → ${to}`);
    this.name = 'IllegalRefundTransitionError';
  }
}
export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  if (!isLegalRefundTransition(from, to)) throw new IllegalRefundTransitionError(from, to);
}
