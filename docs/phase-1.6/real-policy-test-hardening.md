# Phase 1.6 — Real policies.sql in the RLS test

**Before:** the PGlite test re-declared policies inline (proved the mechanism, not the real file).

**Now:** `packages/db/tests/rls.isolation.test.ts`:
1. Creates schema tables (mirroring the Drizzle schema columns the policies reference) + `auth.uid()`/`auth.role()` shims + `authenticated` role + grants.
2. **Reads + applies the real `packages/db/src/rls/policies.sql`** (`readFileSync` + `exec`) — **fails on any syntax error or policy mismatch** in the actual file.
3. Runs 9 cross-tenant scenarios (own-row, customer≠staff, non-admin≠audit, super-admin, missing-claims, missing-org, RLS backstop, privileged bypass, duplicate-role).

**Scope (honest):** proves the **real policy file** enforces correctly under Postgres. It does **not** prove the Supabase deployment — that's the live gate. Residual drift risk: the table DDL is a mirror; full parity with `drizzle-kit`-generated DDL is a real-env step.

**Run:** `pnpm --filter @maralito/db test:rls` (CI-runnable; no external DB).
