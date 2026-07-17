# Phase 8D — Refunds & Disputes — Completion Report

> **Status:** ✅ CODE-COMPLETE (development-only · Stripe TEST mode · offline-verified). · **Date:** 2026-07-02 · ADR-0015
> Live TEST round-trip (Stripe CLI + running app) + full Vitest/build remain an operator/CI step, like rows 12–14.

## Increments
| # | Increment | Status |
|---|-----------|--------|
| 8D.1 | Refund schema (extend `refunds` + `refund_status_history` + statuses + RLS) | ✅ |
| 8D.2 | Refund state machine + `transitionRefund` seam + `emitRefundEvent` | ✅ |
| 8D.3 | Admin/finance refund initiation (TEST, idempotent, guarded) + Stripe refund client | ✅ |
| 8D.4 | Refund + dispute webhooks + payment cascade (`partially_refunded`/`refunded`) + `payment_disputes` | ✅ |
| 8D.5 | Offline E2E + committed RLS/unit tests | ✅ |
| 8D.6 | Customer read-only refund/dispute projections | ✅ |
| 8D.7 | ADR-0015 + this report | ✅ |

## Files
- **Schema/RLS:** `packages/db/src/schema/payments.ts` (refunds extended, `refund_status_history`, `payment_disputes`, statuses), `packages/db/src/rls/payments-policies.sql`.
- **Domain:** `apps/borderpass/src/domain/payments/refund-state-machine.ts`, `refund-rules.ts`; payment machine extended (`partially_refunded`/`refunded`).
- **Server:** `src/server/refund-transitions.ts` (seam), `refund-events.ts`, `refund-webhook.ts` (settler + dispute recorder); webhook route wired; `packages/payments/src/stripe/refund.ts` (TEST refund client).
- **Actions:** `app/actions/admin-refunds.ts` (initiate), `app/actions/refunds.ts` (customer read).
- **Tests:** `refund-state-machine.test.ts`, `refund-rules.test.ts`; `payments-rls.isolation.test.ts` extended (refund/history/dispute RLS + write-deny); 3 other RLS harnesses updated for the new tables.

## Verification (offline)
- Refund machine **7/7**; refund rules + cascade **13/13** (transpile-and-assert).
- **Full 8D E2E on PGlite (real migration + real `payments-policies.sql`): 13/13** — initiate→processing→succeeded→payment **refunded**; partial→**partially_refunded**; **failed refund leaves payment paid**; idempotent webhook redelivery; dispute idempotency; RLS isolation (customer own only) + history staff-only + write-deny + anon→0.
- db + app typechecks clean; `check:db-imports` + `check:client-stripe` green.

## Guardrails held
`transitionRefund` sole refund mutation; disputes RECORD-ONLY (no money movement); integer minor units; Stripe refs only; TEST-mode (`sk_test_`) only — Row 15 (LIVE) still gates real refunds; RLS grants tenant SELECT only; dev-only.

## Operator follow-ups (cannot run in the agent sandbox)
1. `pnpm --filter @maralito/db db:generate` → review + commit the `000X` migration for the 8D schema (drizzle-kit needs native esbuild).
2. `pnpm typecheck && pnpm test && pnpm build` on your machine / CI (full Vitest incl. the new tests).
3. Live TEST round-trip: refund a test PaymentIntent + `stripe trigger charge.dispute.created` via the Stripe CLI against the running app; confirm the webhook path + cascade.

## Not done (out of 8D scope)
Live/real refunds (Row 15 + owner sign-off) · dispute notifications (event emitted; outbox template deferred) · customer-initiated refunds · admin refund UI page (server actions provided; page can be added under Phase 8A UI work). Development-only.
