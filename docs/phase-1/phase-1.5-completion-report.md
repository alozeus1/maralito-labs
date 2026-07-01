# Phase 1.5 — Foundation Hardening Completion Report

> **Status:** ✅ COMPLETE (code + real tests; live-Supabase verification gated) · **Date:** 2026-06-29
> **Scope:** fix the Phase 1 review gaps before Phase 2. No orders/payments/UI/AI/notifications.

## 1. Deliverables vs scope

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | RLS-aware Drizzle access pattern | ✅ | `@maralito/db` `withTenant` / `withServiceRole` (ADR-0006) |
| 2 | Per-request auth claims for DB access | ✅ | `set_config('request.jwt.claims',…)` + `set local role authenticated` |
| 3 | Cross-tenant RLS isolation test (blocking) | ✅ (mechanism) / 🟡 (live) | `packages/db/tests/rls.isolation.test.ts` — 9 pass on real Postgres; live-Supabase gate documented |
| 4 | Missing indexes | ✅ | identity/profiles/rbac/audit indexes |
| 5 | `user_roles` uniqueness | ✅ | unique(`auth_user_id,org_id,role_key`) |
| 6 | Audit wiring (denial/role/auth) | ✅ | roles.ts, auth-events.ts, guards, callback, seed |
| 7 | RLS/auth doc corrections | ✅ | rls-strategy, auth-rbac, audit-logging, completion report |
| 8 | Real install/lockfile/CI verification | 🟡 documented | gate checklist (real env) |
| 9 | Supabase provision/migrate/RLS/seed checklist | ✅ | `rls-testing.md` + phase-2 checklist |
| 10 | OTP auth smoke-test checklist | ✅ | phase-2 checklist |
| 11 | `@maralito/sdk` Phase 2 surface | ✅ | `IdentityService`/`AuditService` interfaces (no impl) |

## 2. Verified by real execution (sandbox)
- **20 tests pass** together: RBAC (6), validation (6), redaction (2), **RLS isolation on real Postgres / PGlite (9 incl. service-role + duplicate-constraint)**.
- `withTenant`/`withServiceRole` + schema (indexes/unique) **typecheck** against real `drizzle-orm`/`postgres`.
- No secrets; service-role key only in server-only modules; no client component imports db/service.
- The RLS test runs **in CI** (PGlite, no external DB) → guards against regressions now.

## 3. NOT verified (honest) → blocking gate before Phase 2
- **Live Supabase RLS** — whether the real `DATABASE_URL` role can `set local role authenticated` (pooler/role membership) and the real `policies.sql` enforces isolation on a live project. Use `canAssumeAuthenticatedRole(db)` + a live two-user smoke. **Do not claim done.** (`rls-testing.md` Layer 2.)
- Full `pnpm install` / `next build` / workspace typecheck; CI green on a real PR; OTP round-trip.

## 4. The High finding — resolved (with caveat)
Phase 1's Drizzle BFF path bypassed RLS. **Fixed:** tenant data now flows through `withTenant` (RLS enforced, fail-closed if the role can't be assumed); the only bypass is `withServiceRole` (explicit, justified, audited). The mechanism is **proven on real Postgres**; the **Supabase deployment specifics remain a blocking gate** (Layer 2). The wrapper is a seam, so the fallback strategy can swap without touching domain code.

## 5. Acceptance criteria
| Criterion | Status |
|-----------|--------|
| Server/BFF RLS-aware access pattern | ✅ |
| Service-role restricted + documented | ✅ |
| Cross-tenant RLS isolation test exists | ✅ (real Postgres) |
| RLS test designated blocking before Phase 2 | ✅ (Layer 1 in CI now; Layer 2 live gate) |
| `user_roles` duplicates prevented | ✅ (unique + tested) |
| Foundation indexes added | ✅ |
| Key denial/role/auth actions audited | ✅ |
| Docs no longer overstate RLS | ✅ |
| Real-env Phase 2 gates documented | ✅ |
| `@maralito/sdk` minimal surface confirmed | ✅ |
| Existing tests still pass | ✅ (20 green) |
| New tests pass / marked real-env gated | ✅ |
| Phase 2 readiness updated | ✅ |

## 6. Recommendation
Phase 1.5 hardening is complete and proven on real Postgres. Before Phase 2 domain code: run the **Layer 2 live-Supabase isolation gate**, plus the carried-over env prerequisites (install + lockfile + CI green; provision + migrate/RLS/seed; OTP smoke; SDK surface). Then proceed to **Phase 2 — Orders foundation (ADR-0007)**.

> Ready for Phase 2 when the user gives the command: **START BORDERPASS PHASE 2**
