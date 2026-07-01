# Phase 7 — Live-Gate Execution Runbook

> ADR-0013 · **operator-run in a real environment.** Nothing here is executed by Claude in the dev sandbox.
> Record each result in `docs/phase-7/gate-ledger.md` (unchecked until actually passed).

## 0. Prerequisites
- A machine with network access, Node 22 (repo engine: `>=22 <23`), pnpm, and the Stripe CLI.
- A Supabase project (or branch) you control; a Stripe **test** account.
- Secrets configured (see `env-secrets-review.md`) — never commit them.

## 1. Build / test (real toolchain)
```
pnpm install                 # commit the resulting pnpm-lock.yaml
pnpm typecheck               # full workspace app-server typecheck
pnpm test                    # full Vitest suite (resolves the sandbox Rollup limitation)
pnpm build                   # Next app build
pnpm preflight               # local guards + checklist
```

## 1b. Baseline migration (ONE-TIME — offline, no DB, no secrets)
`packages/db/migrations/` ships empty. Before any live DB step, generate a baseline migration from the
committed schema, **review the SQL**, and commit it. This needs no database connection.
```
pnpm --filter @maralito/db db:generate        # writes packages/db/migrations/*.sql from ./src/schema
git add packages/db/migrations && git diff --cached   # REVIEW every CREATE TABLE / index before committing
git commit -m "chore(db): baseline migration for phase 7 live gates"
```
Success signal: at least one `*.sql` migration + a `meta/` journal exist under `packages/db/migrations/`.
Do not point `db:migrate` at the live project until this migration is committed. (`scripts/phase7-local-run.sh`
generates this automatically on its first pass and stops for your review.)

## 2. Database + RLS
```
export DATABASE_URL=postgres://...            # DIRECT/SESSION (5432) connection, owner-capable role; %-encode password
pnpm --filter @maralito/db db:migrate         # apply the committed baseline migration
# apply ALL 7 policy files IN ORDER (foundation first) — e.g. psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>:
#   1 policies.sql  2 orders-  3 quotes-  4 payments-  5 notifications-  6 inspections-  7 delivery-preparations-policies.sql
pnpm --filter @maralito/db db:seed            # synthetic org + roles (no PII)
pnpm gate:rls                                 # two-user cross-domain isolation → expect "N passed, 0 failed" (exit 0)
```
`gate:rls` is non-destructive (seeds inside a transaction and rolls back) and prints `N passed, 0 failed`
(not the literal "ALL PASS"). Use the DIRECT/SESSION (5432) URL for migrate + gate; confirm `SET LOCAL ROLE
authenticated` works — if the pooler blocks it, use the direct connection or apply the ADR-0006 fallback
inside `withTenant`. `scripts/phase7-local-run.sh --apply-db` runs this whole section in the correct order.

## 3. Auth (OTP)
- Sign up with a real email → receive OTP → complete sign-in → confirm provisioning (identity + customer role +
  baseline profile) created idempotently, and a session is established.

## 4. Payments (Stripe TEST mode)
- Follow `docs/phase-7/stripe-test-mode-runbook.md` (offline pre-check + live CLI round-trip).

## 5. Security / decisions
- Complete `env-secrets-review.md`, `decision-kms.md`, `decision-preview-branching.md`.

## 6. CI
- Run the normal PR CI (must be green) and the `live-gates` workflow (manual) with secrets configured.

## 7. Record
- Update `docs/phase-7/gate-ledger.md` — tick a gate ONLY after it actually passed. Get owner sign-off in
  `deployment-readiness-checklist.md` before any staging/pilot use.
