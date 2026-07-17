/**
 * Payment state machine (7 states). Pure, status-only (provider/system-driven — NOT role-gated,
 * unlike quotes). The single mutation seam transitionPayment() calls assertPaymentTransition(). ADR-0010.
 *
 * Invariant: only `succeeded` may cascade an order to `paid`. `failed`, `canceled`, and
 * `requires_action` must NEVER mark an order paid (enforced in the seam, not here).
 */
export const PAYMENT_STATUSES = [
  'requires_payment',
  'processing',
  'requires_action',
  'succeeded',
  'failed',
  'canceled',
  'refunded_placeholder', // legacy (Phase 4); superseded by refunded/partially_refunded in Phase 8D
  'partially_refunded', // Phase 8D (ADR-0015)
  'refunded', // Phase 8D (ADR-0015) — fully refunded
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Legal transitions. Mirrors the order machine's status-only style (no actor classes).
 *
 * The webhook is the authoritative driver: each Stripe `payment_intent.*` event maps to the payment
 * status it reports, so the table must permit every progression Stripe actually emits. In particular,
 * standard cards go `requires_payment → succeeded` (or `→ failed`) with NO intermediate `processing`
 * event, and 3DS goes `requires_payment → requires_action → succeeded`. Direct terminal transitions
 * from `requires_payment`/`requires_action` are therefore legal. The paid cascade stays gated to
 * `succeeded` while the order is `awaiting_payment` (orderPaidCascadeTarget), so this remains safe.
 */
export const LEGAL_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  requires_payment: ['processing', 'requires_action', 'succeeded', 'failed', 'canceled'],
  processing: ['succeeded', 'failed', 'requires_action', 'canceled'],
  requires_action: ['processing', 'succeeded', 'failed', 'canceled'],
  // Phase 8D: a succeeded payment may be (partially) refunded via the refund webhook cascade.
  succeeded: ['partially_refunded', 'refunded', 'refunded_placeholder'],
  partially_refunded: ['partially_refunded', 'refunded'], // further partial refunds, then full
  failed: ['requires_payment'],
  canceled: [],
  refunded: [],
  refunded_placeholder: [],
};

const TERMINAL: readonly PaymentStatus[] = ['canceled', 'refunded', 'refunded_placeholder'];

export function isLegalPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return LEGAL_PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}
export function getNextAllowedPaymentStatuses(from: PaymentStatus): PaymentStatus[] {
  return [...(LEGAL_PAYMENT_TRANSITIONS[from] ?? [])];
}
export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL.includes(status);
}
/** True only for the one transition that is allowed to cascade an order to `paid`. */
export function paymentSucceeds(to: PaymentStatus): boolean {
  return to === 'succeeded';
}
export class IllegalPaymentTransitionError extends Error {
  constructor(
    readonly from: PaymentStatus,
    readonly to: PaymentStatus,
  ) {
    super(`illegal payment transition: ${from} → ${to}`);
    this.name = 'IllegalPaymentTransitionError';
  }
}
export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!isLegalPaymentTransition(from, to)) throw new IllegalPaymentTransitionError(from, to);
}
