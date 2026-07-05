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
| 5 | Normal PR CI green | GitHub Actions `ci.yml` | ✅ PASS | operator / 2026-07-01 | PR [#3](https://github.com/alozeus1/maralito-labs/pull/3) (supersedes #2), merge `df65ea7`, feature `a4565ae`, [run 28551410361](https://github.com/alozeus1/maralito-labs/actions/runs/28551410361) = success. Green: quality/tests+build, deps, SAST, secret-scan. Widened Vitest suite: **13 files / 77 tests** incl payment state-machine tests. `.env.local` never staged; Supabase Preview skipped; only non-blocking Node20 action-deprecation warnings remain. (Prior: PR #2 / `f7cd5a5` / run 28546256476.) |
| 6 | Live Supabase provisioned | operator | ✅ PASS (connection-verified) | operator / 2026-07-01 | Project `borderpass-dev-gate`, ref `rupqejwzmwfspvbmkmai`, us-east-2. Reachability confirmed: `select 1` returned 1 row (session pooler 5432). |
| 7 | Migrations applied (live) | `db:migrate` | ✅ PASS | operator / 2026-07-01 | Pass 2: 1 migration applied (`0000_nebulous_black_widow`). |
| 8 | All 7 RLS policies applied (live) | apply `rls/*.sql` | ✅ PASS | operator / 2026-07-01 | Pass 2: all 7 policy files applied → 48 policies, RLS enabled on 26 tables. Required grant fix committed `e741a41` (least-privilege grants to `authenticated` only; no anon/public). |
| 9 | Seed applied (live) | `db:seed` | ✅ PASS | operator / 2026-07-01 | Pass 2: 9 roles + 1 synthetic org. No PII. |
| 10 | Live two-user RLS isolation gate | `pnpm gate:rls` → `N passed, 0 failed` | ✅ PASS | operator / 2026-07-01 | Pass 2: `gate:rls` = **13 passed, 0 failed**; non-destructive rollback verified (`leaked_gate_org=0`). Cross-domain isolation + staff read + history staff-only + payment write-deny + anon→0, on live Supabase. |
| 11 | OTP → provisioning → session smoke | operator | 🔲 UNRUN | | |
| 12 | Stripe TEST-mode smoke (offline pre-check) | `stripe:smoke` | ✅ PASS (agent-run, TEST mode) | agent / 2026-07-01 | `stripe:smoke` 5/5 with real `sk_test_`/`whsec_` (keys present · TEST mode · API version 2024-06-20 · offline sig verify · tamper rejected). Live-key refusal separately verified. Evidence: `run-logs/stripe-gate-20260701T2137Z.md`. |
| 13 | Stripe TEST-mode live round-trip | Stripe CLI (runbook) | ✅ PASS (post-fix, TEST mode) | agent / 2026-07-01 | After state-machine fix: happy path (`pm_card_visa`) → payment `succeeded`, order **`paid`**, `payment_events` `requires_payment→succeeded`, receipt queued. Failure path (`pm_card_chargeDeclined`) → payment `failed`, order stays `awaiting_payment` (never paid). Idempotency: resent `succeeded` → no dup (1 payment/1 event/1 receipt). See `run-logs/stripe-gate-20260701T2137Z.md`. |
| 14 | Stripe API-version validation | dashboard vs pinned | ✅ PASS | agent / 2026-07-01 | `stripe listen` reports API Version **2024-06-20** == `DEFAULT_STRIPE_API_VERSION`. Webhook signature fail-closed (missing/invalid → 400) and idempotent (redelivered event → 1 ledger row). Evidence: `run-logs/stripe-gate-20260701T2137Z.md`. |
| 15 | Stripe LIVE validation (before real payments) | operator | 🔲 UNRUN | | Stripe LIVE validation deferred. TEST-mode Stripe validation is already proven in rows 12–14 (redacted evidence: `run-logs/stripe-gate-20260701T2137Z.md`). LIVE validation requires explicit owner approval and live-mode keys before any real payments. |
| 16 | KMS / secret-management decision | `decision-kms.md` | ✅ PASS (owner-signed) | Godwill / 2026-07-01 | Ratified: managed secrets dev-only; **Cloud KMS envelope encryption required before any real PII/RFC/KYC/address**. Decision recorded; implementation is a future increment. |
| 17 | Preview-branching decision | `decision-preview-branching.md` | ✅ PASS (owner-signed) | Godwill / 2026-07-01 | Ratified: **defer** preview branching (Option C) until row 18 + isolation-model choice. No real PII in previews. |
| 18 | Env/secrets review | `env-secrets-review.md` | 🟡 PARTIAL — NOT fully closed | Godwill / 2026-07-01 | Review recorded for dev-only gates (guards green, no server secret in `NEXT_PUBLIC_`, `.env*` gitignored, CI secret-scan + Semgrep 0 findings). **BUT exposed Supabase `service_role`/secret key + DB password rotation remains REQUIRED BEFORE PRIVATE TESTERS. Do not treat Row 18 as closed until rotation evidence is recorded.** |
| 19 | Deployment readiness sign-off | `deployment-readiness-checklist.md` | 🟡 CONDITIONAL (owner-signed Option B) | Godwill / 2026-07-05 | Owner selected **Option B** of `owner-signoff-packet.md` in writing: synthetic private mobile tester round approved **conditionally — effective only after Row 11 passes with evidence and Row 18's open action closes**. No gate waived; **testers remain BLOCKED** until rows 11 + 18 close. |

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

### 2026-07-01T~21:37–21:48Z — Stripe TEST-mode gate driven (rows 12–15) — 12 & 14 PASS; **row 13/E2E BLOCKED by confirmed bug**
- Full evidence: `run-logs/stripe-gate-20260701T2137Z.md`. TEST mode only (`livemode:false` throughout); synthetic org/customer/order/quote; no live keys, no real PII/card data.
- **Row 12 ✅** offline smoke 5/5 with real `sk_test_`/`whsec_`. **Row 14 ✅** API version 2024-06-20 == pinned; webhook signature fail-closed (missing/invalid → 400) + idempotent (redelivered `payment_intent.succeeded` → 1 ledger row, no dup). **Row 13 ✅ initiation** (real test PaymentIntent + payment record).
- **BUG (blocks the round-trip / any TEST-mode E2E):** a real card success (`pm_card_visa`) produced `payment_intent.created → payment_intent.succeeded` with **no** `payment_intent.processing`. The webhook received `succeeded` while the payment was `requires_payment`; `requires_payment→succeeded` is **illegal** (`LEGAL_PAYMENT_TRANSITIONS.requires_payment = ['processing','canceled']`, intentional per `state-machine.test.ts:34`), so the transition was silently skipped. **Order never reached `paid`; payment never left `requires_payment`.** Same for the failure path (`pm_card_chargeDeclined` → `payment_intent.payment_failed` skipped; payment not marked `failed`).
- **Safety invariant HOLDS:** no order was ever wrongly marked `paid` (happy-path order and failure-path order both remained `awaiting_payment`).
- **Recommended fix (NOT applied — safety-critical payment logic, owner decision):** allow the direct transitions Stripe actually emits for cards — `requires_payment: ['processing','succeeded','failed','canceled']` and add `succeeded` to `requires_action` (3DS) — then update `state-machine.test.ts` (18–44) and re-run this gate. `orderPaidCascadeTarget` already restricts the paid cascade to `succeeded` + `awaiting_payment`, so it remains safe.
- Rows 13 (round-trip) & TEST-mode E2E remain **not passed** pending the fix. Row 15 (LIVE) untouched. BorderPass remains development-only.

### 2026-07-01T~22:02–22:05Z — state-machine fix applied + gate RE-RUN — rows 12/13/14 PASS (TEST mode)
- **Fix (owner-approved):** `apps/borderpass/src/domain/payments/state-machine.ts` — `LEGAL_PAYMENT_TRANSITIONS` now allows the progressions Stripe actually emits for cards: `requires_payment → [processing, requires_action, succeeded, failed, canceled]` and `requires_action → [processing, succeeded, failed, canceled]`. Tests updated (`state-machine.test.ts`). Paid cascade still gated by `orderPaidCascadeTarget` (succeeded + awaiting_payment) — unchanged, safe.
- **Re-run (fresh test PIs):** happy path order → **`paid`**, payment `succeeded`, receipt queued; failure path payment **`failed`**, order stays `awaiting_payment`; redelivered `succeeded` → idempotent (no dup). Full evidence appended in `run-logs/stripe-gate-20260701T2137Z.md`.
- **Final verification:** `typecheck` 11/11 ✅ · `lint` 11/11 (0 warnings) ✅ · `build` ✅ · `stripe:smoke` 5/5 ✅ · payments domain unit tests 76/76 ✅.
- **Secondary finding (NOT fixed — follow-up):** `apps/borderpass/vitest.config.ts` `include` is `tests/unit/**` only, so **12 co-located `src/**` test files (76 tests) never run in CI** — including the payments state-machine tests. They pass when run explicitly, but the CI "full Vitest suite" (row 4) currently exercises only `tests/unit/health.test.ts`. Recommend widening the include (e.g. add `src/**/*.test.{ts,tsx}` + `@`→`./src` alias) so this fix stays regression-guarded.
- Rows 12/13/14 now ✅ (TEST mode). Row 15 (LIVE validation) still 🔲 — out of scope, no live keys. BorderPass remains development-only; secret rotation (row 18) still owed.

### 2026-07-01T~22:14Z — Vitest coverage widened (secondary finding RESOLVED)
- `apps/borderpass/vitest.config.ts` `include` is now `['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}']` with a `@`→`./src` resolve alias so co-located domain tests resolve like the app.
- `pnpm --filter borderpass test` → **13 files / 77 tests passed** (previously 1 file / 1 test), incl. `src/domain/payments/state-machine.test.ts` (the fix's regression guard) + payments rules/display/copy and the other domain suites.
- Re-verified after the config change: `typecheck` 11/11 · `lint` 11/11 · `check:db-imports` ✅ · `check:client-stripe` ✅ · `build` ✅ · `stripe:smoke` 5/5. No product-behavior change (test-config only). Row 4 ("full Vitest suite") now genuinely exercises the payment state machine. Rows 15 (LIVE) and 18 (secret rotation/env review) remain 🔲.

### 2026-07-05T02:32Z — Row 11 OTP smoke re-attempt on the operator's Mac — BLOCKED (Supabase platform incident)
- **Progress:** authenticated dashboard reached (org `maralito-labs` / project `borderpass-dev-gate`); Site URL already `http://localhost:3000`; redirect allow-list found EMPTY; `http://localhost:3000/**` + `http://localhost:3000/auth/callback` entered.
- **Blocker:** save failed 3× — toast "Failed to add URL(s): Failed to fetch (api.supabase.com)"; observed `api.supabase.com` 503; page reload confirmed nothing persisted. status.supabase.com (live read): unresolved incident **"Project status change failures in multiple regions"** + Compute capacity degraded in us-east-2. Dashboard banner "We are investigating a technical issue" active throughout.
- **Not done:** no OTP requested, no user created, no gate ticked. Evidence: `run-logs/otp-smoke-attempt-20260705T023231Z.md`.
- **Same-session re-verification (operator Mac, real toolchain):** `pnpm install` ✅ · `preflight` ✅ · `check:db-imports` ✅ · `check:client-stripe` ✅ · `typecheck` 13/13 ✅ · `lint` 13/13 ✅ · `build` ✅ · `stripe:smoke` 5/5 (TEST keys, offline) ✅ · `bash -n scripts/phase7-stripe-gate.sh` ✅. Secret-hygiene scan of tracked files: no real secret values (variable names only); `.env.local` ignored, never staged.
- Row 11 stays 🔲 · Row 15 stays 🔲 (LIVE deferred) · Row 18 stays 🟡 PARTIAL (rotation REQUIRED BEFORE PRIVATE TESTERS) · Row 19 stays 🔲. **Private testers remain BLOCKED.**

### 2026-07-05T03:10Z — Row 11 re-attempt (post PR #5 merge) — still BLOCKED; owner sign-off packet prepared
- Redirect-URL save retried on the authenticated dashboard: identical failure (`OPTIONS …/auth/<ref>/config` 204, actual save `Failed to fetch (api.supabase.com)`); allow-list still empty after reload; incident banner + unresolved status-page incident active. Evidence: `run-logs/otp-smoke-attempt-20260705T031019Z.md`. OTP smoke not started (precondition failed). Row 11 stays 🔲.
- Baseline re-verified on main @ `ad51d05`: preflight ✅ · db-imports ✅ · client-stripe ✅ · typecheck 13/13 ✅ · lint 13/13 ✅ · build ✅.
- **Row 19 packet ready:** `owner-signoff-packet.md` created — gate summary, tester-round scope (synthetic-only, Stripe TEST, Stitch-canonical UI), Phase 8 posture (ADR-0014 PROPOSED, not started), and owner options A/B/C with signature block. Row 19 stays 🔲 until the owner signs in writing.

### 2026-07-05T03:16Z — Owner decision pass — Row 11 re-retry BLOCKED; Row 19 conditionally signed (Option B)
- **Row 11:** redirect-URL save retried again on the authenticated dashboard — same failure (preflight 204, save never completes, "No Redirect URLs" persists after reload, incident banner active). Evidence: `run-logs/otp-smoke-attempt-20260705T031647Z.md`. Row 11 stays 🔲; OTP smoke not started.
- **Row 19:** owner (Godwill) selected **Option B** of `owner-signoff-packet.md` in writing (2026-07-05): synthetic private mobile tester round **conditionally approved — effective only after Row 11 passes with evidence and Row 18's open action closes**. No gate waived. Row 19 → 🟡 CONDITIONAL.
- Net effect: **private testers remain BLOCKED** (rows 11 + 18 open). Phase 8 not started; ADR-0014 PROPOSED.

### 2026-07-05T03:22Z — Row 11 narrow retry — still BLOCKED
- Redirect-URL save retried once more on the authenticated dashboard (repo synced @ `b3f2ecf` first): same failure — save never completes, "No Redirect URLs" persists after reload, incident banner intermittently visible. Evidence: `run-logs/otp-smoke-attempt-20260705T032223Z.md`. OTP smoke not started; Row 11 stays 🔲.
- Rows 18/19 unchanged (19 = conditional Option B, inactive until 11 + 18 close). **Private testers remain BLOCKED.**
