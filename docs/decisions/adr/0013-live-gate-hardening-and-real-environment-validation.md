# ADR 0013 — Live-Gate Hardening + Real Environment Validation (dev-only tooling)

- **Status:** Accepted (tooling only; the gates themselves remain UNRUN) · **Date:** 2026-06-30 · **Phase:** 7
- **Numbering:** 0013 = live-gate hardening. Next ADR = 0014.

## Context
Phases 0–6 built a large **development-only** foundation, verified locally (pure logic + real-Postgres via
PGlite + guard greps). The dominant remaining risk is **not** another feature — it is that the live gates
(live Supabase, real install/build/CI, Stripe test-mode, OTP, KMS, preview branching) have never run. Phase 7
hardens and automates those gates so an operator can execute them repeatably, **without** adding product surface.

## Decision
1. **Phase 7 delivers tooling + runbooks, not gate results.** No live gate is executed in the dev sandbox, and
   **none is marked passed** here. Each gate is made one-command runnable and tracked in a ledger that stays
   unchecked until an operator runs it for real.
2. **Consolidated, non-destructive live-RLS-gate** (`packages/db/scripts/live-rls-gate.ts`, `pnpm gate:rls`):
   seeds two customers + a full order→quote→payment→inspection→delivery→notification chain in ONE transaction,
   asserts cross-domain tenant isolation as the `authenticated` role across all seven policy files, then rolls
   the whole transaction back (nothing persists). Runs against a real `DATABASE_URL`.
3. **Preflight** (`scripts/preflight.mjs`, `pnpm preflight`): runs the locally-runnable gates (db-imports,
   client-stripe, `.env.example` completeness, all policy files present) and prints the operator gate checklist.
4. **Operator CI** (`.github/workflows/live-gates.yml`): a manual, secret-gated workflow (not part of normal PR
   CI) that runs install/typecheck/test/build + `db:migrate` + `gate:rls` once real secrets are configured; it
   hard-fails without `DATABASE_URL` so it cannot produce a false green.
5. **Stripe test-mode smoke** (`packages/payments/scripts/stripe-smoke.mjs`, `pnpm --filter @maralito/payments
   stripe:smoke`): offline checks (keys present + TEST-mode, refuses `sk_live_`, API-version vs pinned default,
   webhook signature verify + tamper-reject) here; the live PaymentIntent + webhook round-trip is an operator
   step (Stripe CLI) in the runbook.
6. **Decision records are templates, not decisions.** KMS/secret-management and preview-branching records are
   provided for an operator/owner to complete; Claude does not make these decisions.

## Non-goals / constraints
No live Supabase/Stripe contact from the sandbox; no real card data; no product features; no new order states;
no staging/pilot/production/real-payment/real-PII readiness claims. Phase 7 remains development-only until the
operator-run gates are executed and recorded as passed in `docs/phase-7/gate-ledger.md`.

## Verified locally
`gate:rls` isolation logic — 10/10 on real Postgres (PGlite, all 7 policy files). `preflight` — local gates PASS
+ operator checklist printed. `stripe-smoke` — 5/5 offline checks pass with dummy TEST env; refuses `sk_live_`.
`check:db-imports` + `check:client-stripe` green; packages/db + validation typechecks green. **All live gates NOT run.**
