/**
 * BROWSER-ONLY Stripe loader (Phase 5, ADR-0011). The publishable key is PUBLIC by design
 * (NEXT_PUBLIC_*, `pk_test_…` in dev). This module memoizes the Stripe.js promise for client
 * confirmation (Elements).
 *
 * HARD BOUNDARY — this file (and anything it imports) MUST NEVER reference the server-only Stripe
 * surface: the Stripe secret / webhook-signing-secret env vars, the server Stripe client/config
 * helpers, the webhook verifier, or the PaymentIntent helpers from @maralito/payments, nor any
 * server-only module (@maralito/db, withTenant, etc.).
 * Enforced by scripts/check-client-stripe-boundary.mjs (CI).
 *
 * The client can confirm a PaymentIntent with the server-issued client_secret, but it can NEVER mark
 * a payment succeeded or an order paid — the Stripe webhook remains the trusted source of truth.
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/** The public publishable key (browser-inlined NEXT_PUBLIC_*). Undefined when unconfigured in dev. */
export function getStripePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

/**
 * Memoized browser Stripe instance. Resolves to `null` when no publishable key is configured (dev),
 * so the UI can render a "payments not configured" state instead of throwing. The server action
 * (`isStripeConfigured`) remains the real gate for whether a PaymentIntent can be created.
 */
export function getBrowserStripe(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise;
  const key = getStripePublishableKey();
  stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  return stripePromise;
}
