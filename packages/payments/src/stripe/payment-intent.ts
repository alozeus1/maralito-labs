import { getStripeClient } from './client';

/**
 * Phase 4 — PaymentIntent helpers (ADR-0010). Development-only. Returns normalized, non-sensitive
 * fields only (id, client_secret, status). NEVER returns or logs card data or the secret key.
 */
export interface CreatePaymentIntentInput {
  amountMinor: number; // integer minor units (from the accepted quote total)
  currency: string; // lowercase ISO-4217, e.g. "usd"
  idempotencyKey: string; // stable per quote_id — Stripe dedupes repeat creates
  metadata: Record<string, string>; // org_id, customer_id, order_id, quote_id, payment_id
}
export interface PaymentIntentResult {
  id: string;
  clientSecret: string | null;
  status: string;
}

/** Create a PaymentIntent idempotently (Stripe returns the same intent for the same idempotency key). */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntentResult> {
  const stripe = getStripeClient();
  const pi = await stripe.paymentIntents.create(
    { amount: input.amountMinor, currency: input.currency, metadata: input.metadata },
    { idempotencyKey: input.idempotencyKey },
  );
  return { id: pi.id, clientSecret: pi.client_secret, status: pi.status };
}

/** Retrieve an existing PaymentIntent (used to return a fresh client_secret on idempotent re-initiation). */
export async function retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
  const stripe = getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  return { id: pi.id, clientSecret: pi.client_secret, status: pi.status };
}
