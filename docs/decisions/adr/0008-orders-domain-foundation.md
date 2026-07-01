# ADR 0008 — Orders Domain Foundation (dev-only)

- **Status:** Accepted (development-only; live-gate blocked for release) · **Date:** 2026-06-29 · **Phase:** 2
- **Numbering:** 0008 = Orders Domain Foundation (0007 was provisioning + live-gate). Next ADR = 0009.

## Context
Phase 1.6 hardened the auth/RLS foundation but the **live Supabase RLS gate has not run**. The team approved building the **Orders Domain Foundation locally** while keeping the live gate as a hard blocker for staging/prod/pilot/real-PII.

## Decisions
1. **Schema.** `orders` + `order_items` (Drizzle), per contracts B4/B5, **Phase-2 subset**; the `rfc`/PII column is **omitted** until KMS field-encryption is decided.
2. **RLS.** Order tables ship `orders-policies.sql` (customer owns own orders; staff org-read; ops/super_admin update), applied after `policies.sql`. Verified on real PGlite.
3. **State machine + single seam.** 25-state machine with a legal-transition table; **`transitionOrder` is the only status-mutation point**. A durable Inngest workflow will wrap this seam later — it is intentionally NOT the durable engine yet, but it preserves the "status changes only through a controlled path" invariant.
4. **Access pattern.** All order data flows through **`withTenant`** (RLS enforced); privileged/system writes via **`withPrivilegedDbAccess`** (audited). Raw client remains blocked in app code (`check:db-imports`). Customer actions are owner-checked; admin actions role-checked.
5. **Placeholders.** Domain events via an `emitOrderEvent` **stub** (no bus yet); `(customer)/orders` + `(admin)/orders` are protected **route placeholders**.
6. **Live gate PENDING.** Marked in all Phase 2 docs + a release-gate checklist. **No production-readiness claimed.**

## Consequences
- A customer can create/edit/submit a draft order; staff can list/advance — all RLS-scoped and audited — **in dev**.
- Quotes/payments/inspection/delivery/notifications/AI and the durable workflow engine are **deferred** (later phases).
- Real customer PII and any non-dev release remain **blocked** on the live Supabase gate + KMS decision.

## Verified (real Postgres / pure tests)
Order RLS isolation (5, PGlite + real policy files) · state machine (legal/illegal/terminal + submit rules) · order Zod schemas. Order schema typechecks vs real drizzle. `check:db-imports` green.
