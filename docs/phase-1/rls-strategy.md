# Phase 1 / 1.5 — RLS Strategy (corrected)

> **Correction (Phase 1.5):** Phase 1 docs overstated that "double enforcement" was already active. It was **not**: the Drizzle BFF path connected as the DB role and **did not exercise RLS**. Phase 1.5 fixes this with a request-scoped access pattern (ADR-0006). This document supersedes the earlier wording.

## Principle
Authorization is enforced at two layers — **RBAC** at the app (guards) **and** **RLS** at Postgres. As of Phase 1.5, **both are active on the server path** when tenant data is accessed through `withTenant(...)`.

## The access pattern (ADR-0006, Option C)
| Path | How | RLS? | Use for |
|------|-----|:----:|---------|
| `withTenant(db, ctx, fn)` | tx + `set_config('request.jwt.claims', …)` + `set local role authenticated` | **Yes (enforced)** | all tenant-protected reads/writes |
| `withServiceRole(db, reason, fn)` | runs as connection role; `reason` required | No (bypass by design) | seed/bootstrap, audit writes, role admin, system ops |
| `createDbClient(url)` raw | direct connection | **No (by itself)** | migrations / system; **not** for tenant data |

`withTenant` is **fail-closed** (`strict`): if the connection can't assume the `authenticated` role, the transaction aborts rather than silently bypassing RLS.

## Tenant context
The caller's org is derived from `auth.uid()` (the JWT `sub` we set) via `SECURITY DEFINER` helpers that read `user_identities`:
`app_current_org_id()`, `app_has_role(role)`, `app_is_staff()`. `org_id` is never client-supplied.

## Policies (`packages/db/src/rls/policies.sql`)
RLS enabled on every table (default-deny). Selected: customer_profiles owner select/**insert**/update; staff_profiles self or (same-org **and staff**); user_roles self-read (+ super_admin all); audit_logs compliance/super_admin within org; reference tables readable by authenticated; **all privileged writes via service-role**. Per-entity domain-table policies arrive with those tables (ADR-0007).

## Service-role usage rules
- **Server-only**, `import 'server-only'`; key never in a browser bundle / `NEXT_PUBLIC_*`.
- Allowed only for the four privileged cases above; **requires a `reason`**; **emits/pairs with audit**.
- Never used for normal customer/admin data access.

## Verification
- **Mechanism proven on real Postgres (PGlite):** `packages/db/tests/rls.isolation.test.ts` — 9 scenarios pass (CI-runnable). See `rls-testing.md`.
- **Live-Supabase verification is a BLOCKING gate before Phase 2** (apply real policies + confirm `set local role authenticated` works on the pooler). Not yet done — not claimed.
