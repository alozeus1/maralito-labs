# Phase 7 — Live Gate Ledger

> ADR-0013 · **Single source of truth for gate status.** A box is ticked **only** after the gate was actually
> executed and passed in the real environment. As of this document, **ALL live gates are UNRUN** — none may
> be reported as passed. Development-only until every required gate below is checked + owner-signed.

| # | Gate | How to run | Status | Run by / date | Evidence |
|---|------|------------|--------|---------------|----------|
| 1 | Real `pnpm install` + committed lockfile | `pnpm install` | ✅ PASS (operator-attested) | operator / 2026-07-01 | Pass 2: `pnpm install --frozen-lockfile` PASS → committed lockfile present & consistent. |
| 2 | Full app-server typecheck | `pnpm typecheck` | ✅ PASS (operator-attested) | operator / 2026-07-01 | Pass 2: workspace typecheck PASS. |
| 3 | Full Next app build | `pnpm build` | ✅ PASS (operator-attested) | operator / 2026-07-01 | Pass 2: Next.js build PASS. |
| 4 | Full Vitest suite | `pnpm test` | ✅ PASS (operator-attested) | operator / 2026-07-01 | Pass 2: Vitest PASS (real toolchain; resolves the sandbox Rollup limitation). |
| 5 | Normal PR CI green | GitHub Actions `ci.yml` | ✅ PASS | operator / 2026-07-01 | PR [#2](https://github.com/alozeus1/maralito-labs/pull/2), main `f7cd5a5`, [run 28546256476](https://github.com/alozeus1/maralito-labs/actions/runs/28546256476). Green: quality, deps, SAST, secret-scan, Semgrep (0 findings), pnpm audit / OSV (0 vulns), tests, build. Non-blocking: Node20 action-deprecation warnings (checkout/gitleaks) — tracked for cleanup. |
| 6 | Live Supabase provisioned | operator | ✅ PASS (connection-verified) | operator / 2026-07-01 | Project `borderpass-dev-gate`, ref `rupqejwzmwfspvbmkmai`, us-east-2. Reachability confirmed: `select 1` returned 1 row (session pooler 5432). |
| 7 | Migrations applied (live) | `db:migrate` | ✅ PASS | operator / 2026-07-01 | Pass 2: 1 migration applied (`0000_nebulous_black_widow`). |
| 8 | All 7 RLS policies applied (live) | apply `rls/*.sql` | ✅ PASS | operator / 2026-07-01 | Pass 2: all 7 policy files applied → 48 policies, RLS enabled on 26 tables. Required grant fix committed `e741a41` (least-privilege grants to `authenticated` only; no anon/public). |
| 9 | Seed applied (live) | `db:seed` | ✅ PASS | operator / 2026-07-01 | Pass 2: 9 roles + 1 synthetic org. No PII. |
| 10 | Live two-user RLS isolation gate | `pnpm gate:rls` → `N passed, 0 failed` | ✅ PASS | operator / 2026-07-01 | Pass 2: `gate:rls` = **13 passed, 0 failed**; non-destructive rollback verified (`leaked_gate_org=0`). Cross-domain isolation + staff read + history staff-only + payment write-deny + anon→0, on live Supabase. |
| 11 | OTP → provisioning → session smoke | operator | 🔲 UNRUN | | |
| 12 | Stripe TEST-mode smoke (offline pre-check) | `stripe:smoke` | 🔲 UNRUN | | |
| 13 | Stripe TEST-mode live round-trip | Stripe CLI (runbook) | 🔲 UNRUN | | |
| 14 | Stripe API-version validation | dashboard vs pinned | 🔲 UNRUN | | |
| 15 | Stripe LIVE validation (before real payments) | operator | 🔲 UNRUN | | |
| 16 | KMS / secret-management decision | `decision-kms.md` | ✅ PASS (owner-signed) | Godwill / 2026-07-01 | Ratified: managed secrets dev-only; **Cloud KMS envelope encryption required before any real PII/RFC/KYC/address**. Decision recorded; implementation is a future increment. |
| 17 | Preview-branching decision | `decision-preview-branching.md` | ✅ PASS (owner-signed) | Godwill / 2026-07-01 | Ratified: **defer** preview branching (Option C) until row 18 + isolation-model choice. No real PII in previews. |
| 18 | Env/secrets review | `env-secrets-review.md` | ✅ PASS (dev-only; 1 open action) | Godwill / 2026-07-01 | Review performed: guards green, no server secret in `NEXT_PUBLIC_`, `.env*` gitignored, CI secret-scan + Semgrep 0 findings. **Open action: rotate exposed dev secrets before any non-dev/real-PII/real-payment use.** |
| 19 | Deployment readiness sign-off | `deployment-readiness-checklist.md` | 🔲 UNRUN | | |

**Rule:** do not claim staging/pilot/production/real-payment/real-PII readiness while any required box is 🔲.
Locally-verifiable *tooling* for these gates is built and tested (see the completion report), but the gates
themselves are unrun.

---

## Execution-attempt log

### 2026-07-01T05:30Z — agent terminal session (development-only; BLOCKED)
- **Local preflight** (`node scripts/preflight.mjs`): **PASS** (exit 0). Local-only gate — asserts guards + all 7 policy files present + gate script present. Does **not** satisfy any live ledger row.
- **Row 6 (Supabase provisioned):** marked ✅ on operator-attested evidence above.
- **Rows 1–5, 7–11: NOT RUN — blocked in this environment. Reasons:**
  1. **No secrets present** — no `DATABASE_URL`/`.env.local` in the agent environment (correctly kept in the operator's local secrets manager). No live DB connection is possible here, so `db:migrate`, RLS apply, and `gate:rls` (rows 7, 8, 10) cannot execute. Secrets were **not** fabricated.
  2. **No committed migrations** — `packages/db/migrations/` is empty (no `meta/` journal). `db:migrate` has nothing to apply and the live project would have no tables, so RLS/`gate:rls` cannot pass until a baseline migration is generated, reviewed, and committed in development. **Repo-level blocker, independent of secrets.**
  3. **Not a git worktree here** — the agent's mounted copy has no `.git`; `git status`, lockfile diffing, and commits (rows 1, 5) must be done on the operator's machine.
  4. **Node version mismatch** — root engine requires Node 22; the runbook and `.github/workflows/live-gates.yml` still specify Node 20. Correct before trusting CI evidence.
- **OTP smoke (row 11):** additionally blocked by the Supabase Auth redirect-URL save failure (active platform incident) — left UNRUN by instruction.
- No gate other than row 6 was modified. BorderPass remains **development-only**.

### 2026-07-01T~later — baseline-migration generation attempt (stop-condition #1; BLOCKED)
- **Goal:** generate the baseline Drizzle migration offline (no DB, no secrets) to unblock rows 7/8/10.
- **Command:** `drizzle-kit generate --name=phase7_baseline` (DATABASE_URL empty; offline).
- **Result: NO migration produced.** The agent sandbox is Linux but the mounted `node_modules` ships the macOS `esbuild` binary (`@esbuild/darwin-arm64` present; `@esbuild/linux-arm64` required). drizzle-kit could not transpile the TS config/schema. Same arch-mismatch class as the Vitest/Rollup limitation. `packages/db/migrations/` remains empty.
- **Not worked around:** binaries were **not** swapped in the mounted node_modules (would corrupt the operator's macOS install), and SQL was **not** hand-authored (a valid baseline needs the drizzle-generated `meta/_journal.json` snapshot).
- **Action required:** run generation on the operator's macOS machine — `bash scripts/phase7-local-run.sh` (Pass 1) or `pnpm --filter @maralito/db db:generate` — then REVIEW + commit. No gate ticked.

### 2026-07-01 — baseline migration generated + REVIEWED (stop-condition #1 CLEARED)
- **Operator (macOS):** Pass 1 install/typecheck/test/build + `db:generate` passed. Committed `a7ab335`, pushed to `origin/main`.
- **Artifact:** `packages/db/migrations/0000_nebulous_black_widow.sql` (+ `meta/_journal.json`, single entry `idx 0`, `breakpoints: true`).
- **Agent review (static, no DB):** 26 tables, 44 FK constraints (all appended AFTER table creation = safe ordering; explicit `ON DELETE/UPDATE no action`), 55 indexes, 81 `IF NOT EXISTS`, 124 statement breakpoints. **0 destructive statements** (no DROP/DELETE/TRUNCATE/ALTER…DROP), **0 RLS/policy statements** (correct — RLS applied separately from `src/rls/*.sql`), **0 INSERT/seed**, **0 enums/CHECK** (text columns + app-level state machines, per architecture).
- **RLS ↔ schema cross-check:** the 26 tables targeted by the 7 policy files == the 26 tables created (1:1, no orphan policy target). All 12 `gate:rls` seed tables present.
- **Verdict: APPROVED** for application to the disposable `borderpass-dev-gate` project. **Migration NOT yet applied** — awaiting explicit operator approval for Pass 2 (`--apply-db`). Rows 7/8/9/10 remain 🔲 UNRUN.

### 2026-07-01 — offline full-chain dry-run against the REAL migration (found + fixed a gate bug)
- **What:** applied the committed `0000_nebulous_black_widow.sql` + all 7 `src/rls/*.sql` into embedded Postgres (PGlite), then ran the exact `live-rls-gate.ts` seed + isolation logic. Offline, no DB, no secrets.
- **Bug found:** the gate seed inserted `user_roles` for `customer`/`operations_manager` **without** first inserting those keys into `roles` — the real migration enforces FK `user_roles.role_key → roles.key` (absent from the old hand-built test harness). Standalone `pnpm gate:rls` on a freshly-migrated project (no `db:seed`) would have **failed at seeding**.
- **Fix:** `packages/db/scripts/live-rls-gate.ts` now self-seeds those two role keys inside its rolled-back transaction (`insert into roles ... on conflict (key) do nothing`), so the gate no longer depends on `db:seed` ordering. **Operator must commit + push this fix before Pass 2.**
- **Result after fix: 13 passed, 0 failed** — migration applies, all 7 RLS files apply, gate seed matches real schema, cross-domain isolation + staff read + history + write-deny + anon all correct.
- Still no live gate ticked (this is offline PGlite, not the live Supabase gate). Rows 7–10 remain 🔲.

### 2026-07-01 — Pass 2 executed on LIVE Supabase (`borderpass-dev-gate`) — rows 6–10 PASSED
- Operator ran `scripts/phase7-local-run.sh --apply-db` against the live project (session pooler 5432, synthetic data only).
- Results: reachability `select 1`✅ · migrate 1 applied✅ · **7 RLS files, 48 policies, 26 RLS-enabled tables**✅ · seed 9 roles + 1 org✅ · **`gate:rls` 13 passed, 0 failed**✅ · rollback clean `leaked_gate_org=0`✅.
- **Live finding fixed:** the real Supabase environment required explicit table grants to the `authenticated` role that PGlite's harness had hard-coded but the policy files lacked — committed `e741a41 fix(rls): grant authenticated policy privileges`. Agent verified the grants are least-privilege (all to `authenticated`, none to anon/public; history/notification select-only; payments no customer insert). This is exactly the class of gap only a live gate catches.
- **Ledger rows 6, 7, 8, 9, 10 → ✅ PASS** (evidence in table above). This is the core live RLS release gate.
- Still 🔲: row 5 (PR CI green — push `main`), row 11 (OTP smoke — Supabase auth-redirect incident), 12–15 Stripe, 16 KMS, 17 preview-branching, 18 env/secrets review, 19 sign-off. Secrets rotation still owed. Development-only until all required rows pass + owner sign-off.

### 2026-07-01 — Row 5 (PR CI) PASSED
- PR [#2](https://github.com/alozeus1/maralito-labs/pull/2) → main `f7cd5a5`; [CI run 28546256476](https://github.com/alozeus1/maralito-labs/actions/runs/28546256476).
- Green jobs: quality, deps, SAST, secret-scan, Semgrep (**0 findings**), pnpm audit / OSV (**0 vulnerabilities**), tests, build.
- **Non-blocking follow-up:** `actions/checkout` + gitleaks emit Node20 action-deprecation warnings (the action runtime, not our Node 22 engine). Not a release blocker; track a bump of those action versions.
- KMS (`decision-kms.md`) + preview-branching (`decision-preview-branching.md`) records drafted this session, owner-ready — rows 16/17 remain 🔲 pending sign-off.
- **Rows now PASS: 1–10 + 5** (i.e. 1,2,3,4,5,6,7,8,9,10). Remaining 🔲: 11 (OTP, Supabase incident), 12–15 (Stripe), 16 (KMS sign-off), 17 (preview sign-off), 18 (env/secrets review), 19 (owner sign-off).
