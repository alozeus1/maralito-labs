# Phase 7 — Deployment Environment Readiness Checklist

> ADR-0013 · operator checklist. **Every item is UNCHECKED until executed + recorded for real.** No
> staging/pilot/production/real-payment/real-PII readiness may be claimed until all pass.

## Build / CI
- [ ] Real `pnpm install` completes; `pnpm-lock.yaml` committed
- [ ] `pnpm typecheck` (full workspace) green
- [ ] `pnpm build` (Next app) green
- [ ] `pnpm test` (full Vitest suite) green
- [ ] Normal PR CI green (lint, format, guards, tests, build)

## Database / RLS
- [ ] Live Supabase project provisioned
- [ ] Migrations applied to live Supabase
- [ ] All RLS policies applied: foundation · orders · quotes · payments · notifications · inspections · delivery-preparations
- [ ] Dev seed applied (org + roles) as required by the gate
- [ ] `pnpm gate:rls` prints ALL PASS on the live project (two-user cross-domain isolation)

## Auth
- [ ] OTP → provisioning → session live smoke passes

## Payments
- [ ] Stripe TEST-mode smoke passes (`docs/phase-7/stripe-test-mode-runbook.md`)
- [ ] Stripe API version validated against the account
- [ ] Stripe LIVE validation approved (separate, before any real charge)

## Security / secrets
- [ ] Env/secrets review complete (`docs/phase-7/env-secrets-review.md`)
- [ ] KMS/secret-management decision recorded (`docs/phase-7/decision-kms.md`)
- [ ] Preview-branching decision recorded (`docs/phase-7/decision-preview-branching.md`)

## Sign-off
- [ ] All of the above green + recorded in `docs/phase-7/gate-ledger.md`
- [ ] Owner sign-off for staging/pilot: _____________________ (date)

> Until sign-off, BorderPass remains **development-only**.
