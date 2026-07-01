# Phase 3 Readiness Checklist

**Phase 3 (proposed, ADR-0009):** Quote draft + finance approval slice — still **pre-payment** (no Stripe). Builds on the Orders foundation.

## Carried release blockers (still PENDING — required before any non-dev release / real PII)
- [ ] Live Supabase RLS gate (foundation + **orders** isolation) passes on a real project
- [ ] `SET LOCAL ROLE authenticated` works on the pooler, or fallback applied (ADR-0006)
- [ ] Real `pnpm install` + committed `pnpm-lock.yaml` + CI green on a real PR
- [ ] OTP → provisioning → session live smoke
- [ ] KMS/secret-management decision (before storing RFC/KYC)
- [ ] Preview-branching decision

## Phase 3 build (when approved)
- [ ] `quotes` + `quote_line_items` tables (+ RLS extending `orders-rls` pattern; **extend the isolation test**)
- [ ] Quote Zod schemas + draft helpers; **finance-approval gate** (`requireRole('finance_admin')`)
- [ ] `transitionOrder`: under_review→quote_ready (after approval); customer accept → awaiting_payment
- [ ] Audit quote.created/sent/accepted; event placeholders
- [ ] **No payment execution** (Stripe is a later phase)

## Foundation Phase 3 can rely on (delivered)
Orders schema + RLS + state machine + `transitionOrder` seam · `withTenant`/`withPrivilegedDbAccess` · owner/role-checked action pattern · audit + redaction · PGlite real-policy test harness (extend per table) · raw-client guard.

## Standing rules
Status only via `transitionOrder` (durable workflow wraps later) · money minor units · no PII without KMS · live gate before release · all tenant data via `withTenant`.
