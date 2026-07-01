# Phase 5 — Stripe Client/Server Boundary

> ADR-0011 · development-only · publishable key is the ONLY Stripe value in the browser.

## Server (Phase 4, unchanged)
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (server-only env), `getStripeClient` / `loadStripeConfig`,
PaymentIntent creation, webhook verification, `transitionPayment`. The webhook is the only writer of
`succeeded` / order `paid`.

## Client (Phase 5)
- **Env:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public by design, `pk_test_…` in dev).
- **Loader:** `apps/borderpass/src/client/stripe.ts` — `getBrowserStripe()` memoizes `loadStripe(publishableKey)`,
  resolves `null` when unconfigured (UI shows a fallback), refuses nothing server-only. Imports only `@stripe/stripe-js`.
- **Confirm:** `@stripe/react-stripe-js` `PaymentElement` + `client_secret`. The client cannot mutate server state.

## Enforcement (CI)
`scripts/check-client-stripe-boundary.mjs` scans every client module (files under `src/client/` or with a
`'use client'` directive) and fails the build if any references the server Stripe surface
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `getStripeClient`, `loadStripeConfig`, `verifyStripeWebhook`,
`createPaymentIntent`, `retrievePaymentIntent`). Wired as `pnpm check:client-stripe` in `.github/workflows/ci.yml`.

## Guarantee
The browser ever holds only: the publishable key + a server-issued PaymentIntent `client_secret`. No secret
key, no webhook secret, no card data, no DB access. Webhook remains the source of truth.
