# Phase 2 — Release Gate Checklist (BLOCKING before staging/prod/pilot/real-PII)

> Phase 2 is DEV-ONLY. Every item below is **PENDING** and must pass before any non-dev release or any
> handling of real customer PII. Do not claim deployment readiness until all are ✅.

- [ ] **Live Supabase provisioned** (project + env values)
- [ ] **Migrations applied** (`db:generate`/`db:migrate`) incl. orders + order_items
- [ ] **RLS policies applied** (`policies.sql` + `orders-policies.sql`)
- [ ] **Seed completed** (shared customer org + roles)
- [ ] **Live RLS isolation gate passed** (`scripts/live-rls-gate.ts` + order isolation; incl. `SET LOCAL ROLE authenticated` or fallback)
- [ ] **OTP provisioning smoke test passed** (signup → provision → getAppSession → customer guard)
- [ ] **CI green** (typecheck, lint, `check:db-imports`, unit + PGlite RLS + provisioning + order tests, gitleaks/semgrep/osv/pnpm-audit)
- [ ] **Lockfile committed** (`pnpm-lock.yaml`)
- [ ] **KMS/secret-management confirmed** (before any RFC/KYC PII)
- [ ] **Preview branching confirmed** (Supabase branches vs ephemeral schemas)

**Current status: PENDING (no live environment).** See `docs/phase-1.6/live-supabase-rls-gate.md`.
