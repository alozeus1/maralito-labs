# Phase 2 — Orders Domain Foundation (DEV-ONLY)

> **Conditional approval:** development-only. **Live Supabase RLS gate is NOT run and remains a hard blocker** before any staging/production/pilot or real customer PII. No production-readiness claimed. ADR-0008.

## Built (dev-only)
- **Schema:** `orders` + `order_items` (`@maralito/db`), indexes + FKs; **no `rfc`/PII column** (KMS-gated).
- **RLS:** `orders-policies.sql` (customer owns own orders; staff org read; ops/super_admin update) — proven on real PGlite with the real policy files.
- **State machine:** 25 states + legal-transition table + `assertTransition`; single mutation seam **`transitionOrder`** (durable Inngest workflow wraps it later).
- **Validation:** `OrderCreate/OrderItemInput/OrderSubmit/OrderDraftPatch/OrderListQuery` (Zod).
- **Customer actions:** `createOrder, updateDraftOrder, submitOrder, listMyOrders, getMyOrder` — `withTenant` + owner checks + audit.
- **Admin actions:** `adminListOrders, adminGetOrder, advanceOrder, holdOrder` — `withTenant` + role checks + audit.
- **Audit + event/route placeholders:** order audit events; `emitOrderEvent` stub; protected `(customer)/orders` + `(admin)/orders` pages.

## NOT in Phase 2
payments · quotes · inspection · delivery · notifications · AI · durable workflow engine · real PII/KMS · full admin UI.

## Guardrails kept
All order data via `withTenant` (raw client blocked by `check:db-imports`); status mutated only via `transitionOrder`; money = integer minor units; live RLS = PENDING.

**Docs:** `order-domain.md` · `order-state-machine.md` · `rls-orders.md` · `release-gate-checklist.md` · `phase-2-completion-report.md` · `phase-3-readiness-checklist.md` · ADR-0008.
