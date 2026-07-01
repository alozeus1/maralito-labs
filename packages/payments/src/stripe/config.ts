import type { StripeRuntimeConfig } from './types';

/**
 * Phase 4 — Stripe config loader (ADR-0010). Development-only.
 *
 * Fail-closed: throws when a required secret is missing in any code path that needs Stripe. Never
 * logs or echoes secret values. Server-only by construction (reads process.env at call time and
 * refuses to run in a browser context). No live-mode assumption — test/dev keys are expected.
 */
const REQUIRED_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;

/** Default pinned API version. ⚠️ VERIFY against the Stripe dashboard/changelog before live use. */
export const DEFAULT_STRIPE_API_VERSION = '2024-06-20';
export const DEFAULT_PAYMENT_CURRENCY = 'usd';

type EnvLike = Record<string, string | undefined>;

/** True when both required Stripe secrets are present — used to gate code paths without throwing. */
export function isStripeConfigured(env: EnvLike = process.env): boolean {
  return REQUIRED_KEYS.every((k) => typeof env[k] === 'string' && env[k]!.length > 0);
}

/**
 * Load + validate the server-only Stripe config. Throws a non-sensitive error (key NAMES only, never
 * values) when required secrets are missing. Refuses to run in the browser.
 */
export function loadStripeConfig(env: EnvLike = process.env): StripeRuntimeConfig {
  if (typeof window !== 'undefined') {
    throw new Error('Stripe config is server-only and must not be loaded in the browser.');
  }
  const missing = REQUIRED_KEYS.filter((k) => !env[k]);
  if (missing.length > 0) {
    // Names only — never the values.
    throw new Error(`Stripe is not configured (development-only): missing ${missing.join(', ')}.`);
  }
  return {
    secretKey: env.STRIPE_SECRET_KEY!,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET!,
    apiVersion: env.STRIPE_API_VERSION ?? DEFAULT_STRIPE_API_VERSION,
    currency: (env.STRIPE_PAYMENT_CURRENCY ?? DEFAULT_PAYMENT_CURRENCY).toLowerCase(),
    // Only set optional URLs when present (exactOptionalPropertyTypes — no explicit undefined).
    ...(env.STRIPE_SUCCESS_URL ? { successUrl: env.STRIPE_SUCCESS_URL } : {}),
    ...(env.STRIPE_CANCEL_URL ? { cancelUrl: env.STRIPE_CANCEL_URL } : {}),
  };
}
