# Phase 7 — Deployment Environment Readiness Checklist

> ADR-0013 · operator checklist. Items are checked as executed + recorded in `gate-ledger.md`.
> **Scope of the checked items below = the SYNTHETIC private mobile tester round only.** No
> staging/pilot/production/real-payment/real-PII readiness is claimed (those need separate, higher gates).

## Build / CI
- [x] Real `pnpm install` completes; `pnpm-lock.yaml` committed
- [x] `pnpm typecheck` (full workspace) green
- [x] `pnpm build` (Next app) green
- [x] `pnpm test` (full Vitest suite) green
- [x] Normal PR CI green (lint, format, guards, tests, build)

## Database / RLS
- [x] Live Supabase project provisioned
- [x] Migrations applied to live Supabase
- [x] All RLS policies applied: foundation · orders · quotes · payments · notifications · inspections · delivery-preparations
- [x] Dev seed applied (org + roles) as required by the gate
- [x] `pnpm gate:rls` prints ALL PASS on the live project (two-user cross-domain isolation)

## Auth
- [x] OTP → provisioning → session live smoke passes — **Row 11 ✅ 2026-07-08** (`run-logs/otp-smoke-20260708T045425Z.md`)

## Payments
- [x] Stripe TEST-mode smoke passes (`docs/phase-7/stripe-test-mode-runbook.md`)
- [x] Stripe API version validated against the account
- [ ] Stripe LIVE validation approved (separate, before any real charge) — **deferred (Row 15); not required for synthetic tester round**

## Security / secrets
- [x] Env/secrets review complete (`docs/phase-7/env-secrets-review.md`)
- [x] Exposed dev secrets rotated (DB password + JWT signing key) + propagated to app/.env.local/Vercel — **2026-07-08**
- [x] KMS/secret-management decision recorded (`docs/phase-7/decision-kms.md`)
- [x] Preview-branching decision recorded (`docs/phase-7/decision-preview-branching.md`)

## Sign-off — SYNTHETIC PRIVATE MOBILE TESTER ROUND
- [x] All required tester-round gates green + recorded in `docs/phase-7/gate-ledger.md` (rows 1–14, 16–18; row 15 deferred)
- [x] **Owner sign-off: ACTIVATED.** Owner's conditional **Option B** (2026-07-05, `owner-signoff-packet.md`) was
      "effective only after Row 11 passes with evidence and Row 18's rotation closes." Both are now satisfied
      (2026-07-08), so the approval is **in effect** for the synthetic private mobile tester round.

## Still required BEFORE staging / pilot / real data (separate, higher bar — NOT this round)
- [ ] Owner sign-off for staging/pilot: _____________________ (date)
- [ ] Stripe LIVE validation (Row 15) for any real charge
- [ ] KMS envelope encryption implemented before any real PII/address/RFC/KYC/document

> This checklist authorizes a **synthetic-only** private mobile tester round on the controlled HTTPS preview.
> BorderPass remains **development-only** — no real PII, no live payments, no public launch.
