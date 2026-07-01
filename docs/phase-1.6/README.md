# Phase 1.6 — Auth-readiness hardening

Resolves the Phase 1.5 review blockers before Phase 2 (orders + PII).

| Fix | Status | Where |
|-----|--------|-------|
| New-user provisioning | ✅ | `provisionAuthenticatedUser` (callback) → `provisionUserCore` (idempotent) |
| Default customer role | ✅ | provisioning assigns `customer` in the shared customer org (ADR-0007) |
| Real `policies.sql` in RLS test | ✅ | `packages/db/tests/rls.isolation.test.ts` loads the real file |
| Live Supabase RLS gate | 🟡 script + runbook; **NOT RUN** (blocking) | `scripts/live-rls-gate.ts`, `live-supabase-rls-gate.md` |
| Privileged path clarity | ✅ | `withServiceRole`→`withPrivilegedDbAccess` (+alias) |
| Raw DB client guard | ✅ | `createRawDbClient` internal; ESLint + CI scan |

**Docs:** `new-user-provisioning.md` · `real-policy-test-hardening.md` · `live-supabase-rls-gate.md` · `privileged-db-access.md` · `raw-db-client-guard.md` · `phase-1.6-completion-report.md` · `phase-2-readiness-checklist.md` · ADR-0007.

**Tests (real Postgres):** provisioning 3 · RLS-with-real-policies 9 · (+ RBAC 6 · validation 6 · redaction 2).
