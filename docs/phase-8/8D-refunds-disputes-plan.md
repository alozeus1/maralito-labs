# Phase 8D — Refunds & Disputes (Sub-phase Plan)

> **Status:** PLAN (drafted 2026-07-02). **Phase 8 started at the sub-phase-planning level for 8D only.**
> Development-only · **Stripe TEST mode only** · synthetic data only · **no live money movement**.
> Implementation proceeds increment-by-increment: I build one increment, STOP, report, and wait for your
> approval before the next (same discipline as Phases 2–7). ADR-0015 records this sub-phase (accepted at completion).

## Why 8D first (given Phase 7 is still open)

ADR-0014 makes Phase-7 close (rows **11 OTP**, **18 rotation**, **19 sign-off**) a hard precondition for the
tester-facing sub-phase **8A**. Those are still open, so 8A stays blocked. **8D is pure server-side domain code**,
verifiable **offline** (PGlite + offline Stripe signatures, exactly like the proven rows 12–14), touches **no live
auth, no testers, no real secrets, and no real money** — so it can proceed dev-only now without violating what the
open gates protect. **8B (KMS)** is the alternative buildable-now sub-phase if you'd rather do that first.

## Objective

Complete the payment lifecycle beyond the current `refunds` placeholder: initiate **Stripe TEST-mode refunds**
(partial/full) through a state-machine seam, ingest **refund + dispute webhooks** idempotently, keep
payment/order state consistent, and expose read-only refund status — all with RLS, audit, and isolation tests.

## Guardrails (non-negotiable)

- **TEST mode only** — refuse `sk_live_`; no live refunds (that is Phase-7 row 15 + separate owner sign-off).
- **Never auto-move money on disputes** — disputes are recorded/notified; funds are handled by Stripe; no automated transfers.
- Refund state changes **only** via a new `transitionRefund` seam (assert legality → history → audit → event placeholder), mirroring `transitionPayment`.
- **Idempotent** everywhere: `unique(provider, idempotency_key)` on refunds; webhook events deduped via the existing `stripe_webhook_events` ledger.
- Tenant access only via `withTenant`/`withPrivilegedDbAccess`; RLS on all new tables; no raw client in `apps/**`.
- Money = integer minor units; Stripe refs only; no card data.

## Increment breakdown

| Inc | Deliverable | Acceptance (offline-verifiable) |
|-----|-------------|--------------------------------|
| **8D.1** | Refund schema: replace placeholders — `refunds`(amount_minor, currency, status, stripe_refund_id, reason, idempotency_key, order_id, payment_id, quote_id, org_id, customer_id, FKs) + `refund_status_history` + refund status enum. Migration + `refunds`/history RLS policy file. | Migration applies on PGlite; RLS file applies; unique(provider, idempotency_key) + unique stripe_refund_id present. |
| **8D.2** | Pure refund state machine (`requested → processing → succeeded / failed / canceled`) + `transitionRefund` seam (legality, history, audit, `emitRefundEvent` placeholder). | State-machine unit assertions pass; illegal transitions rejected. |
| **8D.3** | Role-gated refund **initiation** server action (admin/finance): partial/full, only on `succeeded` payments, idempotency key `re_<payment_id>_<n>`, withTenant + audit. Stripe TEST refund via server-only client. | Guard rejects non-succeeded payment + over-refund; no `sk_live_`. |
| **8D.4** | Webhook ingestion: `charge.refund.updated` / `refund.*` → `transitionRefund`; `charge.dispute.*` → record dispute + notify (no money movement). Idempotent via ledger; order/payment consistency. | Duplicate/redelivered event → 1 ledger row, no double cascade; dispute recorded, funds untouched. |
| **8D.5** | Tests: refund/dispute **RLS isolation**, **idempotency** (no double-refund), **failed refund leaves payment `paid`**, offline Stripe signature verify + tamper-reject. | PGlite + offline-Stripe harness green (mirrors rows 12–14 evidence pattern). |
| **8D.6** | Customer-visible **read-only** refund status (safe projection) in order/payment views + admin refund panel (calls actions only). | Customer sees own refund status only (RLS); no internal fields leaked. |
| **8D.7** | Docs + **ADR-0015** (accepted) + completion report + Phase-8 ledger note. | Docs consistent; no readiness claims; dev-only. |

## Verification approach

Same as Phases 4–7: pure-logic transpile-and-assert for the state machine; **PGlite applying the real migration +
RLS files** for isolation/idempotency; **offline Stripe** (`generateTestHeaderString`) for webhook signature +
tamper tests. Full Vitest/build run in CI on your machine. No live Stripe calls from the sandbox.

## Non-goals for 8D

Live/real refunds (row 15 + owner sign-off) · automated dispute fund movement · customer-initiated refunds
(admin/finance-initiated only for now) · partial-capture flows · anything requiring real PII or the open Phase-7 gates.

## Interaction with open Phase 7 gates

8D ships **dev-only**. It does **not** unblock testers, real payments, or Phase-7 rows 11/18/19 — those remain the
gate for any real-money/tester exposure. Row 15 (Stripe LIVE) is still required before any *live* refund.

## Next step

Reply **"begin 8D.1"** to start the schema increment (I'll build it, run the offline checks, STOP, and report before
8D.2). Or say **"switch to 8B"** (KMS) if you'd rather build that sub-phase first. No code is written until you approve.
