# Phase 2 Readiness Checklist

**Phase 2 focus (per Master Build Package):** first domain slice — Orders foundation (entities + New Request draft→submit + durable workflow skeleton + admin order list), still no payments/AI-production.

## Must do before / at Phase 2 start
- [ ] Run real `pnpm install`; commit `pnpm-lock.yaml`; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- [ ] Confirm CI pipeline green end-to-end on a real PR; pin actions by SHA; protect `main`
- [ ] Provision a Supabase project (local + dev); set `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- [ ] `db:generate` → review SQL → `db:migrate` → apply `src/rls/policies.sql` → `db:seed`
- [ ] Smoke-test the email-OTP round trip (login → callback → session → `(customer)` guard)
- [ ] Confirm `@maralito/sdk` Identity/Audit surface with platform team; decide adapter vs sync (ADR-0005)
- [ ] Choose KMS provider; wire field-encryption before storing RFC/KYC PII
- [ ] Decide Supabase preview-branching vs ephemeral schemas for CI

## Carry-over from Phase 0/1 (non-blocking)
- [ ] Cross-folder doc link-fix pass (post-relocation)
- [ ] semgrep ruleset tuning; `.env.example` optional-var tags
- [ ] Replace `newId` with a real ULID library

## Phase 2 entry gates
- [ ] **Cross-tenant RLS isolation test fails closed** (blocking in CI) — author with the first domain tables
- [ ] Order status mutated **only** via the durable workflow (no ad-hoc status writes)
- [ ] Every sensitive action audited; PII reads logged
- [ ] Money as integer minor units; enums per `contracts/04`

## Foundation Phase 2 can rely on (delivered in Phase 1)
RBAC helpers + guards, `getAppSession`, 3 Supabase clients, Drizzle client + migration flow + RLS pattern, Zod schema patterns + `withAction`-style validation, `writeAudit` + redaction, typed errors, dev seed.

---

## Phase 1.5 update — what's now resolved vs still gating

**Resolved in Phase 1.5 (code + real-Postgres tests):**
- ✅ RLS-aware server access (`withTenant`/`withServiceRole`, ADR-0006) — RLS now enforced on the BFF path
- ✅ Foundation indexes + `user_roles` unique(auth_user_id, org_id, role_key)
- ✅ Cross-tenant RLS isolation test (9 scenarios) — runs in CI via PGlite (Layer 1)
- ✅ Audit wiring: role assign/remove, access.denied, auth signin/signout, super_admin bootstrap
- ✅ Docs corrected (no "double enforcement already active" overstatement)
- ✅ `@maralito/sdk` Phase 2 type surface confirmed (interfaces only)

**Still BLOCKING before Phase 2 domain code:**
- [ ] **Layer 2 live-Supabase RLS gate** (`rls-testing.md`): apply real `policies.sql`, confirm `set local role authenticated` works on the pooler (`canAssumeAuthenticatedRole`), run a live two-user isolation smoke
- [ ] Real `pnpm install` + commit `pnpm-lock.yaml` + CI green on a real PR
- [ ] Supabase provision + `db:generate`/`db:migrate` + apply policies + `db:seed`
- [ ] OTP sign-up/sign-in round-trip smoke
- [ ] Confirm `@maralito/sdk` runtime surface with platform team (adapter vs sync, ADR-0005)
- [ ] KMS provider chosen before storing RFC/KYC PII

**Phase 2 (Orders foundation) note:** its ADR is **0007**; new domain tables ship their own RLS policies and **extend** `rls.isolation.test.ts` (the isolation gate grows with each tenant table).
