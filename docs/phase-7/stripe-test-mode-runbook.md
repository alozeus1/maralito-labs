# Phase 7 — Stripe Test-Mode Smoke Runbook

> ADR-0013 · **operator-run in the real environment** · TEST mode only · no live payments, no real card data.

## Goal
Prove the Phase 4/5 payment path end-to-end against a real **Stripe TEST** account: initiate → confirm →
webhook → order `paid` → receipt queued. **This is not run in the dev sandbox and is not marked passed
until an operator completes it.**

## Required TEST-mode env
| Var | Where | Value |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | server-only | `sk_test_…` (NEVER `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | server-only | `whsec_…` from `stripe listen` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | `pk_test_…` |
| `STRIPE_API_VERSION` | optional | leave unset to use the pinned default, or set to match the account |

## Offline pre-check (safe to run anywhere with test env)
```
STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... \
  pnpm --filter @maralito/payments stripe:smoke
```
Verifies: keys present + TEST mode (refuses `sk_live_`); API version matches the pinned default; webhook
signature verify works offline and a tampered payload is rejected (fail-closed). **No network / no live Stripe.**

## Live TEST-mode steps (operator)
1. `stripe login` (test mode).
2. `stripe listen --forward-to http://localhost:3000/api/stripe/webhook` → copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`, restart the app.
3. In the app, initiate payment for an **accepted** quote (order `awaiting_payment`).
4. Confirm with a Stripe **test card** (e.g. `4242 4242 4242 4242`, any future expiry/CVC). Never use real card data.
5. Confirm the webhook `payment_intent.succeeded` is received → the order advances `awaiting_payment → paid` (via `transitionOrder`).
6. Confirm a placeholder receipt row was enqueued in `notification_outbox` (no send).
7. Confirm the Stripe dashboard **API version** matches the pinned default (`DEFAULT_STRIPE_API_VERSION` in `packages/payments/src/stripe/config.ts`); update the pin or `STRIPE_API_VERSION` if it differs.

## Record the result
Tick the corresponding rows in `docs/phase-7/gate-ledger.md` **only after** the live steps pass. Failure
paths (`payment_intent.payment_failed` / `canceled` / `requires_action`) must NOT mark the order paid.

## Guardrails
- TEST mode only; no live keys; no real card data stored or logged.
- The webhook remains the source of truth for `succeeded`/`paid`; client confirmation is advisory.
- Do not enable live Stripe until the separate **Stripe live-validation** gate (post test-mode) is approved.
