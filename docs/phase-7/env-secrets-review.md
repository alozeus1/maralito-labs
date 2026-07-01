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

## Status
🔲 **Not reviewed in a real environment.** This checklist is a template; an operator completes it and records the outcome in `docs/phase-7/gate-ledger.md`.
