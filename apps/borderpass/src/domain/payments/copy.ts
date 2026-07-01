/**
 * Customer-facing payment copy (Phase 5, ADR-0011). Pure presentation strings — no I/O, no PII.
 * Product name is BorderPass. The copy never claims the payment is paid/confirmed unless the state
 * is `succeeded` (which is webhook-driven); transient states say "this can take a moment".
 */
import type { PaymentDisplayState } from './display';

export interface PaymentCopy {
  title: string;
  body: string;
}

/** The single success title — used to assert no other state claims completion. */
export const PAID_TITLE = 'Payment confirmed';

/** Short read-only status label (admin + customer detail views). Pure. */
export function paymentStatusLabel(state: PaymentDisplayState): string {
  switch (state) {
    case 'ready_to_pay': return 'Awaiting payment';
    case 'processing': return 'Processing';
    case 'requires_action': return 'Action required';
    case 'succeeded': return 'Paid';
    case 'failed': return 'Failed';
    case 'canceled': return 'Canceled';
    case 'none': return 'Not at payment step';
  }
}

export function paymentStatusCopy(state: PaymentDisplayState): PaymentCopy {
  switch (state) {
    case 'ready_to_pay':
      return { title: 'Complete your payment', body: 'Enter your payment details to pay securely with Stripe.' };
    case 'processing':
      return { title: 'Confirming your payment', body: 'Your payment is being confirmed. This can take a moment — please do not pay again.' };
    case 'requires_action':
      return { title: 'One more step', body: 'Your bank needs an extra step to approve this payment. Please complete it to continue.' };
    case 'succeeded':
      return { title: PAID_TITLE, body: 'Thank you. Your payment is confirmed and your order is moving forward.' };
    case 'failed':
      return { title: 'Payment did not go through', body: 'Your last attempt did not complete. You can try again — you will not be charged twice.' };
    case 'canceled':
      return { title: 'Payment canceled', body: 'This payment was canceled. Please contact support if you need help.' };
    case 'none':
      return { title: 'Not ready for payment', body: 'This order is not ready for payment yet.' };
  }
}
