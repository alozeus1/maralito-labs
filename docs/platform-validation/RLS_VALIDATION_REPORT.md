# RLS Validation Report

> **Validated:** 2026-06-30 · Mechanism tests run locally on **PGlite** (real Postgres engine,
> in-process). Live Supabase verification **not** run (no credentials in this environment).

## Headline
- **Mechanism: PROVEN locally.** `pnpm --filter @maralito/db test` → **17/17 tests pass** across 3
  files (RLS isolation, orders-RLS isolation, provisioning integration).
- **Production isolation: `NOT FULLY VALIDATED — LIVE SUPABASE REQUIRED`.** The declared blocking gate
  (`packages/db/scripts/live-rls-gate.ts`, ADR-0007) has **not** been executed against a real Supabase
  project + pooler. Until it passes green, do **not** claim tenant isolation is production-safe.

## Model under test
- **Auth:** Supabase Auth; JWT `sub` = `auth.uid()`.
- **Tenancy:** `org` = tenant. `org_id` is **never client-supplied** — derived from `auth.uid()` via
  `SECURITY DEFINER` helpers (`app_current_org_id()`, `app_has_role()`, `app_is_staff()`) reading
  `user_identities`.
- **RBAC:** 9 roles + agent principal (`@maralito/auth`, 6 passing tests). Enforced app-side **and**
  mirrored in RLS (double enforcement, ADR-0005/0006).
- **Access pattern (ADR-0006, Option C):**
  | Path | RLS | Use |
  |------|:---:|-----|
  | `withTenant(db, ctx, fn)` — tx + `set_config('request.jwt.claims', …)` + `set local role authenticated` | ✅ enforced | all tenant reads/writes |
  | `withServiceRole(db, reason, fn)` | ⛔ bypass by design | seed/bootstrap, audit writes, role admin, system ops (requires `reason`, pairs with audit) |
  | `createDbClient(url)` raw | ⛔ none | migrations/system only — **blocked** outside allowed paths by `check:db-imports` |
- **`withTenant` is fail-closed** (`strict`): if the `authenticated` role can't be assumed, the
  transaction aborts rather than silently bypassing RLS.
- **Policies:** `packages/db/src/rls/policies.sql` (RLS enabled + default-deny on every table) +
  `packages/db/src/rls/orders-policies.sql` (orders domain).

## What the 17 passing tests cover (locally, on PGlite)
| File | Tests | Asserts |
|------|:-----:|---------|
| `tests/rls.isolation.test.ts` | 9 | tenant read/write isolation, owner-only access, staff-vs-customer scoping, service-role bypass boundary, default-deny |
| `tests/orders-rls.isolation.test.ts` | 5 | orders domain respects org scoping under RLS (reads **and** writes) |
| `tests/provisioning.integration.test.ts` | 3 | new-user provisioning creates correct identities/roles without widening access |

### Master checklist — coverage assessment
| Requirement | Covered by mechanism tests? | Live-gate confirms? |
|-------------|:---------------------------:|:-------------------:|
| User can access only own tenant data | ✅ (PGlite) | 🔴 pending |
| User cannot access other tenant data | ✅ (PGlite) | 🔴 pending |
| Writes protected (not just reads) | ✅ (orders-RLS write cases) | 🔴 pending |
| Admin routes restricted | ✅ (RBAC unit tests) | 🟡 app routes not built yet |
| Service role never client-side | ✅ (`server-only` + import guard) | n/a (static) |
| Audit logs append-only / protected | 🟡 policy designed; **DB-level append-only to confirm in live gate** | 🔴 pending |
| Orders domain respects RLS | ✅ | 🔴 pending |
| Role changes don't widen access accidentally | ✅ (provisioning tests) | 🔴 pending |

## Why PGlite ≠ full production confidence
PGlite runs the real Postgres engine and executes the actual policy SQL + `set local role
authenticated`, so the **policy logic and the role-switch mechanism are genuinely exercised**. What it
does **not** prove:
1. Behavior through the **Supabase connection pooler** (transaction-mode pooling + `set local role`
   interaction) — historically the riskiest part of this pattern.
2. Supabase-managed roles/grants and the real `request.jwt.claims` plumbing.
3. Append-only enforcement and triggers as deployed.
These are exactly what `live-rls-gate.ts` is built to check.

## Required action to close the gate
1. Provision a real Supabase project (or a preview branch).
2. Apply migrations + `policies.sql` + `orders-policies.sql` + seed.
3. Set `DATABASE_URL` / `SUPABASE_DB_*` and run `pnpm --filter @maralito/db exec tsx scripts/live-rls-gate.ts`
   (15 isolation checks).
4. Confirm `set local role authenticated` works on the **pooler** connection, not just a direct one.
5. Record the result here and flip the gate to ✅ before Phase 3 / production.

**Status until then:** `NOT FULLY VALIDATED — LIVE SUPABASE REQUIRED`.
