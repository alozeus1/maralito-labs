# ADR 0006 — RLS-aware server database access (request-scoped tenant context)

- **Status:** Accepted · **Date:** 2026-06-29 · **Phase:** 1.5
- **Deciders:** Principal Backend Eng, Supabase/RLS Architect, DB Security Eng, DevSecOps Lead, Security Reviewer
- **Numbering note:** 0006 is assigned to this RLS hardening. The Orders foundation ADR will be **0007**.

## Context
Phase 1 review (High finding): the app's Drizzle client opens a **direct Postgres connection as the connection role** and does **not** set per-request identity, so **RLS was not exercised on the BFF path** — tenant isolation rested on app-level scoping only. This must be fixed before Phase 2 introduces orders + PII. The Phase 1 docs also **overstated** that "double enforcement" was already active.

## Decision — Option C (hybrid)
1. **Drizzle** remains the source for schema, migrations, and typed server-side operations.
2. **`withTenant(db, ctx, fn)`** runs protected reads/writes inside **one transaction** that sets request identity so RLS applies:
   - `set_config('request.jwt.claims', '{"sub","role","org_id"}', true)` (+ `request.jwt.claim.sub`, optional `app.current_org_id`),
   - `set local role authenticated` (the RLS-enforcing, non-BYPASSRLS role).
   - **Fail-closed:** in `strict` mode, if the role can't be assumed the transaction aborts — we never silently run as a privileged connection role.
3. **`withServiceRole(db, reason, fn)`** is the only privileged path (RLS bypassed by design). Allowed **only** for: seed/bootstrap, audit writes, role/admin maintenance, system ops that can't run as the tenant user. Requires a `reason`; emits/【pairs with】audit.
4. The wrapper is the **seam**: if a deployment's connection role can't `set local role authenticated`, the execution strategy can swap (claims-only on a non-BYPASS role, or route via the Supabase client) **without changing domain code**.

## Verification status (honest)
- **Mechanism proven against real Postgres (PGlite 0.5.3 / PG18):** `tests/rls.isolation.test.ts` — 9 scenarios pass (own-row isolation, customer≠staff, non-admin≠audit, super-admin elevation, missing-claims denial, missing-org denial, RLS backstop, service-role bypass, duplicate-role rejection). Runs in CI with no external DB.
- **NOT yet verified against live Supabase:** whether the configured `DATABASE_URL` role can `set local role authenticated` in the pooler, and the real `policies.sql` applied to a real project. This is a **blocking gate before Phase 2** (`docs/phase-1/rls-testing.md`). We do **not** claim live Supabase verification.

## Consequences
- Domain code calls `withTenant(...)` for tenant data; `createDbClient` raw queries are reserved for migrations/system use and documented as **not** RLS-enforcing on their own.
- Slight per-request transaction overhead (acceptable; `prepare:false` already set for poolers).
- Phase 2 domain tables ship their RLS policies + extend the isolation test (ADR-0007).

## Alternatives
- **A (wrapper only, no service split):** lacks the explicit audited privileged path — rejected.
- **B (route everything via Supabase client):** loses Drizzle typed queries; heavier — rejected. Kept as a documented fallback inside the wrapper.
