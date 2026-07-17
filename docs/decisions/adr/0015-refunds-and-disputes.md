# ADR 0015 — Refunds & Disputes (Phase 8D)

- **Status:** Accepted (development-only; **Stripe TEST mode**; no live money). · **Date:** 2026-07-02 · **Phase:** 8D
- **Numbering:** 0015 = refunds & disputes. Next ADR = 0016. Builds on ADR-0010 (payments), ADR-0011 (payment UX).

## Context

Phase 4 shipped payments with a `refunds` **placeholder** (schema only). Phase 8D completes the payment
lifecycle: initiate refunds, ingest refund + dispute webhooks, keep payment/order state consistent, and expose
read-only refund/dispute status — all TEST-mode, synthetic, dev-only. Row 15 (Stripe LIVE) still gates any real refund.

## Decision

1. **Refund is its own state machine + seam.** `requested → processing → succeeded | failed | canceled`
   (terminal states have no outgoing edges — a retry is a new refund row). `transitionRefund` is the ONLY
   refund mutation point: asserts legality → writes `refund_status_history` → audits → emits a placeholder event.
   Mirrors `transitionPayment`.
2. **The webhook is the authoritative settler.** `charge.refund.updated` / `refund.updated` drive the refund to
   its terminal state (idempotent via the existing `stripe_webhook_events` ledger + legal-transition guard). On a
   **succeeded** refund the payment cascades to `partially_refunded` or `refunded` (new payment statuses) via
   `transitionPayment` — the ONLY path that marks a payment refunded. A **failed** refund never changes the payment.
3. **Disputes are RECORD-ONLY.** `charge.dispute.*` upserts a `payment_disputes` row (idempotent on
   `stripe_dispute_id`) and emits an event. **BorderPass never moves money in response to a dispute** — Stripe
   handles funds; ops responds out-of-band.
4. **Guards.** Refund initiation (admin/finance) requires a `succeeded`/`partially_refunded` payment, a positive
   integer amount, and must not exceed the remaining refundable balance (`canInitiateRefund`). Idempotency key
   `re_<payment_id>_<n>` + `unique(provider, idempotency_key)`.
5. **Security.** All refund/dispute writes run via the privileged seam/handler (RLS grants tenant **SELECT only**;
   no tenant write policy). Customer reads own refunds/disputes (RLS by `customer_id`); `refund_status_history` is
   staff-only. Integer minor units; Stripe references only; no card data/secrets. Stripe client is a `sk_test_` key
   in dev (refused otherwise).

## Consequences

- Payment machine gains `partially_refunded` + `refunded` (terminal); `refunded_placeholder` kept for back-compat.
- New tables `refund_status_history`, `payment_disputes`; `refunds` extended (order/quote/customer refs, provider,
  idempotency_key, metadata, unique indexes). A Drizzle migration must be **generated on a dev machine**
  (`db:generate`) and committed — the sandbox cannot run drizzle-kit (native esbuild).
- Live refund/dispute round-trip is an operator step (Stripe TEST CLI + running app), like rows 12–14.

## Verified (offline)

Refund state machine 7/7; refund rules + payment cascade 13/13 (transpile-and-assert); **full 8D E2E on PGlite
with the real migration + real `payments-policies.sql`: 13/13** — initiate→processing→succeeded→payment `refunded`,
partial→`partially_refunded`, failed refund leaves payment paid, idempotent webhook redelivery, dispute idempotency,
RLS isolation + write-deny + anon. db + app typechecks clean; `check:db-imports` + `check:client-stripe` green.
Full Vitest + build + live round-trip run on the operator machine / CI.

## Non-goals

Live/real refunds (row 15 + owner sign-off) · automated dispute fund movement · customer-initiated refunds ·
anything requiring real PII or the open Phase-7 gates. Development-only until Phase 7 closes + sign-off.
