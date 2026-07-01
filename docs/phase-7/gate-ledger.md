# Phase 7 — Live Gate Ledger

> ADR-0013 · **Single source of truth for gate status.** A box is ticked **only** after the gate was actually
> executed and passed in the real environment. As of this document, **ALL live gates are UNRUN** — none may
> be reported as passed. Development-only until every required gate below is checked + owner-signed.

| # | Gate | How to run | Status | Run by / date | Evidence |
|---|------|------------|--------|---------------|----------|
| 1 | Real `pnpm install` + committed lockfile | `pnpm install` | 🔲 UNRUN | | |
| 2 | Full app-server typecheck | `pnpm typecheck` | 🔲 UNRUN | | |
| 3 | Full Next app build | `pnpm build` | 🔲 UNRUN | | |
| 4 | Full Vitest suite | `pnpm test` | 🔲 UNRUN | | |
| 5 | Normal PR CI green | GitHub Actions `ci.yml` | 🔲 UNRUN | | |
| 6 | Live Supabase provisioned | operator | ✅ PROVISIONED (operator-attested) | operator / 2026-07-01 | Project `borderpass-dev-gate`, ref `rupqejwzmwfspvbmkmai`, org `maralito-labs`, region `us-east-2`, status Healthy. Not yet connection-verified from CI/agent — DB reachability is confirmed at rows 7 & 10. |
| 7 | Migrations applied (live) | `db:migrate` | 🔲 UNRUN | | |
| 8 | All 7 RLS policies applied (live) | apply `rls/*.sql` | 🔲 UNRUN | | |
| 9 | Seed applied (live) | `db:seed` | 🔲 UNRUN | | |
| 10 | Live two-user RLS isolation gate | `pnpm gate:rls` → ALL PASS | 🔲 UNRUN | | |
| 11 | OTP → provisioning → session smoke | operator | 🔲 UNRUN | | |
| 12 | Stripe TEST-mode smoke (offline pre-check) | `stripe:smoke` | 🔲 UNRUN | | |
| 13 | Stripe TEST-mode live round-trip | Stripe CLI (runbook) | 🔲 UNRUN | | |
| 14 | Stripe API-version validation | dashboard vs pinned | 🔲 UNRUN | | |
| 15 | Stripe LIVE validation (before real payments) | operator | 🔲 UNRUN | | |
| 16 | KMS / secret-management decision | `decision-kms.md` | 🔲 UNRUN | | |
| 17 | Preview-branching decision | `decision-preview-branching.md` | 🔲 UNRUN | | |
| 18 | Env/secrets review | `env-secrets-review.md` | 🔲 UNRUN | | |
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
