# Phase 1 Readiness Checklist (Database, Auth, RBAC)

**Phase 1 goal:** Drizzle schema + RLS + Supabase Auth (phone OTP) + RBAC, all isolation-tested.

## Must confirm before starting Phase 1
- [ ] `@maralito/sdk` method surface + exact env-var names confirmed with platform team (Gap #3)
- [ ] Supabase **preview-branching vs ephemeral schemas** decided + wired into CI (Gap #7)
- [ ] **KMS provider** for Restricted-field encryption chosen (`MARALITO_KMS_PROVIDER`)
- [ ] `pnpm install` run in a real env; **`pnpm-lock.yaml` committed**; CI green end-to-end
- [ ] CI actions pinned by SHA; `main` branch protection on

## Phase 1 build (from Master Build Package / Pre-Build P6–P7)
- [ ] Drizzle schema for 18 BorderPass entities (migrations M0–M11), enums per `contracts/04`
- [ ] **RLS policy on every table** (`org_id` + owner), shipped in the same migration
- [ ] KMS field encryption for Restricted 🔒 fields; permission-gated decrypt + audited
- [ ] Supabase Auth phone OTP (start/verify); session → `org_id`; profile init
- [ ] RBAC `can(role, action, ctx)`; MFA for admin/finance/compliance; elevation rules
- [ ] BFF `withAction({ permission, schema, audit })` wrapper; tenant-context setter
- [ ] Audit emit scaffold (sensitive ops auto-audited)

## Phase 1 exit gate
- [ ] **Cross-tenant isolation test fails closed** (blocking in CI)
- [ ] Unauthorized → `not_found`; OTP onboarding e2e green
- [ ] Migration check runs on a Supabase branch in CI
