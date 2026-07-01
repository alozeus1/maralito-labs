# Phase 4 — Stripe Payments + Payment State Machine — Completion Report

> **Status:** ✅ COMPLETE (dev-only; code + pure/real-Postgres/offline-Stripe tests) · **Live Stripe + live Supabase gates NOT run (release blockers)** · **Date:** 2026-06-30 · ADR-0010

## 1. Increments
| # | Increment | Status |
|---|-----------|--------|
| 4.1 | Payment schema foundation | ✅ `payments`, `payment_events`, `stripe_webhook_events`, `refunds` |
| 4.2 | Payment state machine + `transitionPayment` seam | ✅ 7-state + succeeded→order paid cascade |
| 4.3 | Stripe server-only config/client | ✅ fail-closed, no secret exposure, no live assumption |
| 4.4 | Customer payment initiation | ✅ accepted-quote only, idempotent, safe fields |
| 4.5 | Webhook verify + idempotency | ✅ fail-closed signature, ledger, 5 events |
| 4.6 | Payment RLS + isolation tests | ✅ 13 assertions green on PGlite |
| 4.7 | Audit + event placeholders | ✅ full `payment.*` audit + `emitPaymentEvent` seam |
| 4.8 | Tests | ✅ state machine, rules/cascade, webhook signature, idempotency, RLS |
| 4.9 | Docs + ADR-0010 + Phase 5 checklist | ✅ this report + 4 docs + ADR |

## 2. Implemented behavior
Customer initiates a PaymentIntent for an accepted quote (`awaiting_payment` order); a verified Stripe webhook drives the payment state machine; `succeeded` cascades the order `awaiting_payment → paid` via `transitionOrder`. Failure/canceled/requires_action never mark paid. Idempotent on both initiation (key `pi_<quote_id>`) and webhook delivery (unique `stripe_event_id`). References only — no card data.

## 3. Verified (real Postgres / pure / offline Stripe — Vitest can't launch in sandbox, logic run via equivalent harnesses)
- **Payment state machine** — legal/illegal transitions; illegal throws; every shortcut to `succeeded` blocked.
- **Cascade rule** (`orderPaidCascadeTarget`) — `paid` only for `succeeded`+`awaiting_payment`; failed/canceled/requires_action/processing ⇒ no-op (exhaustive).
- **Initiation preconditions** (`canInitiatePayment`) — accepted + awaiting_payment + positive amount.
- **Webhook signature** — valid accepted; forged + tampered rejected (offline `generateTestHeaderString`).
- **Webhook idempotency** — duplicate `stripe_event_id` no-op; re-delivery detectable (PGlite).
- **Payment RLS** (13 assertions, PGlite, real policy files) — customer own-only; **customer UPDATE blocked**; `stripe_webhook_events` privileged-only; `payment_events` staff-only; refunds owner-scoped; missing claims → none.
- **Typechecks** — `@maralito/payments`, `@maralito/db`, `@maralito/schemas` lib typecheck exit 0; app payment files type-check against real resolution; `check:db-imports` green.

## 4. Tests committed
`apps/borderpass/src/domain/payments/{state-machine,rules}.test.ts` · `packages/payments/tests/webhook.test.ts` · `packages/db/tests/{payments-rls.isolation,payment-webhook-idempotency}.test.ts`. They run under `pnpm test` in the real env / CI.

## 5. Invariants honored
All payment writes via `withPrivilegedDbAccess`; no raw DB client in `apps/**`; order status only via `transitionOrder`; payment `succeeded` is the only path to order `paid` (and only from `awaiting_payment`); webhook verify fails closed; idempotent webhooks; no secrets/card data/PII logged; Stripe references only; integer minor units; accepted-quote total is the amount; **development-only**.

## 5a. Maintenance (non-payment scope)
- **Phase 3 strictness fix** (carried, maintenance — *not* payment scope): `quote-transitions.ts` now writes `reason: meta?.reason ?? null` (was `meta?.reason`), applied during Phase 4 to satisfy `exactOptionalPropertyTypes`.
- **N2 concurrency hardening (post-review):** `initiateQuotePayment` inserts idempotently on `(provider, idempotency_key)` and, if a concurrent initiation wins the race, **adopts the existing row** (same Stripe intent via the shared idempotency key) instead of throwing — no duplicate payment row, no duplicate intent; unexpected DB errors still fail closed.

## 6. NOT done (honest) — release blockers / deferred
- **Live Stripe (test + live) validation** and **live Supabase RLS gate** (now incl. payments) — PENDING; required before any non-dev release / real money / real PII.
- Full `pnpm install`/`next build`/**app-server typecheck** + CI green on a real PR; **Vitest doesn't run in this sandbox** (arch-mismatched rollup) — suites verified via equivalent harnesses.
- KMS/secret-management decision before storing Stripe customer data / PII.
- Checkout UI, saved cards, subscriptions, real refunds/disputes, notifications, AI finance automation, accounting/export, customs/tax, inspection/delivery, durable workflow, real event bus.

## 7. Recommendation
Phase 4 payment foundation is complete and proven locally. **Before any non-dev release**, clear the carried release-gate checklist + run a Stripe test-mode smoke. The next slice is **Phase 5** (candidate: payment-confirmation UX + notifications, or inspection/delivery) under **ADR-0011**.

> Live deployment remains blocked. Dev foundation ready for Phase 5 planning.
