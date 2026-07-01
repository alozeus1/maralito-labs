# ADR 0007 — New-user provisioning + live RLS gate (Phase 1.6)

- **Status:** Accepted · **Date:** 2026-06-29 · **Phase:** 1.6
- **Numbering note:** 0007 is assigned to this provisioning/RLS-gate work. The **Orders foundation ADR moves to 0008.**

## Context
Phase 1.5 review found: (a) no path provisions a fresh OTP user, so `getAppSession` returns null and the customer guard fails; (b) the RLS test re-declared policies inline; (c) `withServiceRole` naming implied a separate credential; (d) the raw DB client was reachable from app code. These must be resolved before Phase 2 (orders + PII).

## Decisions
1. **New-user provisioning.** On first successful auth (callback), `provisionAuthenticatedUser(authUserId, email?)` runs `provisionUserCore` via `withPrivilegedDbAccess` (idempotent: identity + default **customer** role + baseline profile) and audits `user.provisioned`. `getAppSession` stays read-only.
2. **Single shared customer org.** All customers belong to one `BorderPass customers` org (`BORDERPASS_DEFAULT_CUSTOMER_ORG_ID`); per-customer isolation is the **owner predicate** (`auth_user_id = auth.uid()`), which the RLS policies already enforce. (Per-customer-org rejected as unnecessary complexity.)
3. **Privileged path renamed.** `withServiceRole` → **`withPrivilegedDbAccess(reason, fn)`** (alias kept, deprecated). It means "privileged base DB connection (RLS bypassed)", **not** the Supabase `service_role` key. Requires a `reason`; audited; server-only.
4. **Wrappers own the client.** `createDbClient` → **`createRawDbClient`** (internal to `@maralito/db`; migrations/seed/tests only). `withTenant`/`withPrivilegedDbAccess` fetch the client via an internal `getDb()` singleton, so **app code never holds a raw client**. Enforced by ESLint `no-restricted-imports` + a CI scan (`scripts/check-db-imports.mjs`).
5. **Real policy file under test.** The PGlite isolation test now reads + applies the real `policies.sql`.
6. **Live Supabase RLS gate.** A runnable 15-check script (`scripts/live-rls-gate.ts`) + runbook; **must pass on a real project before Phase 2**. Not run in the sandbox.

## Consequences
- Fresh users are usable immediately (identity + customer role).
- Domain code is insulated from raw DB access; the fallback strategy (if `SET LOCAL ROLE` fails) swaps inside `withTenant` without touching domain code.
- Orders foundation ADR is **0008**.

## Verification (sandbox, real Postgres)
- Provisioning: 3 tests (create + idempotent + session prerequisites) — PGlite via Drizzle driver.
- RLS isolation with **real policies.sql**: 9 scenarios — PGlite.
- Raw-client guard scan: passes (no app imports). Live Supabase gate: **NOT RUN** (blocking).
