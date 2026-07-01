# Phase 2 Readiness Checklist (post Phase 1.6)

**Phase 2 = Orders foundation (ADR-0008):** order entities + New Request draft→submit + durable workflow skeleton + admin order list. No payments/AI-production.

## Resolved in Phase 1.6 (code + real-Postgres tests)
- ✅ New-user provisioning (identity + customer role + profile), idempotent + audited
- ✅ RLS test applies the **real** `policies.sql` (9 scenarios)
- ✅ `withPrivilegedDbAccess` naming/docs; `withServiceRole` deprecated alias
- ✅ Raw DB client guarded (rename + ESLint + `check:db-imports` CI scan)
- ✅ Wrappers own the client (app holds no raw client)
- ✅ ADR-0007; orders ADR renumbered to **0008**

## BLOCKING before Phase 2 domain code
- [ ] **Live Supabase RLS gate** — all 15 checks green on a real project (`live-supabase-rls-gate.md`); if `SET LOCAL ROLE authenticated` fails on the pooler, apply the fallback (A→B→C/D) and re-run
- [ ] Real `pnpm install` + commit `pnpm-lock.yaml`
- [ ] CI green on a real PR (incl. `check:db-imports`, RLS + provisioning tests)
- [ ] Supabase provision + `db:migrate` + apply `policies.sql` + `db:seed` (incl. the shared customer org row)
- [ ] OTP sign-up/sign-in round-trip → provisioning → `getAppSession` resolves → customer guard passes (live)
- [ ] Confirm `@maralito/sdk` runtime surface with platform team (adapter vs sync)
- [ ] KMS provider chosen (before storing RFC/KYC PII)
- [ ] Preview-branching strategy documented (Supabase branches vs ephemeral schemas)
- [ ] Env vars verified (incl. `BORDERPASS_DEFAULT_CUSTOMER_ORG_ID`)

## Phase 2 entry gates (carried)
- [ ] New order/domain tables ship their own RLS policies + **extend** `rls.isolation.test.ts`
- [ ] Order status mutated only via the durable workflow
- [ ] Every sensitive action audited; PII reads logged; `permission.denied` wired at action sites
- [ ] Money = integer minor units; enums per `contracts/04`

## Foundation Phase 2 can rely on
`withTenant` (RLS-enforced) + `withPrivilegedDbAccess` (audited) + provisioning + RBAC guards + `getAppSession` + Zod schemas + `writeAudit`/redaction + raw-client guard + real-policy RLS test harness.
