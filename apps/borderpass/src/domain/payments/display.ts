/**
 * Pure payment DISPLAY-state derivation for the customer payment UX (ADR-0011). No I/O.
 *
 * The webhook remains the source of truth for `succeeded`/order `paid`; this mapper only decides what
 * the customer UI should render from the already-persisted payment + order status. It never mutates
 * anything and never treats a client-side result as authoritative.
 */
import type { PaymentStatus } from './state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

export type PaymentDisplayState =
  | 'none' // nothing to pay yet (order not at the payment step)
  | 'ready_to_pay' // accepted quote, order awaiting_payment, no/incomplete payment
  | 'processing' // payment is processing (Stripe/webhook in flight)
  | 'requires_action' // customer must complete an action (e.g. 3DS)
  | 'succeeded' // payment captured (webhook-confirmed) / order at or beyond paid
  | 'failed' // last payment attempt failed (retry possible)
  | 'canceled'; // payment or order canceled

/** Order statuses at or beyond `paid` — payment has been captured (webhook-driven). */
const PAID_OR_BEYOND: readonly OrderStatus[] = [
  'paid',
  'purchasing',
  'purchased',
  'awaiting_package',
  'received_el_paso',
  'inspection_pending',
  'inspection_passed',
  'inspection_failed',
  'border_documentation_ready',
  'ready_for_crossing',
  'border_crossing',
  'customs_processing',
  'arrived_juarez',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'refunded',
];

/**
 * Derive the customer-facing display state. Deterministic and total over the inputs.
 * `paymentStatus` is the customer's own payment row status (or null if none created yet).
 */
export function toPaymentDisplayState(
  paymentStatus: PaymentStatus | null,
  orderStatus: OrderStatus,
): PaymentDisplayState {
  // Terminal non-paid order states: nothing payable.
  if (orderStatus === 'cancelled' || orderStatus === 'rejected') return 'canceled';
  // Order already advanced to/through paid → payment captured (webhook got it there).
  if (PAID_OR_BEYOND.includes(orderStatus)) return 'succeeded';
  // Pre-payment order states other than awaiting_payment: not ready to pay.
  if (orderStatus !== 'awaiting_payment') return 'none';

  // Order is awaiting_payment — reflect the payment row.
  if (paymentStatus === null) return 'ready_to_pay';
  switch (paymentStatus) {
    case 'requires_payment':
      return 'ready_to_pay';
    case 'processing':
      return 'processing';
    case 'requires_action':
      return 'requires_action';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    // `succeeded` while the order is still awaiting_payment = cascade in flight; show success.
    // `refunded_placeholder` has no refund UX in Phase 5 — treat as captured.
    case 'succeeded':
    case 'refunded_placeholder':
      return 'succeeded';
  }
}

/** Whether the customer payment page should render the Stripe payment form (vs. a status message). */
export function shouldShowPaymentForm(state: PaymentDisplayState): boolean {
  return state === 'ready_to_pay' || state === 'requires_action';
}

/**
 * Whether to keep polling the server for an authoritative status update. Only `processing` is the
 * transient "waiting for the webhook" state; everything else is either a form state or settled.
 */
export function shouldPollPaymentStatus(state: PaymentDisplayState): boolean {
  return state === 'processing';
}

/** A settled (non-transient, non-form) outcome — polling stops here. */
export function isSettledDisplayState(state: PaymentDisplayState): boolean {
  return state === 'succeeded' || state === 'failed' || state === 'canceled' || state === 'none';
}

/** Retry is offered only after a failed attempt or while still ready to pay (reuses the same intent). */
export function canRetryPayment(state: PaymentDisplayState): boolean {
  return state === 'failed' || state === 'ready_to_pay';
}

/**
 * The ONLY predicate that renders a "paid"/success view. True solely for `succeeded`, which the
 * mapper returns only from webhook-driven state (payment succeeded / order paid) — never from a
 * client confirmation result.
 */
export function isPaidView(state: PaymentDisplayState): boolean {
  return state === 'succeeded';
}

/** Customer-safe summary of an order's payment situation (no internal/event/ledger data). */
export interface PaymentSummaryView {
  order_id: string;
  quote: { quote_id: string; currency: string; total_minor: number; status: string };
  amount_due_minor: number;
  currency: string;
  payment: { payment_id: string; status: PaymentStatus } | null;
  display_state: PaymentDisplayState;
}
