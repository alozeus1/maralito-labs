# Phase 3 — Quotes + Finance Approval — Completion Report

> **Status:** ✅ COMPLETE (dev-only, pre-payment; code + real-Postgres/pure tests) · **Live Supabase gate NOT run (release blocker)** · **Date:** 2026-06-29 · ADR-0009

## 1. Increments
| # | Increment | Status |
|---|-----------|--------|
| 1 | Quote schema + indexes + RLS | ✅ 4 tables + `quotes-policies.sql` |
| 2 | State machine + validation + money helpers | ✅ 9-state + totals + approval config + Zod |
| 3 | Admin/finance actions + approval | ✅ draft/update/line-items/submit/approve/reject/send/cancel/supersede/history/approvals |
| 4 | Customer actions (accept/decline) | ✅ list/get(safe projection)/accept/decline |
| 5 | Order integration + audit + events + routes | ✅ `transitionOrder` cascades; `emitQuoteEvent`; 5 route placeholders |
| 6 | Tests + docs + ADR-0009 + reports | ✅ this report + Phase 4 checklist |

## 2. Verified by real execution
- **Quote RLS isolation (6):** PGlite + **real policies.sql + orders-policies.sql + quotes-policies.sql** — customer sees own quote only; **only customer-visible non-internal line items**; staff see all; customers can't read status-history/approvals; staff can; missing-claims denied.
- **Quote state machine (10):** role-gated transitions (staff submit, finance approve, customer accept/decline), illegal-transition throws, helpers, expired/draft accept blocked, **order-cascade targets legal** (under_review→quote_ready, quote_ready→awaiting_payment).
- **Totals (deterministic, integer minor units):** category subtotals, total = Σ customer-visible chargeable; mixed-currency + negative-non-discount rejected.
- **Finance approval triggers** (threshold/discount/manual-adjustment/business/flag); **Zod schemas** (negatives restricted, reject reason required, length limits).
- **Quote schema typecheck** vs real drizzle: PASS. **`check:db-imports`** green. **28 Phase 3 tests pass** total.
- Carried Phase 1/2 tests remain green.

## 3. Invariants honored
- All quote data via **`withTenant`**; transitions/approvals/history writes via **`withPrivilegedDbAccess`** (reason + audit).
- Quote status only via **`transitionQuote`**; order status only via **`transitionOrder`** (cascades).
- **Money = integer minor units**; single currency per quote; negatives only for discount/adjustment.
- Customer **cannot** see internal-only line items (RLS) or `internal_notes` (app projection); finance approval ≠ customer acceptance.
- **No Stripe, no payment records, no payment intent.** Accepted quote = "ready for payment" only.
- Audit on all sensitive quote actions incl. `invalid_transition_attempt` / `unauthorized_access_attempt`. Redaction unchanged.

## 4. NOT done (honest) — release blockers / deferred
- **Live Supabase RLS gate** (now incl. quotes isolation) — PENDING; required before any staging/prod/pilot/real PII.
- Full `pnpm install`/`next build`/**app-server typecheck** + CI green on a real PR (the app action layer typechecks in a real env; domain/db/schema verified here).
- Durable workflow wrapping the quote/order seams; real event bus + consumers.

## 5. Deferred to Phase 4 (payments)
Stripe checkout/intents/capture, `payments`/`refunds`, webhooks, real PII/KMS, full UI, quote PDF, notifications.

## 6. Recommendation
Phase 3 Quotes + Finance Approval foundation is complete and proven locally on real Postgres. **Before any non-dev release**, clear the carried release-gate checklist (live Supabase RLS + env/CI). The next slice is **Phase 4 — Stripe payment on an accepted quote** under **ADR-0010**.

> Live deployment remains blocked. Dev foundation ready for Phase 4 planning.

---

## 7. Patch 3.1 — review fixes (2026-06-30)
Applied the Phase 3 review's required fixes before Phase 4:
- **B1 (auto-approve):** `draft → approved` now allows the `system` actor class, so a quote that does not require finance approval auto-approves on submit instead of throwing `IllegalQuoteTransitionError`. `submitQuoteForApproval` wraps the transition and returns structured `conflict_state` on any illegal transition.
- **B2 (actor role):** `approveQuote`/`rejectQuote` pass the user's actual finance role (`financeRoleOf`) rather than positional `roles[0]`, fixing spurious failures for multi-role finance/ops users.
- **Event taxonomy:** `quote.created`, `quote.updated`, `quote.rejected` now emit via `emitQuoteEvent` — all 11 quote events wired.
- **Tests:** added auto-approve (`system`) and multi-role finance approval cases. Pure-domain verification green (21/21) via transpile-and-assert; full Vitest/PGlite suite runs in the real env.

See `docs/current-build-state.md` for the consolidated state.
