/**
 * Pure payment business rules (ADR-0010). Extracted so the safety-critical decisions are unit-testable
 * without the DB/Stripe/Next stack. No I/O.
 */
import type { OrderStatus } from '@/domain/orders/state-machine';
import type { QuoteStatus } from '@/domain/quotes/state-machine';
import type { PaymentStatus } from './state-machine';

export type InitiationDenial = 'quote_not_accepted' | 'order_not_awaiting_payment' | 'invalid_amount';

/** Preconditions to initiate payment for a quote. The accepted quote total is the source of truth. */
export function canInitiatePayment(input: {
  quoteStatus: QuoteStatus;
  orderStatus: OrderStatus;
  totalMinor: number | null | undefined;
}): { ok: true } | { ok: false; code: InitiationDenial } {
  if (input.quoteStatus !== 'accepted') return { ok: false, code: 'quote_not_accepted' };
  if (input.orderStatus !== 'awaiting_payment') return { ok: false, code: 'order_not_awaiting_payment' };
  if (!input.totalMinor || input.totalMinor <= 0) return { ok: false, code: 'invalid_amount' };
  return { ok: true };
}

/**
 * The ONLY rule that can mark an order paid: a payment moving to `succeeded` while the order is
 * `awaiting_payment`. Every other payment status (failed/canceled/requires_action/...) → null (no-op).
 * Returning a target (not performing the write) keeps this pure and exhaustively testable.
 */
export function orderPaidCascadeTarget(paymentTo: PaymentStatus, orderStatus: OrderStatus): 'paid' | null {
  return paymentTo === 'succeeded' && orderStatus === 'awaiting_payment' ? 'paid' : null;
}
