/**
 * @maralito/payments — Stripe payment foundation (Phase 4, ADR-0010). Development-only.
 *
 * References only — NEVER raw card data, payment-method details, or secrets. The Stripe client is
 * server-only (see ./stripe/client). Webhook verification + idempotency land in the app webhook
 * route (Increment 4.5). No live-mode assumption; test/dev keys expected.
 */
export type { StripeRuntimeConfig, SafePaymentIntentView, PaymentCurrency } from './stripe/types';
export {
  loadStripeConfig,
  isStripeConfigured,
  DEFAULT_STRIPE_API_VERSION,
  DEFAULT_PAYMENT_CURRENCY,
} from './stripe/config';
export { getStripeClient, __resetStripeClientForTests } from './stripe/client';
export { createPaymentIntent, retrievePaymentIntent } from './stripe/payment-intent';
export type { CreatePaymentIntentInput, PaymentIntentResult } from './stripe/payment-intent';
export { createRefund } from './stripe/refund'; // Phase 8D (ADR-0015) — TEST-mode refunds
export type { CreateRefundInput, RefundResult } from './stripe/refund';
export { verifyStripeWebhook } from './stripe/webhook';
