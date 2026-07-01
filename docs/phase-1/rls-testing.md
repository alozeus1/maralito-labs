# Phase 1.5 — RLS Testing & CI Gate

## Layer 1 — Mechanism test (runs in CI, no external DB)
**File:** `packages/db/tests/rls.isolation.test.ts` — runs against **real embedded Postgres (PGlite)** with a non-superuser `authenticated` role, the helper functions, and RLS policies, exercising the `withTenant` claim/role mechanism.

**Scenarios (9, all passing):**
1. User A cannot read User B's customer profile.
2. Customer cannot read staff profile.
3. Non-admin staff cannot read admin-only (audit); compliance_admin can.
4. super_admin sees all roles; others only their own.
5. RLS denies when request claims are missing.
6. RLS denies when org context is missing where required.
7. RLS backstops a missing app-level filter.
8. Service-role (privileged) path bypasses RLS by design.
9. Duplicate `user_roles` assignment blocked by unique constraint.

**Command:** `pnpm --filter @maralito/db test:rls` (or `pnpm test`). **Deps:** `@electric-sql/pglite` (devDep).

## Layer 2 — Live Supabase verification (BLOCKING gate before Phase 2)
PGlite proves the *mechanism*; it does **not** prove the *Supabase deployment specifics*. Before Phase 2:

1. Provision a Supabase project; set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. `pnpm --filter @maralito/db db:generate && db:migrate` → apply `src/rls/policies.sql`.
3. **Capability probe:** confirm the `DATABASE_URL` role can `set local role authenticated` (call `canAssumeAuthenticatedRole(db)`). If **false**, switch `withTenant` mode to the documented fallback (claims-only on a non-BYPASS role, or Supabase-client path) — no domain-code change.
4. Run a live isolation smoke: two real users, confirm A cannot read B's row through `withTenant`.
5. `db:seed` (dev), then OTP sign-in round-trip.

## CI gating plan
- **Now (Layer 1):** `test:rls` is part of `pnpm test` → the existing **unit-tests gate** blocks merges on RLS regressions.
- **Before Phase 2 (Layer 2):** add a CI job (or release checklist gate) that runs migrations + `policies.sql` + the capability probe + live isolation smoke against a Supabase **preview/staging** project. **Merges that add domain (tenant) tables must not pass until this gate is green.**

## Required environment variables
`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). Layer 1 needs **none** (PGlite is in-process).

## Phase 2 blocking note
**Do not introduce orders / customer PII tables until the Layer 2 live-Supabase isolation check passes.** PGlite proves the pattern is correct; only the live check proves the deployment enforces it.
