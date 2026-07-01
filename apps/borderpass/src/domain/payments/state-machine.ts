/**
 * Payment state machine (7 states). Pure, status-only (provider/system-driven — NOT role-gated,
 * unlike quotes). The single mutation seam transitionPayment() calls assertPaymentTransition(). ADR-0010.
 *
 * Invariant: only `succeeded` may cascade an order to `paid`. `failed`, `canceled`, and
 * `requires_action` must NEVER mark an order paid (enforced in the seam, not here).
 */
export const PAYMENT_STATUSES = [
  'requires_payment', 'processing', 'requires_action',
  'succeeded', 'failed', 'canceled', 'refunded_placeholder',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Legal transitions. Mirrors the order machine's status-only style (no actor classes). */
export const LEGAL_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  requires_payment: ['processing', 'canceled'],
  processing: ['succeeded', 'failed', 'requires_action', 'canceled'],
  requires_action: ['processing', 'failed'],
  succeeded: ['refunded_placeholder'], // future placeholder only; no refund logic in Phase 4
  failed: ['requires_payment'],
  canceled: [],
  refunded_placeholder: [],
};

const TERMINAL: readonly PaymentStatus[] = ['canceled', 'refunded_placeholder'];

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
  constructor(readonly from: PaymentStatus, readonly to: PaymentStatus) {
    super(`illegal payment transition: ${from} → ${to}`);
    this.name = 'IllegalPaymentTransitionError';
  }
}
export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!isLegalPaymentTransition(from, to)) throw new IllegalPaymentTransitionError(from, to);
}
