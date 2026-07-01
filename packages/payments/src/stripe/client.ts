import Stripe from 'stripe';
import { loadStripeConfig } from './config';

/**
 * Phase 4 — server-only Stripe client factory (ADR-0010). Development-only.
 *
 * The secret key is read from the environment at call time and never exposed to the client bundle.
 * The factory refuses to run in a browser context and fails closed when secrets are missing (via
 * loadStripeConfig). Callers must be server-only (server actions, route handlers).
 */
let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (typeof window !== 'undefined') {
    throw new Error('Stripe client is server-only and must not be created in the browser.');
  }
  if (cached) return cached;
  const cfg = loadStripeConfig();
  cached = new Stripe(cfg.secretKey, {
    // Cast to the SDK's pinned version literal; we pin via env and verify against Stripe out-of-band.
    apiVersion: cfg.apiVersion as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: 'BorderPass (Maralito Labs)' },
  });
  return cached;
}

/** Test-only: reset the memoized client (used by unit tests with mocked env). */
export function __resetStripeClientForTests(): void {
  cached = null;
}
