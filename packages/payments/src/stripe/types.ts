/**
 * Phase 4 — Stripe types (ADR-0010). Development-only. References only; NEVER raw card data.
 */
export type PaymentCurrency = 'usd' | 'mxn';

/** Server-only runtime config. Secrets are read from the environment at call time, never bundled. */
export interface StripeRuntimeConfig {
  secretKey: string; // server-only — never exposed to the client
  webhookSecret: string; // server-only — used for signature verification
  apiVersion: string; // pinned Stripe API version (verify against Stripe before live use)
  currency: string; // lowercase ISO-4217 (Stripe expects lowercase, e.g. "usd")
  successUrl?: string; // optional (Checkout only; unused in Phase 4 PaymentIntent flow)
  cancelUrl?: string; // optional (Checkout only; unused in Phase 4 PaymentIntent flow)
}

/** Safe, client-facing result of initiating a PaymentIntent. Contains NO secret key. */
export interface SafePaymentIntentView {
  payment_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  client_secret: string | null; // PaymentIntent client_secret — safe for the client SDK only
}
