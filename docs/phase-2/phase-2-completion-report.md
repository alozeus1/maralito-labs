# Phase 2 — Orders Domain Foundation — Completion Report

> **Status:** ✅ COMPLETE (dev-only; code + real-Postgres/pure tests) · **Live Supabase gate NOT run (BLOCKING for release)** · **Date:** 2026-06-29
> **Scope:** Orders Domain Foundation only. No payments/quotes/inspection/delivery/notifications/AI/full-admin-UI. No real PII. No production-readiness claimed. ADR-0008.

## 1. Increments
| # | Increment | Status |
|---|-----------|--------|
| 1 | Order schema + indexes + RLS | ✅ `orders`/`order_items` + `orders-policies.sql` |
| 2 | State machine + validation + helpers | ✅ 25-state + `transitionOrder` seam + Zod + rules |
| 3 | Customer order actions (owner) | ✅ create/updateDraft/submit/list/get via `withTenant` |
| 4 | Admin order actions (role) | ✅ list/get/advance/hold via `withTenant` + role checks |
| 5 | Audit + event/route placeholders | ✅ order audit events; `emitOrderEvent` stub; `(customer)/orders` + `(admin)/orders` |
| 6 | Tests + docs + ADR-0008 + reports | ✅ this report + checklists |

## 2. Verified by real execution
- **Order RLS isolation (5):** PGlite + **real `policies.sql` + `orders-policies.sql`** — customer sees only own order; cannot read another's order/items; ops sees all org orders; missing-claims denied; cannot insert for another customer (with-check).
- **State machine (7 checks):** 25 states; legal/illegal transitions; terminal exits; submit-rule field checks.
- **Order Zod schemas (3):** qty/Money validation, service_type enum, ord_ id.
- **Order schema typecheck** vs real drizzle: PASS. **`check:db-imports`** green (no raw-client in app).
- Carried foundation tests remain green (RBAC/validation/redaction/provisioning/foundation-RLS).

## 3. Invariants honored
- All order data via **`withTenant`** (RLS enforced); privileged writes via **`withPrivilegedDbAccess`** (audited).
- Status mutated **only** via **`transitionOrder`** (durable workflow wraps it later).
- Money = integer **minor units**; enums per `contracts/04`.
- **No `rfc`/PII** stored (KMS-gated); audit redaction unchanged (no OTP/tokens/secrets).
- App name BorderPass; no payments/AI/notifications/delivery introduced.

## 4. NOT done (honest) — blocking for any non-dev release
- **Live Supabase RLS gate** (incl. order isolation + `SET LOCAL ROLE`) — PENDING (`release-gate-checklist.md`).
- Full `pnpm install`/`next build`/CI-green on a real PR; OTP live round-trip.
- Durable workflow engine wrapping `transitionOrder`; real event bus (currently a stub).

## 5. Deferred to later phases
Quotes (Phase 3+), payments, inspection, delivery, notifications, AI agents, durable Inngest workflows, real PII + KMS, full admin order UI, per-surface staff RLS refinement.

## 6. Recommendation
Phase 2 Orders Domain Foundation is complete and proven locally on real Postgres. **Before any staging/prod/pilot or real PII**, clear the release-gate checklist (live Supabase RLS + the carried env/CI gates). The next functional slice is **Phase 3** (per Master Build Package — quote draft + finance approval, still pre-payment) under **ADR-0009**.

> Live deployment remains blocked. Dev foundation ready for the next phase's planning.
