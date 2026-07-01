import type Stripe from 'stripe';
import { getStripeClient } from './client';
import { loadStripeConfig } from './config';

/**
 * Phase 4 — Stripe webhook signature verification (ADR-0010). FAIL CLOSED: throws on any invalid or
 * missing signature (Stripe's constructEvent throws), so the caller must reject the request. Never
 * logs the payload or secret. Returns the verified Stripe.Event.
 */
export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const { webhookSecret } = loadStripeConfig();
  // Throws Stripe.errors.StripeSignatureVerificationError on tamper/secret mismatch.
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
