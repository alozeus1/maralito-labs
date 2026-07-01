# Phase 7 — Live-Gate Hardening + Real Environment Validation — Completion Report

> **Status:** ✅ TOOLING COMPLETE (dev-only) · **All operator-run live gates remain UNRUN** · **Date:** 2026-06-30 · ADR-0013

## 1. What Phase 7 is (and is not)
Phase 7 hardens and automates the live release gates so an operator can run them repeatably. It **does not**
execute those gates in the dev sandbox and **does not** mark any as passed. The gate results are produced by a
human operator in a real environment and recorded in `docs/phase-7/gate-ledger.md`.

## 2. Increments
| # | Increment | Status |
|---|-----------|--------|
| 7.1 | Consolidated non-destructive live-RLS-gate (all 7 policy files) + `pnpm gate:rls` | ✅ tooling |
| 7.2 | Preflight script + secret-gated `live-gates` CI workflow | ✅ tooling |
| 7.3 | Stripe test-mode smoke script + API-version validation + runbook | ✅ tooling |
| 7.4 | Env/secrets review + KMS + preview-branching decision records + deployment checklist | ✅ templates |
| 7.5 | ADR-0013 + docs/phase-7/* + gate ledger + current-build-state + this report | ✅ docs |

## 3. Files created/modified
- `packages/db/scripts/live-rls-gate.ts` (rewritten, non-destructive, all domains) + `packages/db/package.json` (`gate:rls`).
- `scripts/preflight.mjs` + root `package.json` (`preflight`, `gate:rls`).
- `.github/workflows/live-gates.yml` (manual, secret-gated).
- `packages/payments/scripts/stripe-smoke.mjs` + `packages/payments/package.json` (`stripe:smoke`).
- `docs/phase-7/`: `stripe-test-mode-runbook.md`, `env-secrets-review.md`, `decision-kms.md`,
  `decision-preview-branching.md`, `deployment-readiness-checklist.md`, `live-gate-runbook.md`,
  `gate-ledger.md`, this report. `docs/decisions/adr/0013-*.md`. Updated `docs/current-build-state.md`.

## 4. Scripts / runbooks added
- `pnpm gate:rls` — live two-user cross-domain RLS isolation (orders/quotes/payments/inspections/delivery/notifications), non-destructive.
- `pnpm preflight` — local gates + operator checklist.
- `pnpm --filter @maralito/payments stripe:smoke` — offline Stripe checks (TEST-mode, API version, signature verify/tamper).
- `.github/workflows/live-gates.yml` — operator CI (secret-gated; hard-fails without `DATABASE_URL`).
- Runbooks: live-gate execution, Stripe test-mode; decision records: KMS, preview-branching; checklists: env/secrets, deployment.

## 5. Checks run LOCALLY (sandbox-equivalent; nothing live contacted)
- `gate:rls` isolation logic: **10/10 on real Postgres (PGlite), all 7 real policy files** — A-only across all
  domains, staff org read, history staff-only, payment write-deny, anon → 0.
- `preflight`: local gates PASS; operator checklist printed (all `[ ]`).
- `stripe-smoke`: **5/5 offline** with dummy TEST env (keys/TEST-mode/API-version/signature/tamper); **refuses `sk_live_`**.
- `check:db-imports` + `check:client-stripe` green; `packages/db` + `packages/validation` typechecks green.

## 6. What remains OPERATOR-ONLY (unrun)
Everything in `docs/phase-7/gate-ledger.md` (19 rows) — real `pnpm install`/lockfile, full build/typecheck/Vitest,
CI green, live Supabase provisioning + migrations + all RLS + seed, **live `gate:rls`**, OTP smoke, Stripe
test-mode live round-trip + API-version + live validation, KMS decision, preview-branching decision, env/secrets
review, deployment sign-off. **None are checked.**

## 7. Sandbox limitation (restated)
Vitest cannot launch in this sandbox (arch-mismatched Rollup native binding); the full Vitest suite + Next build
+ app-server typecheck must run in the real environment. All Phase 7 tooling was verified via the equivalent
Node/PGlite/offline harnesses.

## 8. Recommendation
Phase 7 tooling is complete. **An operator must now execute the live gates** (per `live-gate-runbook.md`) and
record results in the ledger. Only after every required gate is green + owner-signed may staging/pilot readiness
be considered. Development-only until then.

> No live gate has been run or marked passed. BorderPass remains development-only.
