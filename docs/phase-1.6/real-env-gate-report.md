# BorderPass — Real-Environment Gate Report (pre-Phase 2)

> **Operator:** Principal Supabase Eng · DevSecOps · DB Security Reviewer · Auth Eng · Release Gate Operator · **Date:** 2026-06-29
> **Environment constraint (must read):** this run executes in a build sandbox with **no Supabase project, no real `DATABASE_URL`, no email/OTP provider, and no GitHub CI**. Web access is restricted; a Supabase project cannot be provisioned from here. Per the rule *"do not claim a check passed unless it actually ran,"* every gate requiring live infrastructure is reported **NOT RUN** with the exact command to run it. Only sandbox-runnable checks show real results.

---

## 1. Environment Gate Summary

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| 1 | pnpm install succeeds | 🟡 **PARTIAL (real)** | dependency graph **resolved** (`pnpm install --lockfile-only`, 814 pkgs, exit 0, 8.9s). Full link + `next build` not run. |
| 2 | lockfile committed | 🟡 **GENERATED, not committed** | real `pnpm-lock.yaml` (281 KB, 13 workspace projects) written; **no root git repo here** to commit it. |
| 3 | CI green | ❌ **NOT RUN** | CI runs on GitHub Actions, not in this sandbox. |
| 4 | Supabase provisioned | ❌ **NOT RUN** | no project / credentials available here. |
| 5 | migrations apply | ❌ **NOT RUN** | needs live `DATABASE_URL`. |
| 6 | RLS policies apply | ❌ **NOT RUN** | needs live DB. (Validated on PGlite — not Supabase.) |
| 7 | dev seed runs | ❌ **NOT RUN** | needs live DB. |
| 8 | OTP round-trip | ❌ **NOT RUN** | needs Supabase Auth + email. |
| 9 | provisioning creates identity+role+profile | 🟡 **PROVEN on PGlite, NOT on Supabase** | `provisioning.integration.test` (3) green on real embedded Postgres. |
| 10 | getAppSession after first sign-in | ❌ **NOT RUN (live)** | prerequisites proven (PGlite); full path needs live OTP. |
| 11 | customer guard after first sign-in | ❌ **NOT RUN (live)** | same. |
| 12 | live Supabase RLS isolation gate | ❌ **NOT RUN** | `scripts/live-rls-gate.ts` exists; needs Supabase. (Mechanism + real `policies.sql` proven on PGlite: 9/9.) |
| 13 | `@maralito/sdk` Phase 2 runtime surface | 🟡 **TYPES present; runtime unconfirmed** | interfaces (Identity/Audit/…) exist; platform-team confirmation pending. |
| 14 | KMS/secret-management decision | 🟡 **PROPOSED, needs sign-off** | recommendation below; not finalized. |
| 15 | preview-branching strategy | 🟡 **PROPOSED, needs sign-off** | recommendation below; not finalized. |
| 16 | env vars verified | ✅ **NAMES present (real)** | all required names in `.env.example`; **values not set** (operator step). |

**Net:** the **blocking live gates (3–8, 10–12) have NOT run** because the required infrastructure is unavailable in this environment.

## 2. Supabase Project Verification — ❌ NOT RUN
No project provisioned/reachable. Required: create a Supabase project (or use staging), set `DATABASE_URL` (try **direct/non-pooled :5432 first**), `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Migration Result — ❌ NOT RUN
`pnpm --filter @maralito/db db:generate && db:migrate` — run against the real `DATABASE_URL`.

## 4. RLS Policy Result — ❌ NOT RUN (live); ✅ real `policies.sql` valid on PGlite
`psql "$DATABASE_URL" -f packages/db/src/rls/policies.sql`. The **real policy file** is proven syntactically valid + enforcing under Postgres (PGlite test applies it; 9/9). Live application to Supabase still required.

## 5. Seed Result — ❌ NOT RUN
`pnpm --filter @maralito/db db:seed` (creates the shared customer org + roles + perms + optional super_admin).

## 6. OTP Smoke-Test Result — ❌ NOT RUN
Manual: sign up at `/sign-up` (email OTP) → click link → `/auth/callback` exchanges code → `provisionAuthenticatedUser` → land on `/`. Requires Supabase Auth + email.

## 7. New-User Provisioning Result — 🟡 PROVEN on real Postgres (PGlite), NOT on Supabase
`provisionUserCore` creates identity + `customer` role + baseline profile; **idempotent** on repeat. 3/3 tests green via the Drizzle PGlite driver. Live verification = the OTP smoke (gate 6).

## 8. getAppSession / Customer Guard Result — ❌ NOT RUN (live)
Prerequisite data (identity.orgId + customer role) is created by provisioning (proven). The full `getAppSession`→`requireCustomerAccess` path needs a live session (OTP).

## 9. Live RLS Isolation Gate Result — ❌ NOT RUN (Supabase)
15-check `scripts/live-rls-gate.ts` + runbook (`live-supabase-rls-gate.md`). On PGlite with the **real policies.sql**, the equivalent 9 scenarios pass (own-row, customer≠staff, non-admin≠audit, super-admin, missing-claims, missing-org, RLS backstop, privileged bypass, duplicate-role). **This is NOT a substitute for the live Supabase run.**

## 10. SET LOCAL ROLE Result — ❌ NOT RUN (Supabase)
`canAssumeAuthenticatedRole()` works on PGlite; **the Supabase pooler behavior is unverified** — this is the single most important live check.

## 11. Fallback Decision (if SET LOCAL ROLE fails on the pooler)
Pre-decided order, applied **inside `withTenant` only** (no domain change): **A — direct non-pooled :5432 connection** (try first) → **B — claims-only on a verified non-BYPASSRLS role** (+ startup assertion) → **C/D — route tenant ops via the Supabase auth-context client** (Drizzle stays for schema/migrations; privileged path for system ops). Re-run all 15 checks after applying.

## 12. CI Result — ❌ NOT RUN
GitHub Actions, not available here. Pipeline includes (Phase 1.5/1.6): typecheck, lint, format, **`check:db-imports`**, unit + PGlite RLS + provisioning tests, gitleaks/semgrep/osv/pnpm-audit. Run on a real PR.

## 13. Lockfile / Install Result — 🟡 PARTIAL (real)
`pnpm install --lockfile-only` **resolved 814 packages (exit 0)** and wrote `pnpm-lock.yaml` covering all 13 workspace projects. Remaining: full `pnpm install` (link) + `pnpm build` + commit the lockfile in git (no repo initialized here).

## 14. SDK Runtime Surface Confirmation — 🟡 TYPES ready, runtime pending
`@maralito/sdk` exposes the Phase 2 interfaces (`IdentityService`, `AuditService`, + placeholders). The **runtime** contract (adapter vs sync with the platform Identity/Audit services, ADR-0005) needs platform-team confirmation.

## 15. KMS / Secret-Management Decision — 🟡 PROPOSED (needs sign-off)
**Recommendation:** secrets in the host secret manager (Vercel/GitHub OIDC); **field encryption** for Restricted PII (RFC/KYC) via **Supabase Vault / `pgsodium`** *or* a cloud KMS (`MARALITO_KMS_PROVIDER`). Not required to store any PII in Phase 2's first slice, but must be **decided + documented before RFC/KYC columns land**. → needs team sign-off.

## 16. Preview-Branching Decision — 🟡 PROPOSED (needs sign-off)
**Recommendation:** use **Supabase branching** for per-PR preview DBs if available on the plan; otherwise **ephemeral per-PR schemas** seeded by CI. → needs DevSecOps sign-off + wiring into the preview CI job.

## 17. Env Var Verification — ✅ NAMES present (values pending)
All required names present in `.env.example`: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `BORDERPASS_ENV`, `BORDERPASS_DEFAULT_CUSTOMER_ORG_ID`, `INNGEST_SIGNING_KEY`, `MARALITO_KMS_PROVIDER`, `LANGGRAPH_GATEWAY_URL`, etc. **Real values are not set** (operator step; never committed).

## 18. Remaining Blockers
1. **No live Supabase** → gates 4–8, 10–12 (incl. the decisive `SET LOCAL ROLE`/live RLS) cannot run here.
2. **No GitHub CI / git repo** here → CI-green + lockfile-commit are operator steps.
3. **OTP** needs Supabase Auth + email.
4. **SDK runtime**, **KMS**, **preview-branching** need team decisions/sign-off.

## 19. Final Decision

### ❌ NOT READY FOR PHASE 2

**Reason:** the decisive real-environment gates — Supabase provisioning, live migrations/RLS/seed, the **live RLS isolation gate** (including whether the pooler permits `SET LOCAL ROLE authenticated`), the OTP→provisioning→session round-trip, and CI-green with a committed lockfile — **have not run, because the required live infrastructure is not available in this sandbox.** I will not declare readiness on unverified live behavior.

**Exact fixes required before Phase 2 (operator with Supabase + CI access):**
1. Provision Supabase (staging/preview); set env values.
2. `pnpm install` (full) + commit `pnpm-lock.yaml`; open a PR and confirm **CI green** (incl. `check:db-imports`, RLS + provisioning tests).
3. `db:migrate` → apply `policies.sql` → `db:seed`.
4. Run **`pnpm --filter @maralito/db tsx scripts/live-rls-gate.ts`** → all 15 checks PASS. If `SET LOCAL ROLE authenticated` fails, apply the §11 fallback and re-run.
5. Manual **OTP round-trip** → verify identity+role+profile provisioned, `getAppSession` resolves, customer guard passes.
6. Confirm `@maralito/sdk` runtime surface; finalize **KMS** + **preview-branching** decisions.

When all of the above are green, re-run this gate report; only then does it end with **PHASE 2 READY**.

---

*Real results in this run: dependency graph resolved + lockfile generated (814 pkgs); env-var names verified; provisioning (3) + RLS-with-real-`policies.sql` (9) green on real embedded Postgres. Everything requiring live Supabase/OTP/CI is NOT RUN and clearly marked.*
