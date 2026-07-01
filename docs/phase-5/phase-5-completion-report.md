# Phase 5 — Customer Payment Confirmation UX + Notifications Foundation — Completion Report

> **Status:** ✅ COMPLETE (dev-only; code + pure/real-Postgres/offline/CI-guard checks) · **Live Stripe + live Supabase gates NOT run (release blockers)** · **Date:** 2026-06-30 · ADR-0011

## 1. Increments
| # | Increment | Status |
|---|-----------|--------|
| 5.1 | Payment read model + display-state mapper | ✅ `getMyOrderPaymentSummary` + `toPaymentDisplayState` |
| 5.2 | Stripe client boundary (publishable key + loader) | ✅ `NEXT_PUBLIC_*` + `getBrowserStripe` + CI guard |
| 5.3 | Customer payment page (server load + client confirm) | ✅ `/orders/[orderId]/pay` + `PaymentConfirm` |
| 5.4 | Confirmation UX states + return-to-order + retry-safe | ✅ polling, success-only-on-server, retry reuse |
| 5.5 | Receipt foundation (`notification_outbox` placeholder) | ✅ table + RLS + `queuePaymentReceipt` (succeeded-only) |
| 5.6 | Customer/admin payment visibility (read-only) | ✅ `getOrderPaymentForStaff` + detail panels |
| 5.7 | Docs + ADR-0011 + Phase 6 checklist | ✅ this report + 4 docs + ADR |

## 2. Implemented behavior
A customer opens the payment page for their own accepted quote (order `awaiting_payment`), confirms via Stripe
Elements using the server-issued `client_secret`, and sees clear status for every state. After confirm the UI
polls the server and renders **"Paid" only when the webhook-driven status is `succeeded`** — no optimistic paid.
Retry reuses the idempotent Phase 4 PaymentIntent. On `payment.succeeded`, a single placeholder receipt is queued
in `notification_outbox` (no send, no PII). Staff/ops/finance see a read-only org-scoped payment summary.

## 3. Verified (pure / real-Postgres via PGlite / offline Stripe / CI guards — Vitest can't launch in sandbox)
- **Display mapper + flow helpers** — `ready_to_pay/processing/requires_action/succeeded/failed/canceled/none`;
  poll-only-while-processing; retry only for failed/ready_to_pay; **paid view ONLY for `succeeded`**.
- **Copy + status label** — only `succeeded` claims "Paid"; processing reassures without claiming completion.
- **Client Stripe boundary guard** — clean, with a negative test (planted server-token violation caught).
- **`notification_outbox` RLS + idempotency (PGlite, real policy files)** — customer own-only, staff org-scoped,
  customer insert rejected, missing claims → none, duplicate idempotency_key no-op, one receipt per payment.
- **Read-only staff/customer summaries** — type-safe; `admin-payments` no-mutation grep clean.
- Package typechecks (`@maralito/db`, etc.) exit 0; `check:db-imports` + `check:client-stripe` green.

## 4. Tests authored/updated
`src/domain/payments/display.test.ts` (mapper + flow helpers), `copy.test.ts` (copy + label),
`packages/db/tests/notification-outbox-rls.isolation.test.ts` (RLS + idempotency), plus the Phase 4 suites
carried. Client/DOM render tests deferred to the real env (per decision); display/flow logic kept pure + tested.
`scripts/check-client-stripe-boundary.mjs` added + wired into CI.

## 5. Invariants honored
Webhook is the source of truth for `succeeded`/`paid`; client confirm is advisory and cannot mark
succeeded/paid; payment state only via `transitionPayment`, order only via `transitionOrder`;
failed/canceled/requires_action never mark paid; receipt enqueue is succeeded-only + webhook-driven; no external
sends; no raw DB client in `apps/**`; only the publishable key + `client_secret` reach the browser; no card
data/secret/PII logged or stored. **Development-only.**

## 6. NOT done (honest) — release blockers / deferred
- **Live Stripe (test + live) validation** and **live Supabase RLS gate** (now incl. notifications) — PENDING.
- Full `pnpm install`/`next build`/**app-server typecheck** + CI green on a real PR; `@stripe/*` not installed in
  sandbox, so the client components' full typecheck/build runs in the real env. **Vitest can't launch here** (arch-
  mismatched rollup) — suites verified via equivalent harnesses.
- KMS/secret-management decision; saved cards; subscriptions; real refunds/disputes; real notification provider/sends;
  inspection/delivery workflows.

## 7. Recommendation
Phase 5 is complete and proven locally. The next slice is **Phase 6 — Post-Payment Order Lifecycle Foundation:
Inspection + Delivery Preparation** (ADR-0012), with real notification provider integration as a natural follow-on.

> Live deployment remains blocked. Dev foundation ready for Phase 6 planning. Ready for post-completion verification review.
