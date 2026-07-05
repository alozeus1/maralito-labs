# Phase 7 — Env / Secrets Review Checklist

> ADR-0013 · operator checklist. **No secrets are committed.** `.env.example` holds names only.

## Required variables by surface
| Var | Scope | Surface | Notes |
|-----|-------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | client + server | browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | client + server | browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | server | never in client bundle |
| `DATABASE_URL` | **server-only** | server / migrations / `gate:rls` | Postgres connection |
| `STRIPE_SECRET_KEY` | **server-only** | server | `sk_test_…` until live validation |
| `STRIPE_WEBHOOK_SECRET` | **server-only** | server | `whsec_…` from `stripe listen` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | client | `pk_test_…` |
| `STRIPE_API_VERSION` | optional | server | leave unset to use pinned default |
| `STRIPE_PAYMENT_CURRENCY` | optional | server | `usd`/`mxn` |
| `BORDERPASS_ENV` | server | server | `local`/`preview`/`staging`/`production` |

## Review checklist (operator)
- [ ] All server-only secrets are set as **secrets** (not `NEXT_PUBLIC_`), and none appear in any client bundle.
- [ ] `check:client-stripe` passes (no server Stripe surface in client code).
- [ ] `.env.example` lists every required var by name (no values). Verified by `pnpm preflight`.
- [ ] Secrets are stored in the platform secret manager (Vercel/Supabase/GitHub Actions), not in the repo.
- [ ] Rotation policy defined for `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`.
- [ ] Least-privilege DB role for `DATABASE_URL` where feasible; `gate:rls` requires an owner-capable role.
- [ ] No secrets in logs (redaction enforced) and no secrets echoed by scripts (verified in Phase 4).

## Review performed — 2026-07-01

Findings (evidence from repo + CI PR #2 / run 28546256476):

- ✅ **No server-only secret exposed via `NEXT_PUBLIC_`** — scan of `apps/**` + `packages/**` found none; `check:client-stripe` guard green (no server Stripe surface in client code).
- ✅ **Client boundary + raw-DB guards green** — `check:client-stripe` + `check:db-imports` pass in CI.
- ✅ **`.env.example` completeness** — `preflight` confirms Supabase + Stripe + DB keys present by name.
- ✅ **No secret values tracked in git** — only `.env.example` + `apps/borderpass/.env.example` are tracked; `.env` / `.env.*` gitignored. CI `secret-scan` + Semgrep = **0 findings** on PR #2.
- ✅ **Server-only vs public classified** — service role, DB URL, Stripe secret, webhook secret are server-only; only `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are public.
- ✅ **Least-privilege DB note** — `gate:rls` requires an owner-capable role; app runtime uses `withTenant`/`withPrivilegedDbAccess`, never the service_role key.
- ⚠️ **OPEN ACTION — rotate exposed dev secrets.** The dev-gate `service_role` key + DB password were exposed in an operator chat and rotation was **deferred by the owner**. Acceptable ONLY for this disposable synthetic dev-gate project; **must be rotated before any non-dev use, real PII, or real payments.** Rotation owner: Godwill. Tracked here + in `decision-kms.md`.

## REQUIRED BEFORE PRIVATE TESTERS
Rotate exposed Supabase `service_role` / secret key and database password, update the secrets manager and CI/Vercel
secrets, then record evidence in `gate-ledger.md` Row 18. Until this is done, **no tester may touch the environment.**
Do **not** mark Row 18 fully closed until rotation is actually completed + recorded.

## Status
🟡 **REVIEW RECORDED — 2026-07-01 (dev-only) — but the gate is NOT closed.**
Gate row 18 in `docs/phase-7/gate-ledger.md` = 🟡 **PARTIAL**: the review itself is performed + documented, but the
exposed `service_role`/secret key + DB password **rotation remains REQUIRED BEFORE PRIVATE TESTERS** (see the
section above). Do not treat Row 18 as closed, and do not admit any tester, until rotation evidence is recorded.
