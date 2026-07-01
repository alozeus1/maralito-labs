# Phase 1.6 — Live Supabase RLS Gate (runbook)

> **Status: NOT RUN.** No Supabase/external Postgres in the build sandbox. This gate **must pass on a real Supabase project before Phase 2**. Do not claim readiness until it does.

## Prereqs (env vars)
`DATABASE_URL` (Supabase; try the **direct/non-pooled** connection first), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEV_ORG_ID`/`BORDERPASS_DEFAULT_CUSTOMER_ORG_ID`.

## Commands
```bash
# 1. provision schema + policies + seed
pnpm --filter @maralito/db db:generate
pnpm --filter @maralito/db db:migrate
psql "$DATABASE_URL" -f packages/db/src/rls/policies.sql
pnpm --filter @maralito/db db:seed

# 2. run the gate (probes role/claims + duplicate constraint; finish data-isolation per below)
pnpm --filter @maralito/db tsx scripts/live-rls-gate.ts
```

## 15 checks
| # | Check | Expected | Actual | Pass/Fail | Blocks P2 |
|---|-------|----------|--------|:---------:|:---------:|
| 1 | DATABASE_URL connects | `1` | NOT RUN | PENDING | Yes |
| 2 | migrations apply | clean | NOT RUN | PENDING | Yes |
| 3 | policies apply | clean | NOT RUN | PENDING | Yes |
| 4 | seed runs | ok | NOT RUN | PENDING | Yes |
| 5 | `canAssumeAuthenticatedRole()` | true | NOT RUN | PENDING | Yes (drives fallback) |
| 6 | `SET LOCAL ROLE authenticated` in tx | ok | NOT RUN | PENDING | Yes |
| 7 | claims set + read by `auth.uid()` | sub | NOT RUN | PENDING | Yes |
| 8 | A cannot read B | only A | NOT RUN | PENDING | Yes |
| 9 | customer ≠ staff | 0 | NOT RUN | PENDING | Yes |
| 10 | non-admin ≠ audit | 0 | NOT RUN | PENDING | Yes |
| 11 | missing claims denied | 0 | NOT RUN | PENDING | Yes |
| 12 | missing org denied | 0 | NOT RUN | PENDING | Yes |
| 13 | super-admin explicit | all | NOT RUN | PENDING | Yes |
| 14 | privileged bypass only via audited path | ok + audit | NOT RUN | PENDING | Yes |
| 15 | duplicate user_roles rejected | unique violation | NOT RUN | PENDING | Yes |

## If check 5/6 FAILS (pooler can't `SET LOCAL ROLE`)
Apply the fallback in order (ADR-0006 / 0007), **inside `withTenant` only** (no domain change):
- **A — direct (non-pooled, :5432) connection** for RLS-sensitive ops. *(try first)*
- **B — claims-only** on a verified **non-BYPASSRLS** role (add a startup assertion that the base role does not bypass RLS).
- **C/D — route tenant reads/writes through the Supabase server client** (PostREST preserves the JWT → native RLS); Drizzle stays for schema/migrations.

Re-run all 15 checks after applying the fallback. **Phase 2 stays blocked until one strategy passes.**
